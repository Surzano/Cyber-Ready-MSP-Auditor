import { promises as dns } from "node:dns";
import net from "node:net";
import { NextResponse } from "next/server";
import { UNAVAILABLE_WEB, analyzeEmail, assembleResult } from "@/lib/domain/analyze";
import { emailDomainOf, sanitizeDomain } from "@/lib/domain/sanitize";
import { SIMULATED_DOMAIN, simulatedScan } from "@/lib/domain/simulated";
import type { TxtResolver, WebDetails } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FETCH_TIMEOUT_MS = 6000;
const EMAIL_BUDGET_MS = 10000;
const USER_AGENT = "CyberReadyMSPAuditor/1.0 (+passive security header check)";

class DnsUnavailableError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new DnsUnavailableError(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// "No such record" answers are normal results; anything else means DNS itself is unreachable.
const EMPTY_CODES = new Set(["ENODATA", "ENOTFOUND", "ESERVFAIL", "ENONAME", "EBADRESP"]);

function nodeResolver(nxNames: Set<string>): TxtResolver {
  const r = new dns.Resolver({ timeout: 2500, tries: 2 });
  const wrap = async <T>(name: string, fn: () => Promise<T>, empty: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? "";
      if (code === "ENOTFOUND") nxNames.add(name);
      if (EMPTY_CODES.has(code)) return empty;
      throw new DnsUnavailableError(`DNS query for ${name} failed (${code || "unknown"})`);
    }
  };
  return {
    txt: (name) => wrap(name, async () => (await r.resolveTxt(name)).map((chunks) => chunks.join("")), []),
    cname: (name) => wrap(name, () => r.resolveCname(name), []),
    mx: (name) =>
      wrap(name, async () => (await r.resolveMx(name)).sort((a, b) => a.priority - b.priority).map((m) => `${m.priority} ${m.exchange}`), []),
  };
}

// --- SSRF guard: the header check only ever talks to public internet addresses -------------

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

async function assertPublicHost(host: string): Promise<void> {
  if (!sanitizeDomain(host)) throw new Error(`Refusing non-public host ${host}`);
  const addrs = await withTimeout(dns.lookup(host, { all: true }), 4000, `lookup ${host}`);
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error(`Refusing to connect: ${host} resolves to a private/reserved address`);
  }
}

/** GET a URL, following up to 5 redirects manually so every hop passes the SSRF guard. */
async function safeFetch(url: string): Promise<{ res: Response; finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop <= 5; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(`Unsupported redirect to ${u.protocol}`);
    if (u.port && u.port !== "80" && u.port !== "443") throw new Error(`Refusing non-standard port ${u.port}`);
    await assertPublicHost(u.hostname);
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => {});
      current = new URL(location, current).toString();
      continue;
    }
    await res.body?.cancel().catch(() => {});
    return { res, finalUrl: current };
  }
  throw new Error("Too many redirects");
}

function describeFetchError(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return `timed out after ${FETCH_TIMEOUT_MS / 1000}s`;
    const cause = (e as Error & { cause?: { code?: string } }).cause;
    return cause?.code ? `${e.message} (${cause.code})` : e.message;
  }
  return String(e);
}

async function inspectWebsite(domain: string): Promise<WebDetails> {
  const candidates = domain.startsWith("www.") ? [domain] : [domain, `www.${domain}`];
  let lastError = "unreachable";
  for (const host of candidates) {
    try {
      const [{ res, finalUrl }, httpRedirect] = await Promise.all([
        safeFetch(`https://${host}/`),
        // Does plain http:// end up on https://? Look only at the first hop.
        (async () => {
          try {
            await assertPublicHost(host);
            const r = await fetch(`http://${host}/`, {
              redirect: "manual",
              headers: { "user-agent": USER_AGENT },
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
              cache: "no-store",
            });
            await r.body?.cancel().catch(() => {});
            const loc = r.headers.get("location");
            return r.status >= 300 && r.status < 400 && !!loc && new URL(loc, `http://${host}/`).protocol === "https:";
          } catch {
            return null;
          }
        })(),
      ]);
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
      return {
        available: true,
        finalUrl,
        httpsOk: true,
        httpRedirectsToHttps: httpRedirect,
        statusCode: res.status,
        headers,
        error: null,
      };
    } catch (e) {
      lastError = describeFetchError(e);
    }
  }
  return { ...UNAVAILABLE_WEB, available: true, error: lastError };
}

async function handle(rawDomain: string | null, simulate: boolean) {
  if (simulate || rawDomain?.trim().toLowerCase() === "demo") {
    return NextResponse.json(simulatedScan(SIMULATED_DOMAIN));
  }
  const domain = sanitizeDomain(rawDomain ?? "");
  if (!domain) {
    return NextResponse.json(
      { error: "INVALID_DOMAIN", message: "Enter a public domain name such as example.org (URLs and email addresses are accepted too)." },
      { status: 400 },
    );
  }
  const mailDomain = emailDomainOf(domain);
  const nx = new Set<string>();
  const resolver = nodeResolver(nx);

  const [emailResult, web] = await Promise.all([
    withTimeout(analyzeEmail(mailDomain, resolver), EMAIL_BUDGET_MS, "Email DNS checks").then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e }),
    ),
    inspectWebsite(domain),
  ]);

  if (!emailResult.ok) {
    const message = emailResult.e instanceof Error ? emailResult.e.message : "DNS unavailable";
    return NextResponse.json({ error: "DNS_UNAVAILABLE", message }, { status: 503 });
  }
  if (nx.has(mailDomain) && emailResult.v.mx.length === 0 && !web.httpsOk) {
    return NextResponse.json({ error: "NXDOMAIN", message: `${mailDomain} does not appear to exist in public DNS.` }, { status: 422 });
  }
  const notes: string[] = [];
  if (mailDomain !== domain) notes.push(`Email checks ran on the organizational domain ${mailDomain}.`);
  return NextResponse.json(assembleResult(mailDomain, "live-server", emailResult.v, web, notes), {
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return handle(url.searchParams.get("domain"), url.searchParams.get("simulate") === "1");
}

export async function POST(req: Request) {
  let body: { domain?: unknown; simulate?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // fall through to validation error
  }
  return handle(typeof body.domain === "string" ? body.domain : null, body.simulate === true);
}

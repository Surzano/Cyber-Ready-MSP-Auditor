import type { DomainScanResult, TxtResolver } from "../types";
import { UNAVAILABLE_WEB, analyzeEmail, assembleResult } from "./analyze";
import { emailDomainOf, sanitizeDomain } from "./sanitize";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export class ScanError extends Error {
  constructor(
    message: string,
    public code: "INVALID_DOMAIN" | "NXDOMAIN" | "OFFLINE",
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// DNS-over-HTTPS resolver (JSON API) — works from any static host, e.g. GitHub Pages
// ---------------------------------------------------------------------------

const DOH_ENDPOINTS = [
  (name: string, type: string) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
  (name: string, type: string) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
];
const RR_TYPE = { TXT: 16, CNAME: 5, MX: 15 } as const;

interface DohAnswer {
  name: string;
  type: number;
  data: string;
}

/** TXT data arrives as one or more quoted chunks: "\"v=spf1 include:a\" \"-all\"" */
function unquoteTxt(data: string): string {
  const chunks = data.match(/"((?:[^"\\]|\\.)*)"/g);
  if (!chunks) return data;
  return chunks.map((c) => c.slice(1, -1).replace(/\\(.)/g, "$1")).join("");
}

export function dohResolver(): TxtResolver {
  let preferred = 0;
  const query = async (name: string, type: keyof typeof RR_TYPE): Promise<DohAnswer[]> => {
    let lastErr: unknown;
    for (let i = 0; i < DOH_ENDPOINTS.length; i++) {
      const idx = (preferred + i) % DOH_ENDPOINTS.length;
      try {
        const res = await fetch(DOH_ENDPOINTS[idx](name, type), {
          headers: { accept: "application/dns-json" },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
        const json = (await res.json()) as { Status: number; Answer?: DohAnswer[] };
        preferred = idx;
        if (json.Status !== 0) return []; // NXDOMAIN / SERVFAIL → no records
        return (json.Answer ?? []).filter((a) => a.type === RR_TYPE[type]);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("DNS-over-HTTPS unavailable");
  };
  return {
    txt: async (name) => (await query(name, "TXT")).map((a) => unquoteTxt(a.data)),
    cname: async (name) => (await query(name, "CNAME")).map((a) => a.data.replace(/\.$/, "")),
    mx: async (name) =>
      (await query(name, "MX"))
        .map((a) => a.data.replace(/\.$/, ""))
        .sort((a, b) => Number(a.split(" ")[0]) - Number(b.split(" ")[0])),
  };
}

export async function scanViaDoh(domain: string): Promise<DomainScanResult> {
  const mailDomain = emailDomainOf(domain);
  const email = await analyzeEmail(mailDomain, dohResolver());
  return assembleResult(mailDomain, "live-doh", email, UNAVAILABLE_WEB, [
    "Scanned from your browser via DNS-over-HTTPS (dns.google / cloudflare-dns.com) because the serverless API was unavailable.",
    "Website security headers were not graded, because browsers can't read another site's response headers.",
  ]);
}

// ---------------------------------------------------------------------------
// Dual-mode entry point
// ---------------------------------------------------------------------------

export async function scanDomain(input: string): Promise<DomainScanResult> {
  const domain = sanitizeDomain(input);
  if (!domain) {
    throw new ScanError("Enter a public domain name such as example.org (full URLs and email addresses are accepted).", "INVALID_DOMAIN");
  }

  let apiProblem = "";
  try {
    const res = await fetch(`${BASE_PATH}/api/scan-domain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain }),
      signal: AbortSignal.timeout(25000),
    });
    const isJson = res.headers.get("content-type")?.includes("application/json");
    if (isJson) {
      const json = await res.json();
      if (res.ok) return json as DomainScanResult;
      if (json.error === "INVALID_DOMAIN") throw new ScanError(json.message, "INVALID_DOMAIN");
      if (json.error === "NXDOMAIN") throw new ScanError(json.message, "NXDOMAIN");
      apiProblem = json.message ?? `API returned ${res.status}`;
    } else {
      apiProblem = `API not available (HTTP ${res.status})`; // static hosting such as GitHub Pages
    }
  } catch (e) {
    if (e instanceof ScanError) throw e;
    apiProblem = e instanceof Error ? e.message : "API unreachable";
  }

  try {
    const result = await scanViaDoh(domain);
    result.notes.unshift(`Server scan unavailable (${apiProblem}).`);
    return result;
  } catch {
    throw new ScanError(
      "Live lookups seem to be blocked on this network. Try again on another connection, or use the sample domain to see how results look.",
      "OFFLINE",
    );
  }
}

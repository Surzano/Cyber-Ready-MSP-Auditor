import type {
  CheckResult,
  DkimDetails,
  DmarcDetails,
  DomainScanResult,
  ScanMode,
  SpfDetails,
  TxtResolver,
  WebDetails,
} from "../types";
import { letterGrade } from "../grading";

export const DKIM_SELECTORS = [
  "google",
  "selector1",
  "selector2",
  "default",
  "k1",
  "k2",
  "mandrill",
  "mailchimp",
  "everlytickey1",
  "everlytickey2",
  "s1",
  "s2",
  "dkim",
  "smtp",
];

export const RECOMMENDED_HEADERS = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
} as const;

const SPF_LOOKUP_LIMIT = 10;

// ---------------------------------------------------------------------------
// SPF
// ---------------------------------------------------------------------------

function spfRecordsOf(txt: string[]): string[] {
  return txt.filter((t) => /^v=spf1(\s|$)/i.test(t.trim()));
}

interface SpfTerm {
  qualifier: "+" | "-" | "~" | "?";
  mechanism: string; // lowercased name, e.g. include, a, mx, all, redirect
  value: string | null;
}

export function parseSpfTerms(record: string): SpfTerm[] {
  return record
    .trim()
    .split(/\s+/)
    .slice(1)
    .filter(Boolean)
    .map((raw) => {
      let qualifier: SpfTerm["qualifier"] = "+";
      let body = raw;
      if ("+-~?".includes(raw[0])) {
        qualifier = raw[0] as SpfTerm["qualifier"];
        body = raw.slice(1);
      }
      const m = body.match(/^([a-z0-9]+)(?:[:=](.*))?$/i);
      const mechanism = (m?.[1] ?? body).toLowerCase();
      // "a/24" and "mx/24" carry a CIDR suffix rather than ":"
      const cleanMech = mechanism.replace(/\/.*$/, "");
      return { qualifier, mechanism: cleanMech, value: m?.[2] ?? null };
    });
}

const LOOKUP_MECHANISMS = new Set(["include", "a", "mx", "ptr", "exists", "redirect"]);

/**
 * Recursively counts DNS-querying mechanisms per RFC 7208 §4.6.4 (limit: 10).
 * Shares a visited set so include loops terminate.
 */
async function countSpfLookups(
  terms: SpfTerm[],
  resolver: TxtResolver,
  visited: Set<string>,
  errors: string[],
  depth: number,
): Promise<number> {
  let count = 0;
  const nested: Promise<number>[] = [];
  for (const t of terms) {
    if (!LOOKUP_MECHANISMS.has(t.mechanism)) continue;
    count += 1;
    if ((t.mechanism === "include" || t.mechanism === "redirect") && t.value) {
      const target = t.value.toLowerCase();
      if (target.includes("%{")) continue; // macro — can't expand statically
      if (visited.has(target)) {
        errors.push(`Include loop detected at ${target}`);
        continue;
      }
      if (depth >= 10) {
        errors.push(`Include nesting deeper than 10 levels at ${target}`);
        continue;
      }
      visited.add(target);
      nested.push(
        resolver
          .txt(target)
          .then((txt) => {
            const recs = spfRecordsOf(txt);
            if (recs.length === 0) {
              errors.push(`${t.mechanism}:${target} has no SPF record (void lookup → permerror)`);
              return 0;
            }
            return countSpfLookups(parseSpfTerms(recs[0]), resolver, visited, errors, depth + 1);
          })
          .catch(() => {
            errors.push(`Could not resolve ${t.mechanism}:${target}`);
            return 0;
          }),
      );
    }
  }
  const nestedCounts = await Promise.all(nested);
  return count + nestedCounts.reduce((a, b) => a + b, 0);
}

export async function analyzeSpf(domain: string, resolver: TxtResolver): Promise<SpfDetails> {
  const txt = await resolver.txt(domain);
  const records = spfRecordsOf(txt);
  const details: SpfDetails = {
    records,
    record: records[0] ?? null,
    allQualifier: null,
    lookupCount: 0,
    includes: [],
    errors: [],
  };
  if (records.length === 0) return details;
  if (records.length > 1) details.errors.push(`${records.length} SPF records published — receivers treat this as a permerror`);

  const terms = parseSpfTerms(records[0]);
  details.includes = terms.filter((t) => t.mechanism === "include" && t.value).map((t) => t.value!);
  const all = terms.find((t) => t.mechanism === "all");
  if (all) {
    details.allQualifier = all.qualifier;
  } else {
    const redirect = terms.find((t) => t.mechanism === "redirect" && t.value);
    if (redirect) {
      try {
        const r = spfRecordsOf(await resolver.txt(redirect.value!))[0];
        const rAll = r ? parseSpfTerms(r).find((t) => t.mechanism === "all") : undefined;
        if (rAll) details.allQualifier = rAll.qualifier;
      } catch {
        details.errors.push(`Could not resolve redirect=${redirect.value}`);
      }
    }
  }
  details.lookupCount = await countSpfLookups(terms, resolver, new Set([domain]), details.errors, 0);
  return details;
}

// ---------------------------------------------------------------------------
// DMARC
// ---------------------------------------------------------------------------

export function parseDmarcTags(record: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of record.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    tags[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim();
  }
  return tags;
}

export async function analyzeDmarc(domain: string, resolver: TxtResolver): Promise<DmarcDetails> {
  const txt = await resolver.txt(`_dmarc.${domain}`);
  const record = txt.find((t) => /^v=DMARC1\s*(;|$)/i.test(t.trim())) ?? null;
  if (!record) return { record: null, policy: null, subdomainPolicy: null, pct: null, rua: null };
  const tags = parseDmarcTags(record);
  const p = tags.p?.toLowerCase();
  return {
    record,
    policy: p === "none" || p === "quarantine" || p === "reject" ? p : null,
    subdomainPolicy: tags.sp?.toLowerCase() ?? null,
    pct: tags.pct ? Number(tags.pct) : null,
    rua: tags.rua ?? null,
  };
}

// ---------------------------------------------------------------------------
// DKIM
// ---------------------------------------------------------------------------

export async function analyzeDkim(domain: string, resolver: TxtResolver): Promise<DkimDetails> {
  const found: DkimDetails["found"] = [];
  await Promise.all(
    DKIM_SELECTORS.map(async (selector) => {
      const name = `${selector}._domainkey.${domain}`;
      const [txt, cname] = await Promise.all([
        resolver.txt(name).catch(() => [] as string[]),
        resolver.cname(name).catch(() => [] as string[]),
      ]);
      const key = txt.find((t) => /v=DKIM1|(^|;)\s*p=/i.test(t));
      if (key) found.push({ selector, type: "TXT", value: key });
      else if (cname.length) found.push({ selector, type: "CNAME", value: cname[0] });
    }),
  );
  found.sort((a, b) => DKIM_SELECTORS.indexOf(a.selector) - DKIM_SELECTORS.indexOf(b.selector));
  return { probed: DKIM_SELECTORS, found };
}

// ---------------------------------------------------------------------------
// MX / provider detection
// ---------------------------------------------------------------------------

/**
 * Node's resolveMx returns an empty exchange and DoH returns "." for an RFC 7505 null MX,
 * so after trailing-dot stripping both arrive as "0 " — restore the canonical "0 .".
 */
export function normalizeMx(mx: string[]): string[] {
  return mx.map((m) => (/^\d+\s*\.?$/.test(m.trim()) ? `${parseInt(m, 10)} .` : m));
}

/** RFC 7505 null MX: the domain explicitly accepts no email. */
export function isNullMx(mx: string[]): boolean {
  return mx.length === 1 && /^0 \.$/.test(mx[0]);
}

export function detectProvider(mx: string[], spfIncludes: string[]): DomainScanResult["emailProvider"] {
  const all = [...mx, ...spfIncludes].join(" ").toLowerCase();
  if (all.includes("protection.outlook.com") || all.includes("outlook.com")) return "Microsoft 365";
  if (all.includes("google.com") || all.includes("googlemail.com")) return "Google Workspace";
  if (mx.length === 0 || isNullMx(mx)) return "None detected";
  return "Other";
}

export interface EmailAnalysis {
  mx: string[];
  emailProvider: DomainScanResult["emailProvider"];
  spf: SpfDetails;
  dmarc: DmarcDetails;
  dkim: DkimDetails;
}

/** Runs every email-auth check through whichever resolver the caller supplies. */
export async function analyzeEmail(domain: string, resolver: TxtResolver): Promise<EmailAnalysis> {
  const [mx, spf, dmarc, dkim] = await Promise.all([
    resolver.mx(domain).then(normalizeMx, () => [] as string[]),
    analyzeSpf(domain, resolver),
    analyzeDmarc(domain, resolver),
    analyzeDkim(domain, resolver),
  ]);
  return { mx, emailProvider: detectProvider(mx, spf.includes), spf, dmarc, dkim };
}

// ---------------------------------------------------------------------------
// Check builders (scoring + plain-English copy)
// ---------------------------------------------------------------------------

function recommendedSpf(domain: string, provider: EmailAnalysis["emailProvider"], spf: SpfDetails): string {
  if (spf.record) {
    const hardened = spf.record.replace(/\s[~?+]?all\b/i, " -all");
    return /\s-all\b/i.test(hardened) ? hardened : `${spf.record.trim()} -all`;
  }
  if (provider === "Microsoft 365") return "v=spf1 include:spf.protection.outlook.com -all";
  if (provider === "Google Workspace") return "v=spf1 include:_spf.google.com -all";
  return `v=spf1 mx -all   ; add include: entries for every service that sends mail as ${domain}`;
}

function spfCheck(domain: string, a: EmailAnalysis): CheckResult {
  const { spf } = a;
  const base = {
    id: "spf" as const,
    category: "email" as const,
    label: "SPF — Authorized Senders",
    maxPoints: 20,
    raw: spf.records,
    notes: [`DNS lookups used: ${spf.lookupCount} / ${SPF_LOOKUP_LIMIT}`, ...spf.errors],
    fix: `TXT  ${domain}  "${recommendedSpf(domain, a.emailProvider, spf)}"`,
  };
  if (!spf.record) {
    return {
      ...base,
      status: "fail",
      points: 0,
      notes: [],
      summary: "No SPF record published",
      plain:
        "Nothing tells the world which servers are allowed to send email as your organization. Anyone can send convincing emails pretending to be your Executive Director or finance team.",
    };
  }
  if (spf.records.length > 1) {
    return {
      ...base,
      status: "fail",
      points: 2,
      summary: "Multiple SPF records (permerror)",
      plain: "Your domain publishes conflicting SPF records, so receiving mail servers ignore all of them. You effectively have no SPF protection.",
    };
  }
  const tooMany = spf.lookupCount > SPF_LOOKUP_LIMIT;
  const q = spf.allQualifier;
  let r: Pick<CheckResult, "status" | "points" | "summary" | "plain">;
  if (q === "-") {
    r = {
      status: "pass",
      points: 20,
      summary: "SPF ends in -all (hard fail)",
      plain: "Your domain clearly tells receiving servers to reject email from unauthorized senders. This is the strongest SPF setting.",
    };
  } else if (q === "~") {
    r = {
      status: "warn",
      points: 14,
      summary: "SPF ends in ~all (soft fail)",
      plain:
        "Unauthorized email is only marked as suspicious, not rejected. Spoofed messages can still land in inboxes, especially when combined with a weak DMARC policy.",
    };
  } else if (q === "+" || q === "?") {
    r = {
      status: "fail",
      points: q === "?" ? 4 : 0,
      summary: `SPF ends in ${q}all (${q === "+" ? "pass-all" : "neutral"})`,
      plain:
        q === "+"
          ? "Your SPF record authorizes every server on the internet to send email as you. This is worse than having no record."
          : "Your SPF record says it has no opinion about unauthorized senders, so it provides essentially no protection.",
    };
  } else {
    r = {
      status: "warn",
      points: 8,
      summary: "SPF has no 'all' mechanism",
      plain: "Your SPF record never says what to do with unauthorized senders, so receivers default to neutral and spoofed mail is not blocked.",
    };
  }
  if (tooMany) {
    r = {
      status: "fail",
      points: Math.min(r.points, 6),
      summary: `${r.summary}, but ${spf.lookupCount} DNS lookups exceed the limit of 10`,
      plain:
        "Your SPF record has grown too large (more than 10 DNS lookups). Receiving servers stop evaluating it and treat it as an error, which can cause legitimate email to bounce and lets spoofed email through.",
    };
  } else if (spf.lookupCount >= 9 && r.status === "pass") {
    r = { ...r, status: "warn", points: 17, summary: `${r.summary}; ${spf.lookupCount}/10 lookups (near limit)` };
  }
  return { ...base, ...r };
}

function dmarcCheck(domain: string, a: EmailAnalysis): CheckResult {
  const { dmarc } = a;
  const rua = dmarc.rua ?? `mailto:dmarc-reports@${domain}`;
  const base = {
    id: "dmarc" as const,
    category: "email" as const,
    label: "DMARC — Spoofing Enforcement",
    maxPoints: 25,
    raw: dmarc.record ? [dmarc.record] : [],
    notes: [] as string[],
    fix: `TXT  _dmarc.${domain}  "v=DMARC1; p=quarantine; pct=100; rua=${rua}; fo=1"   (move to p=reject after 2–4 weeks of clean reports)`,
  };
  if (!dmarc.record) {
    return {
      ...base,
      status: "fail",
      points: 0,
      summary: "No DMARC record at _dmarc." + domain,
      plain:
        "There is no policy telling Gmail, Outlook, or Yahoo what to do with email that fakes your domain. This is one of the main reasons wire-fraud and fake-invoice scams against nonprofits succeed.",
    };
  }
  if (!dmarc.rua) base.notes.push("No rua= reporting address, so you can't see who is sending email as your domain.");
  if (dmarc.pct !== null && dmarc.pct < 100) base.notes.push(`pct=${dmarc.pct}: policy applies to only ${dmarc.pct}% of failing mail.`);
  if (dmarc.subdomainPolicy) base.notes.push(`Subdomain policy sp=${dmarc.subdomainPolicy}`);
  const ruaPenalty = dmarc.rua ? 0 : 2;

  if (dmarc.policy === "reject") {
    return {
      ...base,
      // Already at p=reject: the only remaining step is applying it to all mail.
      fix: `TXT  _dmarc.${domain}  "v=DMARC1; p=reject; pct=100; rua=${rua}; fo=1"`,
      status: dmarc.pct !== null && dmarc.pct < 100 ? "warn" : "pass",
      points: 25 - ruaPenalty - (dmarc.pct !== null && dmarc.pct < 100 ? 5 : 0),
      summary: "DMARC p=reject (full enforcement)",
      plain: "Email that fakes your domain is rejected outright before it reaches anyone's inbox. This is the gold standard.",
    };
  }
  if (dmarc.policy === "quarantine") {
    return {
      ...base,
      status: "warn",
      points: 18 - ruaPenalty,
      summary: "DMARC p=quarantine (partial enforcement)",
      plain: "Fake email using your domain is sent to spam folders. That's good protection; the final step is moving to p=reject so it's blocked entirely.",
      fix: `TXT  _dmarc.${domain}  "v=DMARC1; p=reject; pct=100; rua=${rua}; fo=1"`,
    };
  }
  return {
    ...base,
    status: "fail",
    points: dmarc.policy === "none" ? Math.max(0, 6 - ruaPenalty) : 0,
    summary: dmarc.policy === "none" ? "DMARC p=none (monitoring only, no protection)" : "DMARC record has no valid p= policy",
    plain:
      "A DMARC record exists but is set to monitor only. Criminals can still send emails that look exactly like they came from your organization, and those emails will be delivered. Monitoring is a normal first step, but it has to be followed by enforcement.",
  };
}

function dkimCheck(domain: string, a: EmailAnalysis): CheckResult {
  const { dkim } = a;
  const fix =
    a.emailProvider === "Microsoft 365"
      ? `Enable DKIM signing in the Microsoft Defender portal → Email authentication → DKIM for ${domain}, then publish the two CNAMEs it provides:\n  selector1._domainkey.${domain}  CNAME  selector1-${domain.replace(/\./g, "-")}._domainkey.<tenant>.onmicrosoft.com\n  selector2._domainkey.${domain}  CNAME  selector2-${domain.replace(/\./g, "-")}._domainkey.<tenant>.onmicrosoft.com`
      : a.emailProvider === "Google Workspace"
        ? `Google Admin console → Apps → Google Workspace → Gmail → Authenticate email → Generate a 2048-bit key, publish it as TXT at google._domainkey.${domain}, then click "Start authentication".`
        : `Enable DKIM signing (2048-bit) with each service that sends mail as ${domain} and publish its <selector>._domainkey TXT/CNAME record.`;
  const base = {
    id: "dkim" as const,
    category: "email" as const,
    label: "DKIM — Message Signing",
    maxPoints: 15,
    raw: dkim.found.map((f) => `${f.selector}._domainkey  ${f.type}  ${f.value}`),
    notes: [`Probed selectors: ${dkim.probed.join(", ")}`],
    fix,
  };
  const revoked = dkim.found.filter((f) => f.type === "TXT" && /(^|;)\s*p=\s*(;|$)/i.test(f.value));
  if (revoked.length) base.notes.push(`Revoked (empty p=) keys: ${revoked.map((r) => r.selector).join(", ")}`);
  const active = dkim.found.length - revoked.length;
  if (active > 0) {
    return {
      ...base,
      status: "pass",
      points: 15,
      summary: `DKIM key found for selector(s): ${dkim.found.map((f) => f.selector).join(", ")}`,
      plain: "Outgoing email carries a tamper-proof digital signature, so receivers can confirm messages genuinely came from you and weren't altered.",
      fix: undefined,
    };
  }
  return {
    ...base,
    status: "warn",
    points: 5,
    summary: "No DKIM key found on common selectors; check manually",
    plain:
      "We couldn't find a digital signature key for your email. Your provider may use a custom selector, so ask your MSP to confirm DKIM signing is turned on. Without it, DMARC has much less to work with.",
  };
}

function header(web: WebDetails, name: string): string | undefined {
  return web.headers[name];
}

export function buildWebChecks(web: WebDetails): CheckResult[] {
  const base = (id: CheckResult["id"], label: string, maxPoints: number) => ({
    id,
    category: "web" as const,
    label,
    maxPoints,
    notes: [] as string[],
  });

  const https: CheckResult = {
    ...base("https", "HTTPS & HTTP→HTTPS Redirect", 10),
    raw: [
      `Final URL: ${web.finalUrl ?? "—"}`,
      `Status: ${web.statusCode ?? "—"}`,
      `http:// redirects to https:// : ${web.httpRedirectsToHttps === null ? "unknown" : web.httpRedirectsToHttps ? "yes" : "no"}`,
    ],
    ...(!web.httpsOk
      ? {
          status: "fail" as const,
          points: 0,
          summary: `Website not reachable over HTTPS${web.error ? ` (${web.error})` : ""}`,
          plain: "We could not load your website securely. Donors and clients may see browser security warnings, and data they submit may be exposed.",
          fix: "Install a valid TLS certificate (free via Let's Encrypt or your host) and serve the site over https://.",
        }
      : web.httpRedirectsToHttps === false
        ? {
            status: "warn" as const,
            points: 5,
            summary: "HTTPS works, but http:// does not redirect to https://",
            plain: "Visitors who type your address without 'https' land on an unencrypted page, where donation and contact forms can be intercepted on public Wi-Fi.",
            fix: "Configure a permanent (301) redirect from http:// to https:// at the web host or CDN.",
          }
        : {
            status: "pass" as const,
            points: 10,
            summary: "HTTPS enforced with redirect",
            plain: "Your website is always served over an encrypted connection.",
          }),
  };

  const hstsVal = header(web, "strict-transport-security");
  const maxAge = Number(hstsVal?.match(/max-age\s*=\s*"?(\d+)/i)?.[1] ?? 0);
  const hsts: CheckResult = {
    ...base("hsts", "Strict-Transport-Security (HSTS)", 10),
    raw: hstsVal ? [`strict-transport-security: ${hstsVal}`] : [],
    fix: `Strict-Transport-Security: ${RECOMMENDED_HEADERS["strict-transport-security"]}`,
    ...(!hstsVal
      ? {
          status: "fail" as const,
          points: 0,
          summary: "HSTS header missing",
          plain: "Browsers aren't told to always use a secure connection, leaving visitors open to downgrade attacks on public Wi-Fi.",
        }
      : maxAge < 15552000
        ? {
            status: "warn" as const,
            points: 5,
            summary: `HSTS max-age=${maxAge} is shorter than 6 months`,
            plain: "Secure-connection enforcement is switched on but expires quickly. A longer setting gives visitors lasting protection.",
          }
        : {
            status: "pass" as const,
            points: 10,
            summary: `HSTS max-age=${maxAge}${/includesubdomains/i.test(hstsVal) ? "; includeSubDomains" : ""}${/preload/i.test(hstsVal) ? "; preload" : ""}`,
            plain: "Browsers are told to connect to your site only over a secure connection.",
          }),
  };

  const cspVal = header(web, "content-security-policy");
  const cspRO = header(web, "content-security-policy-report-only");
  const cspNotes: string[] = [];
  if (cspVal && /'unsafe-inline'/.test(cspVal)) cspNotes.push("Policy allows 'unsafe-inline' (common for frameworks; nonces/hashes are stronger).");
  const cspWeak = !!cspVal && (/'unsafe-eval'/.test(cspVal) || /(script-src|default-src)[^;]*\s\*(\s|;|$)/.test(cspVal));
  const cspStructured = !!cspVal && /(default-src|script-src)/i.test(cspVal);
  const csp: CheckResult = {
    ...base("csp", "Content-Security-Policy (CSP)", 8),
    raw: [cspVal && `content-security-policy: ${cspVal}`, cspRO && `content-security-policy-report-only: ${cspRO}`].filter(Boolean) as string[],
    notes: cspNotes,
    fix: `Content-Security-Policy: ${RECOMMENDED_HEADERS["content-security-policy"]}`,
    ...(!cspVal
      ? {
          status: (cspRO ? "warn" : "fail") as CheckResult["status"],
          points: cspRO ? 3 : 0,
          summary: cspRO ? "CSP in report-only mode (not enforced)" : "Content-Security-Policy missing",
          plain:
            "Your site doesn't restrict which scripts may run. If a plugin or form is compromised, attackers can inject code that skims donor card details (a 'Magecart' attack).",
        }
      : cspWeak || !cspStructured
        ? {
            status: "warn" as const,
            points: 5,
            summary: "CSP present but permissive",
            plain: "A script policy exists but contains broad exceptions, so it offers only partial protection against injected code.",
          }
        : {
            status: "pass" as const,
            points: 8,
            summary: "CSP enforced",
            plain: "Your website restricts which scripts may run, blocking most code-injection and card-skimming attacks.",
          }),
  };

  const xfoVal = header(web, "x-frame-options");
  const frameAncestors = cspVal?.match(/frame-ancestors\s+([^;]+)/i)?.[1];
  const xfoOk = (!!xfoVal && /^(deny|sameorigin)$/i.test(xfoVal.trim())) || !!frameAncestors;
  const xfo: CheckResult = {
    ...base("xfo", "X-Frame-Options / frame-ancestors", 4),
    raw: [xfoVal && `x-frame-options: ${xfoVal}`, frameAncestors && `csp frame-ancestors: ${frameAncestors}`].filter(Boolean) as string[],
    fix: "X-Frame-Options: DENY",
    ...(xfoOk
      ? { status: "pass" as const, points: 4, summary: frameAncestors ? `CSP frame-ancestors ${frameAncestors.trim()}` : `X-Frame-Options: ${xfoVal}`, plain: "Other websites can't secretly embed your pages to trick visitors into clicking things." }
      : {
          status: "fail" as const,
          points: 0,
          summary: xfoVal ? `Invalid X-Frame-Options value "${xfoVal}"` : "Clickjacking protection missing",
          plain: "A malicious site could load your donation or login page invisibly inside its own page and trick visitors into clicking buttons ('clickjacking').",
        }),
  };

  const xctoVal = header(web, "x-content-type-options");
  const xcto: CheckResult = {
    ...base("xcto", "X-Content-Type-Options", 4),
    raw: xctoVal ? [`x-content-type-options: ${xctoVal}`] : [],
    fix: "X-Content-Type-Options: nosniff",
    ...(xctoVal && /nosniff/i.test(xctoVal)
      ? { status: "pass" as const, points: 4, summary: "nosniff set", plain: "Browsers won't be tricked into running uploaded files as code." }
      : { status: "fail" as const, points: 0, summary: "X-Content-Type-Options: nosniff missing", plain: "Browsers may guess file types, which lets a disguised malicious upload run as a script." }),
  };

  const refVal = header(web, "referrer-policy");
  const strong = ["no-referrer", "same-origin", "strict-origin", "strict-origin-when-cross-origin"];
  const refTokens = refVal?.toLowerCase().split(",").map((s) => s.trim()) ?? [];
  const effective = refTokens[refTokens.length - 1];
  const referrer: CheckResult = {
    ...base("referrer", "Referrer-Policy", 4),
    raw: refVal ? [`referrer-policy: ${refVal}`] : [],
    fix: `Referrer-Policy: ${RECOMMENDED_HEADERS["referrer-policy"]}`,
    ...(!refVal
      ? {
          status: "warn" as const,
          points: 1,
          summary: "Referrer-Policy missing (browser default applies)",
          plain: "Your site doesn't control what page addresses are shared with other sites. Modern browsers default to a safe setting, but it should be set explicitly.",
        }
      : strong.includes(effective)
        ? { status: "pass" as const, points: 4, summary: `Referrer-Policy: ${refVal}`, plain: "Private page addresses (like case-management links) aren't leaked to other websites." }
        : {
            status: "warn" as const,
            points: 2,
            summary: `Weak Referrer-Policy: ${refVal}`,
            plain: "Full page addresses may be shared with other websites, potentially leaking sensitive URLs.",
          }),
  };

  // A passing check needs no fix line in the MSP ticket.
  return [https, hsts, csp, xfo, xcto, referrer].map((c) => (c.status === "pass" ? { ...c, fix: undefined } : c));
}

export function buildEmailChecks(domain: string, a: EmailAnalysis): CheckResult[] {
  // A passing check needs no fix line — otherwise p=reject would be "fixed" down to p=quarantine.
  return [spfCheck(domain, a), dmarcCheck(domain, a), dkimCheck(domain, a)].map((c) => (c.status === "pass" ? { ...c, fix: undefined } : c));
}

export function assembleResult(
  domain: string,
  mode: ScanMode,
  email: EmailAnalysis,
  web: WebDetails,
  notes: string[] = [],
): DomainScanResult {
  const checks = [...buildEmailChecks(domain, email), ...(web.available ? buildWebChecks(web) : [])];
  const earned = checks.reduce((s, c) => s + c.points, 0);
  const max = checks.reduce((s, c) => s + c.maxPoints, 0);
  const score = max ? Math.round((earned / max) * 100) : 0;
  return {
    domain,
    scannedAt: new Date().toISOString(),
    mode,
    ...email,
    web,
    checks,
    score,
    grade: letterGrade(score),
    notes,
  };
}

export const UNAVAILABLE_WEB: WebDetails = {
  available: false,
  finalUrl: null,
  httpsOk: false,
  httpRedirectsToHttps: null,
  statusCode: null,
  headers: {},
  error: null,
};

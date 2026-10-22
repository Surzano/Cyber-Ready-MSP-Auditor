// Checks MSP Auditor's domain scanner against independent sources, domain by domain.
//
//   npm run validate:domains                       # uses validation/domains.txt and the live site
//   npm run validate:domains -- --api http://localhost:3000 --list my-domains.txt
//
// For each domain it compares what MSP Auditor reported with:
//   - SPF and DMARC records fetched separately from Cloudflare's public DNS and parsed by a
//     deliberately simple, separate parser (not the app's code)
//   - security headers fetched directly from the website
//   - Mozilla HTTP Observatory's grade for the site (context, not scored)
// and writes validation/domain-results.md with an agreement table plus links for manual checks.
// Only public DNS records and public website headers are read.
import { readFileSync, writeFileSync } from "node:fs";
import type { CheckResult, DomainScanResult } from "../src/lib/types.ts";

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const API = arg("api", "https://msp-auditor.vercel.app").replace(/\/$/, "");
const LIST = arg("list", "validation/domains.txt");
const OUT = arg("out", "validation/domain-results.md");
const TIMEOUT_MS = 20_000;

type Verdict = "agree" | "disagree" | "not compared";
interface Row {
  domain: string;
  error?: string;
  spf: { ours: string; independent: string; verdict: Verdict };
  dmarc: { ours: string; independent: string; verdict: Verdict };
  headers: { name: string; ours: string; independent: string; verdict: Verdict }[];
  oursGrade: string;
  oursWeb: string;
  observatory: string;
}

const domains = readFileSync(LIST, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim().toLowerCase())
  .filter((l) => l && !l.startsWith("#"));

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`);
  return body as T;
}

// --- Independent DNS (Cloudflare DNS-over-HTTPS) -------------------------------------------

async function txt(name: string): Promise<string[]> {
  const body = await getJson<{ Answer?: { type: number; data: string }[] }>(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { accept: "application/dns-json" },
  });
  return (body.Answer ?? []).filter((a) => a.type === 16).map((a) => String(a.data).replace(/"\s*"/g, "").replace(/^"|"$/g, ""));
}

/** "-all", "~all", "?all", "+all", "missing", "multiple records", "redirect" or "no all". */
function spfVerdict(records: string[]): string {
  const spf = records.filter((r) => /^v=spf1(\s|$)/i.test(r));
  if (!spf.length) return "missing";
  if (spf.length > 1) return "multiple records";
  const all = spf[0].split(/\s+/).find((t) => /^[+~?-]?all$/i.test(t));
  if (all) return all.length === 3 ? "+all" : all.toLowerCase();
  return /\sredirect=/i.test(spf[0]) ? "redirect" : "no all";
}

function dmarcVerdict(records: string[]): string {
  const rec = records.find((r) => /^v=DMARC1/i.test(r));
  if (!rec) return "missing";
  return /;\s*p\s*=\s*(none|quarantine|reject)/i.exec(rec)?.[1].toLowerCase() ?? "invalid";
}

// --- Independent website headers -----------------------------------------------------------

/** Try the bare domain, then www. A bot-blocking page (401/403/429/503) tells us nothing, so skip it. */
async function siteHeaders(domain: string): Promise<Headers> {
  let blocked = 0;
  for (const host of [domain, `www.${domain}`]) {
    const res = await fetch(`https://${host}/`, {
      redirect: "follow",
      headers: { "user-agent": "MSPAuditor-validation/1.0 (+passive header check)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel();
    if (![401, 403, 429, 503].includes(res.status)) return res.headers;
    blocked = res.status;
  }
  throw new Error(`blocked automated requests (HTTP ${blocked})`);
}

const HEADER_CHECKS: { id: string; name: string; present: (h: Headers) => boolean }[] = [
  { id: "hsts", name: "HSTS", present: (h) => h.has("strict-transport-security") },
  { id: "csp", name: "CSP", present: (h) => h.has("content-security-policy") },
  { id: "xfo", name: "Clickjacking", present: (h) => h.has("x-frame-options") || /frame-ancestors/i.test(h.get("content-security-policy") ?? "") },
  { id: "xcto", name: "X-Content-Type-Options", present: (h) => /nosniff/i.test(h.get("x-content-type-options") ?? "") },
  { id: "referrer", name: "Referrer-Policy", present: (h) => h.has("referrer-policy") },
];

async function observatory(domain: string): Promise<string> {
  try {
    const body = await getJson<{ grade?: string; score?: number; error?: string }>(`https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(domain)}`, { method: "POST" });
    return body.grade ? `${body.grade} (${body.score})` : (body.error ?? "no grade");
  } catch (e) {
    return `unavailable (${(e as Error).message})`;
  }
}

// --- Compare ---------------------------------------------------------------------------------

const OUR_SPF: Record<string, string> = { "-": "-all", "~": "~all", "?": "?all", "+": "+all" };

async function check(domain: string): Promise<Row> {
  const row: Row = {
    domain,
    spf: { ours: "", independent: "", verdict: "not compared" },
    dmarc: { ours: "", independent: "", verdict: "not compared" },
    headers: [],
    oursGrade: "–",
    oursWeb: "–",
    observatory: "",
  };
  const [ours, root, dmarc, headers, obs] = await Promise.allSettled([
    getJson<DomainScanResult>(`${API}/api/scan-domain?domain=${encodeURIComponent(domain)}`),
    txt(domain),
    txt(`_dmarc.${domain}`),
    siteHeaders(domain),
    observatory(domain),
  ]);
  row.observatory = obs.status === "fulfilled" ? obs.value : "unavailable";
  if (ours.status === "rejected") {
    row.error = `MSP Auditor scan failed: ${ours.reason?.message ?? ours.reason}`;
    return row;
  }
  const r = ours.value;
  row.oursGrade = `${r.grade} (${r.score})`;
  const web = r.checks.filter((c) => c.category === "web");
  row.oursWeb = web.length ? `${web.reduce((s, c) => s + c.points, 0)}/${web.reduce((s, c) => s + c.maxPoints, 0)}` : "not graded";

  if (root.status === "fulfilled") {
    const ind = spfVerdict(root.value);
    const mine = r.spf.records.length > 1 ? "multiple records" : !r.spf.record ? "missing" : (OUR_SPF[r.spf.allQualifier ?? ""] ?? "no all");
    // A redirect= hands the policy to another domain; the app follows it, the simple parser doesn't.
    row.spf = { ours: mine, independent: ind, verdict: ind === "redirect" ? "not compared" : ind === mine ? "agree" : "disagree" };
  } else row.spf.independent = `lookup failed (${root.reason?.message})`;

  if (dmarc.status === "fulfilled") {
    const ind = dmarcVerdict(dmarc.value);
    const mine = r.dmarc.policy ?? (r.dmarc.record ? "invalid" : "missing");
    row.dmarc = { ours: mine, independent: ind, verdict: ind === mine ? "agree" : "disagree" };
  } else row.dmarc.independent = `lookup failed (${dmarc.reason?.message})`;

  for (const hc of HEADER_CHECKS) {
    const c: CheckResult | undefined = r.checks.find((x) => x.id === hc.id);
    if (!c || !r.web.available || headers.status === "rejected") {
      row.headers.push({ name: hc.name, ours: c ? c.status : r.web.error ? `not graded (${r.web.error})` : "not checked", independent: headers.status === "rejected" ? `fetch failed: ${headers.reason?.message ?? headers.reason}` : "–", verdict: "not compared" });
      continue;
    }
    // Compare presence using the header values the app recorded, not its pass/warn/fail grade
    // (it warns, rather than fails, on some missing headers such as Referrer-Policy).
    const seen = c.raw.filter((line) => hc.id !== "csp" || line.startsWith("content-security-policy:"));
    const mine = seen.length ? "present" : "absent";
    const ind = hc.present(headers.value) ? "present" : "absent";
    row.headers.push({ name: hc.name, ours: `${mine} (${c.status})`, independent: ind, verdict: mine === ind ? "agree" : "disagree" });
  }
  return row;
}

// Three at a time keeps this polite to the public services involved.
const rows: Row[] = [];
for (let i = 0; i < domains.length; i += 3) {
  const batch = await Promise.all(domains.slice(i, i + 3).map(check));
  for (const r of batch) {
    rows.push(r);
    const verdicts = [r.spf.verdict, r.dmarc.verdict, ...r.headers.map((h) => h.verdict)];
    console.log(`${r.domain.padEnd(28)} ${r.error ?? `${verdicts.filter((v) => v === "agree").length}/${verdicts.filter((v) => v !== "not compared").length} agree`}`);
  }
}

// --- Report ----------------------------------------------------------------------------------

const all = rows.flatMap((r) => [r.spf.verdict, r.dmarc.verdict, ...r.headers.map((h) => h.verdict)]);
const compared = all.filter((v) => v !== "not compared");
const agreed = compared.filter((v) => v === "agree").length;
const pct = (n: number, d: number) => (d ? `${Math.round((n * 100) / d)}%` : "–");
const section = (label: string, pick: (r: Row) => Verdict[]) => {
  const v = rows.flatMap(pick).filter((x) => x !== "not compared");
  return `| ${label} | ${v.filter((x) => x === "agree").length} of ${v.length} | ${pct(v.filter((x) => x === "agree").length, v.length)} |`;
};
const cell = (s: string) => s.replace(/\|/g, "\\|");
const mark = (v: Verdict) => (v === "agree" ? "✓" : v === "disagree" ? "✗" : "–");

const md = [
  "# Domain scanner validation",
  "",
  `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC against ${API} · ${rows.length} domains · ${rows.filter((r) => r.error).length} scan errors`,
  "",
  `**Overall agreement: ${agreed} of ${compared.length} comparisons (${pct(agreed, compared.length)}).**`,
  "",
  "| Check | Agreed | Rate |",
  "|---|---|---|",
  section("SPF policy", (r) => [r.spf.verdict]),
  section("DMARC policy", (r) => [r.dmarc.verdict]),
  ...HEADER_CHECKS.map((hc) => section(hc.name, (r) => r.headers.filter((h) => h.name === hc.name).map((h) => h.verdict))),
  "",
  "## How this was checked",
  "",
  "- **SPF and DMARC:** records fetched separately from Cloudflare's public DNS and read by a simple parser that shares no code with the app. SPF compares the final `all` rule; DMARC compares the `p=` policy. SPF records that use `redirect=` are not compared, because the simple parser doesn't follow them.",
  "- **Security headers:** fetched directly from each website and compared with the header values MSP Auditor recorded. Only presence is compared; the app's quality grade is shown in brackets. When the app couldn't reach a website (a timeout, or a page that blocks automated checks), it leaves the website ungraded and those rows are not compared.",
  "- **Mozilla Observatory:** an independent website grade, shown for context only. It weighs more headers than the app checks, so the grades aren't expected to match.",
  "",
  "## Results",
  "",
  "| Domain | MSP Auditor grade | SPF (ours / independent) | DMARC (ours / independent) | Headers agreed | Website pts | Mozilla Observatory |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((r) =>
    r.error
      ? `| ${r.domain} | error | ${cell(r.error)} | | | | ${cell(r.observatory)} |`
      : `| ${r.domain} | ${r.oursGrade} | ${mark(r.spf.verdict)} ${r.spf.ours} / ${r.spf.independent} | ${mark(r.dmarc.verdict)} ${r.dmarc.ours} / ${r.dmarc.independent} | ${r.headers.filter((h) => h.verdict === "agree").length}/${r.headers.filter((h) => h.verdict !== "not compared").length} | ${r.oursWeb} | ${cell(r.observatory)} |`,
  ),
  "",
  "## Disagreements to review",
  "",
  "Check each one by hand with the linked tools and note which side was right.",
  "",
  ...rows.flatMap((r) => {
    const d = [
      ...(r.spf.verdict === "disagree" ? [`SPF: ours \`${r.spf.ours}\`, independent \`${r.spf.independent}\``] : []),
      ...(r.dmarc.verdict === "disagree" ? [`DMARC: ours \`${r.dmarc.ours}\`, independent \`${r.dmarc.independent}\``] : []),
      ...r.headers.filter((h) => h.verdict === "disagree").map((h) => `${h.name}: ours ${h.ours}, independent ${h.independent}`),
      ...(r.error ? [r.error] : []),
    ];
    if (!d.length) return [];
    return [
      `**${r.domain}** · [MXToolbox SPF](https://mxtoolbox.com/SuperTool.aspx?action=spf%3a${r.domain}) · [MXToolbox DMARC](https://mxtoolbox.com/SuperTool.aspx?action=dmarc%3a${r.domain}) · [securityheaders.com](https://securityheaders.com/?q=${r.domain}&followRedirects=on)`,
      ...d.map((x) => `- ${x}`),
      "",
    ];
  }),
  ...(rows.some((r) => r.error || r.spf.verdict === "disagree" || r.dmarc.verdict === "disagree" || r.headers.some((h) => h.verdict === "disagree")) ? [] : ["None.", ""]),
].join("\n");

writeFileSync(OUT, md);
console.log(`\nOverall agreement: ${agreed} of ${compared.length} (${pct(agreed, compared.length)}). Report written to ${OUT}`);

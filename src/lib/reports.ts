/** Module 4 — Deliverable Engine: MSP tickets + board one-pager content (governance-r-17). */
import { RECOMMENDED_HEADERS } from "./domain/analyze";
import { formatUsd, letterGrade } from "./grading";
import type { IdentityAudit, AuditedUser } from "./identity";
import type { OrgProfile } from "./sampleData";
import type { ScorecardResult } from "./scorecard";
import type { DomainScanResult } from "./types";

export interface AuditContext {
  org: OrgProfile;
  domain: DomainScanResult | null;
  identity: IdentityAudit | null;
  scorecard: ScorecardResult;
}

// ---------------------------------------------------------------------------
// Composite grade
// ---------------------------------------------------------------------------

export interface CompositePart {
  key: "domain" | "identity" | "msp";
  label: string;
  score: number | null;
  grade: string | null;
  weight: number;
}

export function compositeScore(ctx: AuditContext): { score: number | null; grade: string | null; parts: CompositePart[] } {
  const msp = ctx.scorecard.answered ? Math.round((ctx.scorecard.score / (ctx.scorecard.answered * 10)) * 100) : null;
  const parts: CompositePart[] = [
    { key: "domain", label: "Email & Website Security", score: ctx.domain?.score ?? null, grade: ctx.domain?.grade ?? null, weight: 0.3 },
    { key: "identity", label: "Identity & License Hygiene", score: ctx.identity?.score ?? null, grade: ctx.identity?.grade ?? null, weight: 0.35 },
    { key: "msp", label: "MSP Accountability", score: msp, grade: msp === null ? null : letterGrade(msp), weight: 0.35 },
  ];
  const present = parts.filter((p) => p.score !== null);
  if (!present.length) return { score: null, grade: null, parts };
  const w = present.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(present.reduce((s, p) => s + p.score! * p.weight, 0) / w);
  return { score, grade: letterGrade(score), parts };
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export interface Ticket {
  id: 1 | 2 | 3;
  title: string;
  priority: "Critical" | "High" | "Medium";
  clinicIds: string[];
  findingCount: number;
  subject: string;
  body: string;
  ready: boolean;
  emptyReason?: string;
}

const today = () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function header(ctx: AuditContext, intro: string): string {
  return [`Hello ${ctx.org.mspName} Help Desk,`, "", intro, ""].join("\n");
}

function signature(ctx: AuditContext): string {
  return [
    "",
    "Please reply with an estimated completion date for each item and confirm in writing when complete.",
    "",
    "Thank you,",
    `${ctx.org.orgName} Leadership`,
    "",
    `— Generated ${today()} with the Cyber Ready Clinic "Trust, But Verify" MSP Auditor`,
  ].join("\n");
}

function userLine(u: AuditedUser, extra = ""): string {
  return `   • ${u.displayName} <${u.upn}>${u.title ? ` — ${u.title}` : ""}${extra}`;
}

function headerConfigSnippets(missing: (keyof typeof RECOMMENDED_HEADERS)[]): string {
  const canon: Record<string, string> = {
    "strict-transport-security": "Strict-Transport-Security",
    "content-security-policy": "Content-Security-Policy",
    "x-frame-options": "X-Frame-Options",
    "x-content-type-options": "X-Content-Type-Options",
    "referrer-policy": "Referrer-Policy",
  };
  const vercel = JSON.stringify(
    { headers: [{ source: "/(.*)", headers: missing.map((h) => ({ key: canon[h], value: RECOMMENDED_HEADERS[h] })) }] },
    null,
    2,
  );
  const nginx = missing.map((h) => `   add_header ${canon[h]} "${RECOMMENDED_HEADERS[h]}" always;`).join("\n");
  const apache = missing.map((h) => `   Header always set ${canon[h]} "${RECOMMENDED_HEADERS[h]}"`).join("\n");
  return [
    "   Option A — vercel.json (Vercel-hosted sites):",
    vercel.split("\n").map((l) => "   " + l).join("\n"),
    "",
    "   Option B — Nginx (server block):",
    nginx,
    "",
    "   Option C — Apache (.htaccess / vhost, requires mod_headers):",
    apache,
    "",
    "   WordPress / Squarespace / Wix: set these via the host's security-header setting or a CDN such as Cloudflare (Rules → Transform Rules → Response Headers).",
    "   Note: test the Content-Security-Policy in Report-Only mode first — donation widgets and analytics may need their domains allow-listed.",
  ].join("\n");
}

function ticketEmail(ctx: AuditContext): Ticket {
  const d = ctx.domain;
  const base = { id: 1 as const, title: "Email Authentication & Domain Hardening", clinicIds: ["email-securi-15", "website-atta-05"] };
  if (!d) return { ...base, priority: "High", findingCount: 0, subject: "", body: "", ready: false, emptyReason: "Run the Domain & Website Scanner (Tab 1) to generate this ticket." };
  const failing = d.checks.filter((c) => c.status === "fail" || c.status === "warn");
  const email = failing.filter((c) => c.category === "email");
  const web = failing.filter((c) => c.category === "web");
  const lines: string[] = [];
  lines.push(header(ctx, `A passive security scan of ${d.domain} on ${new Date(d.scannedAt).toLocaleDateString("en-US")} (Domain & Web grade: ${d.grade}, ${d.score}/100) found the following items that need to be corrected. These protect our donors, staff, and partners from emails that impersonate our organization.`));
  let n = 1;
  if (email.length) {
    lines.push("EMAIL AUTHENTICATION (SPF / DKIM / DMARC)");
    lines.push("─".repeat(44));
    for (const c of email) {
      lines.push(`${n++}. ${c.label}: ${c.summary}`);
      if (c.raw.length) lines.push(`   Current record:  ${c.raw[0]}`);
      for (const note of c.notes.filter((x) => !x.startsWith("Probed"))) lines.push(`   Note: ${note}`);
      if (c.fix) lines.push(`   Requested change:\n   ${c.fix.split("\n").join("\n   ")}`);
      lines.push("");
    }
    if (d.dmarc.policy !== "reject") {
      lines.push("   DMARC rollout: confirm all legitimate senders (Microsoft 365/Google, Mailchimp, Constant Contact, donor CRM, etc.) pass SPF or DKIM in the rua reports, then advance p=none → p=quarantine → p=reject within 30 days.");
      lines.push("");
    }
  }
  if (web.length) {
    lines.push("WEBSITE HTTP SECURITY HEADERS");
    lines.push("─".repeat(44));
    for (const c of web) {
      lines.push(`${n++}. ${c.label}: ${c.summary}`);
      if (c.fix) lines.push(`   Requested: ${c.fix}`);
    }
    const missing = web
      .map((c) => ({ hsts: "strict-transport-security", csp: "content-security-policy", xfo: "x-frame-options", xcto: "x-content-type-options", referrer: "referrer-policy" })[c.id as string])
      .filter(Boolean) as (keyof typeof RECOMMENDED_HEADERS)[];
    if (missing.length) {
      lines.push("");
      lines.push("   Example configuration:");
      lines.push(headerConfigSnippets(missing));
    }
    lines.push("");
  }
  if (!d.web.available) lines.push("(Website headers were not checked in this scan mode — please also verify HSTS, CSP, X-Frame-Options, X-Content-Type-Options and Referrer-Policy.)\n");
  if (!failing.length) lines.push("All email authentication and website header checks passed. Please confirm these settings are monitored for drift.\n");
  lines.push(signature(ctx));
  const critical = d.checks.some((c) => (c.id === "dmarc" || c.id === "spf") && c.status === "fail");
  return {
    ...base,
    priority: critical ? "Critical" : failing.length ? "High" : "Medium",
    findingCount: failing.length,
    subject: `[${critical ? "CRITICAL" : "HIGH"}] Email Authentication & Domain Hardening — ${d.domain}`,
    body: lines.join("\n"),
    ready: true,
  };
}

function ticketIdentity(ctx: AuditContext): Ticket {
  const a = ctx.identity;
  const base = { id: 2 as const, title: "Identity Hygiene, MFA Enforcement & License Reclamation", clinicIds: ["identity-sec-17", "identity-sec-21", "identity-sec-22", "asset-manage-11"] };
  if (!a) return { ...base, priority: "High", findingCount: 0, subject: "", body: "", ready: false, emptyReason: "Upload a user export or load the sample tenant in Tab 2 to generate this ticket." };
  const lines: string[] = [];
  lines.push(header(ctx, `A review of our user directory export (${a.totalAccounts} accounts, MFA coverage ${a.mfaCoveragePct}%) identified the following identity risks. Please action them in priority order.`));
  let n = 1;
  if (a.adminsWithoutMfa.length) {
    lines.push(`${n++}. [CRITICAL] Global Admin accounts WITHOUT MFA — enforce phishing-resistant MFA today (identity-sec-22):`);
    a.adminsWithoutMfa.forEach((u) => lines.push(userLine(u)));
    lines.push("");
  }
  const nonAdminNoMfa = a.missingMfa.filter((u) => !u.isGlobalAdmin);
  if (nonAdminNoMfa.length) {
    lines.push(`${n++}. Enforce MFA (Authenticator app or security key, not SMS) for these ${nonAdminNoMfa.length} enabled accounts (identity-sec-17):`);
    nonAdminNoMfa.forEach((u) => lines.push(userLine(u)));
    lines.push("   Then enable Conditional Access / Security Defaults so no new account can be created without MFA.");
    lines.push("");
  }
  if (a.stale.length) {
    lines.push(`${n++}. Disable sign-in, revoke sessions, and offboard these ${a.stale.length} dormant accounts (no sign-in for >90 days) (identity-sec-21):`);
    a.stale.forEach((u) => lines.push(userLine(u, ` — last sign-in: ${u.daysSinceSignIn === null ? "never" : `${u.daysSinceSignIn} days ago`}`)));
    lines.push("   Convert to shared mailboxes or export mailbox data first if records retention requires it.");
    lines.push("");
  }
  if (a.adminSprawl !== "ok" || a.globalAdmins.length > 2) {
    lines.push(`${n++}. Reduce Global/Super Admin accounts from ${a.globalAdmins.length} to 2 named break-glass/MSP admins (identity-sec-22):`);
    a.globalAdmins.forEach((u) => lines.push(userLine(u, u.mfa === false ? " — MFA DISABLED" : "")));
    lines.push("   Assign least-privilege roles (User Admin, Billing Admin, Exchange Admin) to everyone else, and use separate admin accounts from daily-use mailboxes.");
    lines.push("");
  }
  if (a.wasted.length) {
    lines.push(`${n++}. Remove paid licenses from these ${a.wasted.length} disabled/dormant accounts — saves ${formatUsd(a.monthlyWaste)}/month = ${formatUsd(a.annualWaste)}/year (asset-manage-11):`);
    a.wasted.forEach((u) => lines.push(userLine(u, ` — ${u.license} (${formatUsd(u.monthlyCost)}/mo)`)));
    lines.push("   Please also reduce the license count on our next invoice accordingly.");
    lines.push("");
  }
  const findingCount = a.missingMfa.length + a.stale.length + a.wasted.length + (a.adminSprawl !== "ok" ? 1 : 0);
  if (!findingCount) lines.push("No identity hygiene issues were found. Please confirm MFA enforcement is policy-based (Conditional Access) and reviewed quarterly.\n");
  lines.push(signature(ctx));
  const critical = a.adminsWithoutMfa.length > 0;
  return {
    ...base,
    priority: critical ? "Critical" : findingCount ? "High" : "Medium",
    findingCount,
    subject: `[${critical ? "CRITICAL" : "HIGH"}] Identity Hygiene, MFA Enforcement & License Reclamation — ${ctx.org.orgName}`,
    body: lines.join("\n"),
    ready: true,
  };
}

function ticketGovernance(ctx: AuditContext): Ticket {
  const s = ctx.scorecard;
  const base = { id: 3 as const, title: "MSP Security Baseline & SLA Governance Alignment", clinicIds: ["vendors-msps-08", "vendors-msps-02", "identity-sec-24"] };
  if (!s.answered) return { ...base, priority: "High", findingCount: 0, subject: "", body: "", ready: false, emptyReason: "Answer the 10-Question MSP Report Card (Tab 3) to generate this ticket." };
  const lines: string[] = [];
  lines.push(header(ctx, `We completed a 10-point MSP security accountability review (score ${s.score}/${s.answered * 10}). We would like to formally request the following services and evidence be added to our support agreement. Items marked "Unsure" mean we need written confirmation and evidence.`));
  s.gaps.forEach(({ q, answer }, i) => {
    lines.push(`${i + 1}. ${q.title} [${answer === "no" ? "NOT IN PLACE" : "UNSURE / PARTIAL — evidence requested"}] (${q.clinicIds.join(", ")})`);
    lines.push(`   Request: ${q.action}`);
    lines.push(`   Question for your team: ${q.askMsp}`);
    lines.push("");
  });
  if (!s.gaps.length) lines.push("All 10 baseline controls were confirmed. Please provide the supporting evidence (reports, SOPs) at our next quarterly business review.\n");
  lines.push("We would like to review progress on these items at a meeting within the next 30 days.");
  lines.push(signature(ctx));
  const critical = s.gaps.some((g) => g.answer === "no" && (g.q.id === "q2" || g.q.id === "q3" || g.q.id === "q1"));
  return {
    ...base,
    priority: critical ? "Critical" : s.gaps.length ? "High" : "Medium",
    findingCount: s.gaps.length,
    subject: `[${critical ? "CRITICAL" : "HIGH"}] MSP Security Baseline & SLA Governance Alignment — ${ctx.org.orgName}`,
    body: lines.join("\n"),
    ready: true,
  };
}

export function generateTickets(ctx: AuditContext): Ticket[] {
  return [ticketEmail(ctx), ticketIdentity(ctx), ticketGovernance(ctx)];
}

export function mailtoHref(to: string, t: Ticket): string {
  // Some mail clients truncate very long mailto bodies; the copy button is the reliable path.
  const body = t.body.length > 6000 ? t.body.slice(0, 6000) + "\n\n[Truncated — paste the full ticket from the auditor]" : t.body;
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(body)}`;
}

// ---------------------------------------------------------------------------
// Board one-pager
// ---------------------------------------------------------------------------

export interface BoardRisk {
  key: "fraud" | "ransomware" | "compliance";
  title: string;
  level: "High" | "Elevated" | "Low" | "Not assessed";
  narrative: string;
  drivers: string[];
}

export interface QuickWin {
  title: string;
  detail: string;
  effort: string;
}

export function boardRisks(ctx: AuditContext): BoardRisk[] {
  const d = ctx.domain;
  const a = ctx.identity;
  const gapIds = new Set(ctx.scorecard.gaps.map((g) => g.q.id));
  const gapNo = new Set(ctx.scorecard.gaps.filter((g) => g.answer === "no").map((g) => g.q.id));
  const level = (pts: number, assessed: boolean): BoardRisk["level"] => (!assessed ? "Not assessed" : pts >= 4 ? "High" : pts >= 2 ? "Elevated" : "Low");
  const qTitle = (id: string) => ctx.scorecard.gaps.find((g) => g.q.id === id)?.q.title ?? id;

  // Financial fraud / Business Email Compromise
  const fraud: string[] = [];
  let fp = 0;
  const addF = (pts: number, why: string) => {
    fp += pts;
    fraud.push(why);
  };
  if (d) {
    if (!d.dmarc.record || d.dmarc.policy === "none") addF(3, d.dmarc.record ? "DMARC is 'monitor only' — spoofed emails are still delivered" : "No DMARC policy — anyone can send email as our domain");
    else if (d.dmarc.policy === "quarantine") addF(1, "DMARC quarantines (not rejects) spoofed email");
    if (d.spf.allQualifier !== "-") addF(1, "SPF does not hard-fail unauthorized senders");
  }
  if (a?.missingMfa.length) addF(a.adminsWithoutMfa.length ? 3 : 2, `${a.missingMfa.length} active accounts have no MFA${a.adminsWithoutMfa.length ? `, including ${a.adminsWithoutMfa.length} Global Admin` : ""}`);
  for (const id of ["q2", "q7", "q1"]) if (gapIds.has(id)) addF(gapNo.has(id) ? 2 : 1, `MSP gap: ${qTitle(id)}`);

  // Ransomware downtime
  const rans: string[] = [];
  let rp = 0;
  const addR = (pts: number, why: string) => {
    rp += pts;
    rans.push(why);
  };
  for (const id of ["q3", "q4", "q5", "q8"]) if (gapIds.has(id)) addR(gapNo.has(id) ? 2 : 1, `MSP gap: ${qTitle(id)}`);
  if (a?.adminsWithoutMfa.length) addR(2, "An administrator account without MFA is a direct path to tenant-wide ransomware");
  if (a && a.globalAdmins.length > 3) addR(1, `${a.globalAdmins.length} Global Admins (recommended: 2)`);
  if (d?.web.available && d.checks.some((c) => c.category === "web" && c.status === "fail")) addR(1, "Website missing baseline security headers");

  // Compliance / grant / insurance
  const comp: string[] = [];
  let cp = 0;
  const addC = (pts: number, why: string) => {
    cp += pts;
    comp.push(why);
  };
  if (a?.stale.length) addC(2, `${a.stale.length} former staff/inactive accounts still have access to organizational data`);
  if (a?.wasted.length) addC(1, `${formatUsd(a.annualWaste)}/year spent on licenses for inactive accounts`);
  for (const id of ["q6", "q9", "q10"]) if (gapIds.has(id)) addC(gapNo.has(id) ? 2 : 1, `MSP gap: ${qTitle(id)}`);

  const answered = ctx.scorecard.answered > 0;
  return [
    {
      key: "fraud",
      title: "Financial Fraud & Business Email Compromise",
      level: level(fp, !!d || !!a || answered),
      narrative:
        "Criminals impersonate our Executive Director or finance staff by email to redirect grant payments, payroll, or vendor invoices. Weak email authentication and missing MFA make these scams easy to pull off and hard to detect.",
      drivers: fraud,
    },
    {
      key: "ransomware",
      title: "Ransomware & Service Downtime",
      level: level(rp, !!a || answered),
      narrative:
        "A ransomware attack could lock client case files and halt programs for days or weeks. Recovery depends on tested backups, monitored endpoint protection, and limiting who holds administrator rights.",
      drivers: rans,
    },
    {
      key: "compliance",
      title: "Compliance, Grant & Insurance Risk",
      level: level(cp, !!a || answered),
      narrative:
        "Funders, cyber insurers, and privacy laws increasingly require proof of access controls, offboarding, asset inventory, and an incident response plan. Gaps can jeopardize grant eligibility and insurance claims.",
      drivers: comp,
    },
  ];
}

export function quickWins(ctx: AuditContext): QuickWin[] {
  const wins: QuickWin[] = [];
  const d = ctx.domain;
  const a = ctx.identity;
  const gap = (id: string) => ctx.scorecard.gaps.some((g) => g.q.id === id);
  if (a?.adminsWithoutMfa.length) wins.push({ title: `Turn on MFA for ${a.adminsWithoutMfa.length} unprotected administrator account${a.adminsWithoutMfa.length > 1 ? "s" : ""}`, detail: a.adminsWithoutMfa.map((u) => u.displayName).join(", "), effort: "Today · $0" });
  if (a && a.missingMfa.length > a.adminsWithoutMfa.length) wins.push({ title: `Enforce MFA for the ${a.missingMfa.length - a.adminsWithoutMfa.length} remaining accounts without it`, detail: "Moves MFA coverage to 100%", effort: "1 week · $0" });
  if (d && d.dmarc.policy !== "reject") wins.push({ title: `Advance DMARC to ${d.dmarc.policy === "quarantine" ? "p=reject" : "p=quarantine"}`, detail: "Stops criminals from sending email that appears to come from us", effort: "30 min DNS change · $0" });
  if (a?.wasted.length) wins.push({ title: `Offboard ${a.wasted.length} dormant accounts & reclaim licenses`, detail: `Saves ${formatUsd(a.annualWaste)} per year`, effort: "1 hour · saves money" });
  if (a && a.globalAdmins.length > 3) wins.push({ title: `Reduce Global Admins from ${a.globalAdmins.length} to 2`, detail: "Shrinks the number of 'master keys' to our data", effort: "1 hour · $0" });
  if (gap("q2")) wins.push({ title: "Require help-desk caller verification", detail: "Prevents social-engineering password resets", effort: "MSP process change" });
  if (gap("q3")) wins.push({ title: "Schedule a backup restore fire drill", detail: "Proves we can recover from ransomware", effort: "MSP task · 30 days" });
  if (d && d.spf.allQualifier !== "-" && d.spf.record) wins.push({ title: "Change SPF ~all to -all", detail: "Tells mail servers to reject unauthorized senders", effort: "15 min DNS change · $0" });
  if (gap("q10")) wins.push({ title: "Create a one-page incident call tree", detail: "Who to call on a weekend during wire fraud or ransomware", effort: "1-hour meeting" });
  return wins.slice(0, 6);
}

// Checks MSP Auditor's identity audit against an answer key you wrote BEFORE running it.
//
//   npm run validate:tenant -- --export client-data/lab-users.csv --key client-data/lab-answer-key.json
//   npm run validate:tenant -- --export public/sample-hope-valley-users.csv --key validation/answer-key.hope-valley.json --as-of 2026-10-22
//
// The answer key records what you know to be true about each account in your test tenant
// (see validation/README.md). This script runs the same parser and rules the website uses,
// compares them account by account, and writes validation/tenant-results.md.
// Keep real exports in client-data/ (git-ignored); never commit them.
import { readFileSync, writeFileSync } from "node:fs";
import { auditUsers, parseUsers, type AuditedUser } from "../src/lib/identity.ts";

interface KeyAccount {
  /** MFA registered/enforced. */
  mfa: boolean;
  /** Account can sign in. */
  enabled: boolean;
  globalAdmin: boolean;
  /** Enabled, and no sign-in for more than 90 days (or never). */
  stale: boolean;
  /** Holds a paid license. */
  paidLicense: boolean;
}
interface AnswerKey {
  tenant: string;
  /** The date the export was taken (YYYY-MM-DD), so "days since sign-in" is measured from then. */
  exportedOn?: string;
  accounts: Record<string, KeyAccount>;
}

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const exportPath = arg("export");
const keyPath = arg("key");
const out = arg("out") ?? "validation/tenant-results.md";
if (!exportPath || !keyPath) {
  console.error("Usage: npm run validate:tenant -- --export <users.csv> --key <answer-key.json> [--as-of YYYY-MM-DD] [--out report.md]");
  process.exit(1);
}

const key: AnswerKey = JSON.parse(readFileSync(keyPath, "utf8"));
const asOf = new Date(`${arg("as-of") ?? key.exportedOn ?? new Date().toISOString().slice(0, 10)}T23:59:59Z`);
const { users, warnings } = parseUsers(readFileSync(exportPath, "utf8"));
const audit = auditUsers(users, exportPath, warnings, asOf);

const norm = (s: string) => s.trim().toLowerCase();
const byUpn = new Map(audit.users.map((u) => [norm(u.upn || u.displayName), u]));

type Field = "MFA missing" | "Global Admin" | "Stale" | "License waste";
const FIELDS: { field: Field; expected: (k: KeyAccount) => boolean; actual: (u: AuditedUser) => boolean }[] = [
  { field: "MFA missing", expected: (k) => k.enabled && !k.mfa, actual: (u) => u.flags.includes("NO_MFA") || u.flags.includes("ADMIN_NO_MFA") },
  { field: "Global Admin", expected: (k) => k.enabled && k.globalAdmin, actual: (u) => u.flags.includes("GLOBAL_ADMIN") },
  { field: "Stale", expected: (k) => k.enabled && k.stale, actual: (u) => u.flags.includes("STALE") },
  { field: "License waste", expected: (k) => k.paidLicense && (!k.enabled || k.stale), actual: (u) => u.flags.includes("LICENSE_WASTE") },
];

const tally = Object.fromEntries(FIELDS.map((f) => [f.field, { tp: 0, fp: 0, fn: 0, tn: 0 }])) as Record<Field, { tp: number; fp: number; fn: number; tn: number }>;
const mismatches: string[] = [];
const missing: string[] = [];

for (const [upn, k] of Object.entries(key.accounts)) {
  const u = byUpn.get(norm(upn));
  if (!u) {
    missing.push(upn);
    continue;
  }
  for (const f of FIELDS) {
    const e = f.expected(k);
    const a = f.actual(u);
    const t = tally[f.field];
    if (e && a) t.tp++;
    else if (!e && !a) t.tn++;
    else if (a) {
      t.fp++;
      mismatches.push(`| ${upn} | ${f.field} | not expected | flagged (false positive) |`);
    } else {
      t.fn++;
      mismatches.push(`| ${upn} | ${f.field} | expected | not flagged (missed) |`);
    }
  }
}
const keyed = new Set(Object.keys(key.accounts).map(norm));
const extra = audit.users.filter((u) => !keyed.has(norm(u.upn || u.displayName))).map((u) => u.upn || u.displayName);

const checks = Object.values(tally).reduce((s, t) => s + t.tp + t.tn + t.fp + t.fn, 0);
const correct = Object.values(tally).reduce((s, t) => s + t.tp + t.tn, 0);
const pct = (n: number, d: number) => (d ? `${Math.round((n * 100) / d)}%` : "–");

const md = [
  "# Identity audit validation",
  "",
  `Tenant: **${key.tenant}** · export \`${exportPath}\` · measured as of ${asOf.toISOString().slice(0, 10)}`,
  "",
  `**${correct} of ${checks} account-level checks correct (${pct(correct, checks)}).** ${mismatches.length} mismatch${mismatches.length === 1 ? "" : "es"}, ${missing.length} answer-key account${missing.length === 1 ? "" : "s"} missing from the export, ${extra.length} export account${extra.length === 1 ? "" : "s"} not in the answer key.`,
  "",
  "| Finding | Correctly flagged | Correctly not flagged | False positives | Missed |",
  "|---|---|---|---|---|",
  ...FIELDS.map(({ field }) => {
    const t = tally[field];
    return `| ${field} | ${t.tp} | ${t.tn} | ${t.fp} | ${t.fn} |`;
  }),
  "",
  "## Totals",
  "",
  "| | MSP Auditor | Answer key |",
  "|---|---|---|",
  `| Accounts | ${audit.totalAccounts} | ${Object.keys(key.accounts).length} |`,
  `| Missing MFA | ${audit.missingMfa.length} | ${Object.values(key.accounts).filter((k) => k.enabled && !k.mfa).length} |`,
  `| Global Admins | ${audit.globalAdmins.length} | ${Object.values(key.accounts).filter((k) => k.enabled && k.globalAdmin).length} |`,
  `| Stale | ${audit.stale.length} | ${Object.values(key.accounts).filter((k) => k.enabled && k.stale).length} |`,
  `| License waste | ${audit.wasted.length} | ${Object.values(key.accounts).filter((k) => k.paidLicense && (!k.enabled || k.stale)).length} |`,
  "",
  ...(mismatches.length ? ["## Mismatches", "", "| Account | Finding | Answer key | MSP Auditor |", "|---|---|---|---|", ...mismatches, ""] : ["## Mismatches", "", "None.", ""]),
  ...(missing.length ? ["## In the answer key but not the export", "", ...missing.map((m) => `- ${m}`), ""] : []),
  ...(extra.length ? ["## In the export but not the answer key", "", ...extra.map((m) => `- ${m}`), ""] : []),
  ...(audit.warnings.length ? ["## Warnings the tool showed", "", ...audit.warnings.map((w) => `- ${w}`), ""] : []),
].join("\n");

writeFileSync(out, md);
console.log(`${correct} of ${checks} checks correct (${pct(correct, checks)}); ${mismatches.length} mismatches, ${missing.length} missing, ${extra.length} extra. Report: ${out}`);
if (mismatches.length || missing.length) process.exitCode = 1;

/**
 * Module 2 — Identity, Access & License Waste Auditor.
 * Runs entirely in the browser: the CSV never leaves the user's machine.
 */
import { letterGrade } from "./grading";

export const STALE_DAYS = 90;
export const DEFAULT_LICENSE_COST = 22;

export type AccountType = "Member" | "Guest" | "Shared/Service";

export interface UserRow {
  displayName: string;
  upn: string;
  title: string;
  enabled: boolean;
  mfa: boolean | null;
  lastSignIn: Date | null;
  role: string;
  isGlobalAdmin: boolean;
  license: string;
  isPaid: boolean;
  monthlyCost: number;
  accountType: AccountType;
}

export type FlagCode = "ADMIN_NO_MFA" | "NO_MFA" | "STALE" | "LICENSE_WASTE" | "GLOBAL_ADMIN";

export interface AuditedUser extends UserRow {
  daysSinceSignIn: number | null;
  stale: boolean;
  flags: FlagCode[];
  severity: "critical" | "warning" | "ok";
}

export interface IdentityAudit {
  source: string;
  totalAccounts: number;
  enabledAccounts: number;
  mfaCoveragePct: number;
  missingMfa: AuditedUser[];
  stale: AuditedUser[];
  globalAdmins: AuditedUser[];
  adminsWithoutMfa: AuditedUser[];
  adminSprawl: "ok" | "warning" | "critical";
  wasted: AuditedUser[];
  monthlyWaste: number;
  annualWaste: number;
  score: number;
  grade: string;
  users: AuditedUser[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// CSV parsing (RFC 4180: quoted fields, escaped quotes, CRLF, BOM)
// ---------------------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(","))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Header normalization — Microsoft 365 / Entra ID and Google Workspace exports
// ---------------------------------------------------------------------------

type Field = "displayName" | "upn" | "title" | "enabled" | "blocked" | "mfa" | "lastSignIn" | "role" | "license" | "monthlyCost" | "accountType";

const HEADER_ALIASES: Record<Field, string[]> = {
  displayName: ["displayname", "name", "fullname", "username", "user"],
  title: ["jobtitle", "title", "position"],
  upn: ["userprincipalname", "email", "emailaddress", "primaryemail", "upn", "mail", "emailaddressrequired"],
  enabled: ["accountenabled", "status", "enabled", "userstatus", "accountstatus", "statusreadonly"],
  blocked: ["blockcredential", "signinblocked", "blocksignin", "suspended"],
  mfa: ["mfastatus", "mfa", "2svenrolled", "2svenforced", "isenrolledin2sv", "mfaenabled", "strongauthentication", "2svenrolledreadonly", "multifactorauthstatus", "permfastate"],
  lastSignIn: ["lastsignindatetime", "lastsignin", "lastlogin", "lastlogintime", "lastsignedin", "lastsignindate", "lastinteractivesignin", "lastsignintimereadonly", "lastactivity"],
  role: ["role", "adminroles", "roles", "adminrole", "directoryroles", "isadmin", "admin"],
  license: ["licenses", "assignedlicense", "assignedlicenses", "license", "licensesku", "skus", "assignedproducts"],
  monthlyCost: ["monthlycost", "costpermonth", "licensecost", "monthlylicensecost", "cost"],
  accountType: ["accounttype", "usertype", "type", "recipienttype"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\[.*?\]|\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
}

export function mapHeaders(headers: string[]): { map: Partial<Record<Field, number>>; unmapped: string[] } {
  const map: Partial<Record<Field, number>> = {};
  const unmapped: string[] = [];
  headers.forEach((h, idx) => {
    const n = normalizeHeader(h);
    const field = (Object.keys(HEADER_ALIASES) as Field[]).find((f) => map[f] === undefined && HEADER_ALIASES[f].includes(n));
    if (field) map[field] = idx;
    else unmapped.push(h);
  });
  return { map, unmapped };
}

const truthy = (v: string) => /^(true|yes|y|1|enabled|enforced|enrolled|active|on|registered|capable)$/i.test(v.trim());
const falsy = (v: string) => /^(false|no|n|0|disabled|not enrolled|notenrolled|none|off|suspended|blocked|inactive|deleted|archived|not registered)$/i.test(v.trim());

function parseEnabled(v: string | undefined, blocked: string | undefined): boolean {
  if (blocked !== undefined && blocked.trim() !== "" && truthy(blocked)) return false;
  if (v === undefined || v.trim() === "") return true;
  if (falsy(v)) return false;
  return true;
}

function parseMfa(v: string | undefined): boolean | null {
  if (v === undefined || v.trim() === "") return null;
  if (truthy(v)) return true;
  if (falsy(v)) return false;
  return null;
}

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const t = v.trim();
  if (!t || /^(never|n\/a|none|-|null)$/i.test(t)) return null;
  // Google exports like "2025/03/14 09:12:00 UTC"
  const d = new Date(t.replace(/^(\d{4})\/(\d{2})\/(\d{2})/, "$1-$2-$3").replace(/ UTC$/, "Z"));
  return isNaN(d.getTime()) ? null : d;
}

function parseAccountType(v: string | undefined, upn: string, name: string): AccountType {
  const s = `${v ?? ""}`.toLowerCase();
  if (/guest/.test(s) || upn.includes("#ext#")) return "Guest";
  if (/shared|service|room|resource|equipment/.test(s)) return "Shared/Service";
  if (!s && /^(info|admin|office|donations|noreply|no-reply|scanner|frontdesk)@/i.test(upn)) return "Shared/Service";
  if (!s && /shared mailbox|service account/i.test(name)) return "Shared/Service";
  return "Member";
}

export function isGlobalAdminRole(role: string): boolean {
  return /global\s*admin|super\s*admin|company\s*administrator|global\s*administrator|^true$|^yes$/i.test(role.trim());
}

export function isPaidLicense(license: string): boolean {
  const l = license.trim();
  return !!l && !/^(unlicensed|none|n\/a|-|free|no license|0)$/i.test(l);
}

export function parseUsers(text: string): { users: UserRow[]; warnings: string[] } {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  if (rows.length < 2) throw new Error("The CSV has no data rows. Check that you exported the user list with a header row.");
  const { map, unmapped } = mapHeaders(rows[0]);
  if (map.upn === undefined && map.displayName === undefined) {
    throw new Error(`Couldn't find a name or email column. Detected headers: ${rows[0].join(", ")}`);
  }
  if (map.mfa === undefined) warnings.push("No MFA column detected — MFA coverage cannot be measured.");
  if (map.lastSignIn === undefined) warnings.push("No last sign-in column detected — stale accounts cannot be measured.");
  if (map.license === undefined) warnings.push("No license column detected — license waste cannot be measured.");
  if (map.monthlyCost === undefined && map.license !== undefined) warnings.push(`No monthlyCost column — paid licenses assumed at $${DEFAULT_LICENSE_COST}/mo.`);
  if (unmapped.length) warnings.push(`Ignored columns: ${unmapped.join(", ")}`);

  const get = (r: string[], f: Field) => (map[f] !== undefined ? r[map[f]!] : undefined);
  const users = rows.slice(1).map((r) => {
    const upn = (get(r, "upn") ?? "").trim();
    const displayName = (get(r, "displayName") ?? "").trim() || upn;
    const role = (get(r, "role") ?? "").trim() || "User";
    const license = (get(r, "license") ?? "").trim();
    const isPaid = isPaidLicense(license);
    const costRaw = get(r, "monthlyCost");
    const parsedCost = costRaw ? Number(costRaw.replace(/[$,\s]/g, "")) : NaN;
    return {
      displayName,
      upn,
      title: (get(r, "title") ?? "").trim(),
      enabled: parseEnabled(get(r, "enabled"), get(r, "blocked")),
      mfa: parseMfa(get(r, "mfa")),
      lastSignIn: parseDate(get(r, "lastSignIn")),
      role,
      isGlobalAdmin: isGlobalAdminRole(role),
      license: license || "Unlicensed",
      isPaid,
      monthlyCost: isPaid ? (isNaN(parsedCost) ? DEFAULT_LICENSE_COST : parsedCost) : 0,
      accountType: parseAccountType(get(r, "accountType"), upn, displayName),
    } satisfies UserRow;
  });
  return { users, warnings };
}

// ---------------------------------------------------------------------------
// Audit rules
// ---------------------------------------------------------------------------

export function auditUsers(users: UserRow[], source: string, warnings: string[] = [], now = new Date()): IdentityAudit {
  const hasSignInData = users.some((u) => u.lastSignIn);
  const audited: AuditedUser[] = users.map((u) => {
    const days = u.lastSignIn ? Math.floor((now.getTime() - u.lastSignIn.getTime()) / 86_400_000) : null;
    const stale = u.enabled && hasSignInData && u.accountType !== "Shared/Service" && (days === null || days > STALE_DAYS);
    const flags: FlagCode[] = [];
    if (u.enabled && u.mfa === false) flags.push(u.isGlobalAdmin ? "ADMIN_NO_MFA" : "NO_MFA");
    if (stale) flags.push("STALE");
    if (u.isPaid && (!u.enabled || stale)) flags.push("LICENSE_WASTE");
    if (u.isGlobalAdmin && u.enabled) flags.push("GLOBAL_ADMIN");
    const severity: AuditedUser["severity"] = flags.some((f) => f === "ADMIN_NO_MFA" || f === "NO_MFA" || (f === "STALE" && u.isGlobalAdmin))
      ? "critical"
      : flags.some((f) => f !== "GLOBAL_ADMIN")
        ? "warning"
        : "ok";
    return { ...u, daysSinceSignIn: days, stale, flags, severity };
  });

  const enabled = audited.filter((u) => u.enabled);
  const mfaKnown = enabled.filter((u) => u.mfa !== null && u.accountType !== "Shared/Service");
  const mfaOn = mfaKnown.filter((u) => u.mfa);
  const mfaCoveragePct = mfaKnown.length ? Math.round((mfaOn.length / mfaKnown.length) * 100) : 100;
  const missingMfa = enabled.filter((u) => u.mfa === false);
  const stale = audited.filter((u) => u.stale);
  const globalAdmins = enabled.filter((u) => u.isGlobalAdmin);
  const adminsWithoutMfa = globalAdmins.filter((u) => u.mfa === false);
  const memberCount = Math.max(1, enabled.filter((u) => u.accountType === "Member").length);
  const adminSprawl: IdentityAudit["adminSprawl"] = adminsWithoutMfa.length
    ? "critical"
    : globalAdmins.length > 3 || globalAdmins.length / memberCount > 0.1
      ? "warning"
      : "ok";
  const wasted = audited.filter((u) => u.flags.includes("LICENSE_WASTE"));
  const monthlyWaste = Math.round(wasted.reduce((s, u) => s + u.monthlyCost, 0) * 100) / 100;

  // Score: MFA 40 · stale 20 · admin hygiene 20 · license hygiene 20
  const mfaPts = 40 * (mfaCoveragePct / 100);
  const stalePts = Math.max(0, 20 - stale.length * 4);
  const adminPts = Math.max(0, 20 - (globalAdmins.length > 3 || globalAdmins.length / memberCount > 0.1 ? 6 : 0) - adminsWithoutMfa.length * 10);
  const licensePts = Math.max(0, 20 - wasted.length * 4);
  const score = Math.round(mfaPts + stalePts + adminPts + licensePts);

  return {
    source,
    totalAccounts: audited.length,
    enabledAccounts: enabled.length,
    mfaCoveragePct,
    missingMfa,
    stale,
    globalAdmins,
    adminsWithoutMfa,
    adminSprawl,
    wasted,
    monthlyWaste,
    annualWaste: Math.round(monthlyWaste * 12 * 100) / 100,
    score,
    grade: letterGrade(score),
    users: audited,
    warnings,
  };
}

export function auditCsv(text: string, source: string): IdentityAudit {
  const { users, warnings } = parseUsers(text);
  return auditUsers(users, source, warnings);
}

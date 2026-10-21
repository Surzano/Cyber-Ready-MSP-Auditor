/**
 * Synthetic, sanitized demo data for the fictional "Hope Valley Community Services".
 * Every name and address here is invented. Never add real client data to this file.
 *
 * Kept free of runtime imports so `npm run sample:csv` can load it directly with Node.
 */
import type { Answers } from "./scorecard";

export interface OrgProfile {
  orgName: string;
  staffCount: number;
  mspName: string;
  mspEmail: string;
  domain: string;
  preparedBy: string;
}

export const SAMPLE_ORG: OrgProfile = {
  orgName: "Hope Valley Community Services",
  staffCount: 24,
  mspName: "Apex IT MSP",
  mspEmail: "helpdesk@apex-it-msp.example",
  domain: "hopevalleycs.org",
  preparedBy: "Surzano R. Solomon, Cyber Ready Clinic",
};

export const CSV_HEADERS = [
  "displayName",
  "userPrincipalName",
  "jobTitle",
  "accountEnabled",
  "mfaStatus",
  "lastSignInDateTime",
  "role",
  "licenses",
  "monthlyCost",
  "accountType",
] as const;

interface SampleUser {
  name: string;
  user: string;
  title: string;
  enabled: boolean;
  mfa: "Enabled" | "Enforced" | "Disabled";
  /** Days before "today"; null = never signed in. */
  daysAgo: number | null;
  role: string;
  license: string;
  cost: number;
  type: "Member" | "Guest" | "Shared/Service";
}

const PREMIUM = "Microsoft 365 Business Premium";
const STANDARD = "Microsoft 365 Business Standard";
const BASIC = "Microsoft 365 Business Basic";

/*
 * Designed to produce exactly the case-study numbers from the spec:
 *  - 22 accounts · 4 enabled accounts without MFA (incl. 1 Global Admin)
 *  - 3 dormant ex-employees (>90 days) still holding $22/mo Business Premium = $792/yr
 *  - 5 Global Admins
 */
const USERS: SampleUser[] = [
  { name: "Margaret Chen", user: "margaret.chen", title: "Executive Director", enabled: true, mfa: "Enabled", daysAgo: 1, role: "Global Admin", license: PREMIUM, cost: 22, type: "Member" },
  { name: "David Okafor", user: "david.okafor", title: "Finance Director", enabled: true, mfa: "Enforced", daysAgo: 2, role: "User", license: PREMIUM, cost: 22, type: "Member" },
  { name: "Linda Park", user: "linda.park", title: "Operations Manager", enabled: true, mfa: "Enabled", daysAgo: 3, role: "Global Admin", license: PREMIUM, cost: 22, type: "Member" },
  { name: "Apex IT Admin", user: "apexadmin", title: "MSP Administrator", enabled: true, mfa: "Enforced", daysAgo: 5, role: "Global Admin", license: "Unlicensed", cost: 0, type: "Member" },
  { name: "Apex IT Technician", user: "apex.tech2", title: "MSP Technician", enabled: true, mfa: "Enabled", daysAgo: 9, role: "Global Admin", license: "Unlicensed", cost: 0, type: "Member" },
  { name: "Tom Reyes", user: "tom.reyes", title: "Volunteer IT Helper", enabled: true, mfa: "Disabled", daysAgo: 12, role: "Global Admin", license: STANDARD, cost: 12.5, type: "Member" },
  { name: "Robert Hayes", user: "robert.hayes", title: "Board Chair", enabled: true, mfa: "Disabled", daysAgo: 18, role: "User", license: BASIC, cost: 6, type: "Member" },
  { name: "Aisha Johnson", user: "aisha.johnson", title: "Volunteer Coordinator", enabled: true, mfa: "Disabled", daysAgo: 4, role: "User", license: STANDARD, cost: 12.5, type: "Member" },
  { name: "Kevin Walsh", user: "kevin.walsh", title: "Former Case Manager", enabled: true, mfa: "Disabled", daysAgo: 164, role: "User", license: PREMIUM, cost: 22, type: "Member" },
  { name: "Sarah Lindqvist", user: "sarah.lindqvist", title: "Former Grants Manager", enabled: true, mfa: "Enabled", daysAgo: 212, role: "User", license: PREMIUM, cost: 22, type: "Member" },
  { name: "Marcus Bell", user: "marcus.bell", title: "Former Development Associate", enabled: true, mfa: "Enabled", daysAgo: 131, role: "User", license: PREMIUM, cost: 22, type: "Member" },
  { name: "Jennifer Wu", user: "jennifer.wu", title: "Former Program Director", enabled: false, mfa: "Enabled", daysAgo: 240, role: "User", license: "Unlicensed", cost: 0, type: "Member" },
  { name: "Info Shared Mailbox", user: "info", title: "Shared Mailbox", enabled: false, mfa: "Disabled", daysAgo: null, role: "User", license: "Unlicensed", cost: 0, type: "Shared/Service" },
  { name: "Priya Natarajan", user: "priya.natarajan", title: "Program Director", enabled: true, mfa: "Enabled", daysAgo: 1, role: "User", license: PREMIUM, cost: 22, type: "Member" },
  { name: "James Carter", user: "james.carter", title: "Case Manager", enabled: true, mfa: "Enforced", daysAgo: 2, role: "User", license: PREMIUM, cost: 22, type: "Member" },
  { name: "Elena Rodriguez", user: "elena.rodriguez", title: "Case Manager", enabled: true, mfa: "Enabled", daysAgo: 1, role: "User", license: PREMIUM, cost: 22, type: "Member" },
  { name: "Samuel Brooks", user: "samuel.brooks", title: "Youth Program Lead", enabled: true, mfa: "Enabled", daysAgo: 6, role: "User", license: STANDARD, cost: 12.5, type: "Member" },
  { name: "Grace Kim", user: "grace.kim", title: "Development Director", enabled: true, mfa: "Enabled", daysAgo: 3, role: "User", license: PREMIUM, cost: 22, type: "Member" },
  { name: "Omar Haddad", user: "omar.haddad", title: "Communications Coordinator", enabled: true, mfa: "Enabled", daysAgo: 2, role: "User", license: STANDARD, cost: 12.5, type: "Member" },
  { name: "Rachel Green", user: "rachel.green", title: "HR & Office Manager", enabled: true, mfa: "Enforced", daysAgo: 1, role: "Billing Admin", license: PREMIUM, cost: 22, type: "Member" },
  { name: "Daniel Foster", user: "daniel.foster", title: "Food Pantry Coordinator", enabled: true, mfa: "Enabled", daysAgo: 8, role: "User", license: BASIC, cost: 6, type: "Member" },
  { name: "Mei Lin", user: "mei.lin", title: "Bookkeeper (Part-Time)", enabled: true, mfa: "Enabled", daysAgo: 15, role: "User", license: PREMIUM, cost: 22, type: "Member" },
];

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds the sample tenant CSV with sign-in dates relative to `now`, so the demo never goes stale. */
export function buildSampleCsv(now: Date = new Date(), domain: string = SAMPLE_ORG.domain): string {
  const rows = USERS.map((u) => {
    const signIn = u.daysAgo === null ? "Never" : new Date(now.getTime() - u.daysAgo * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
    return [
      u.name,
      `${u.user}@${domain}`,
      u.title,
      u.enabled ? "True" : "False",
      u.mfa,
      signIn,
      u.role,
      u.license,
      u.cost,
      u.type,
    ];
  });
  return [CSV_HEADERS.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n") + "\n";
}

export function buildBlankTemplateCsv(): string {
  return CSV_HEADERS.join(",") + "\n";
}

/** Common real-world MSP blind spots: basics in place, governance and verification missing. */
export const SAMPLE_SCORECARD: Answers = {
  q1: "partial",
  q2: "no",
  q3: "partial",
  q4: "yes",
  q5: "yes",
  q6: "no",
  q7: "partial",
  q8: "yes",
  q9: "partial",
  q10: "no",
};

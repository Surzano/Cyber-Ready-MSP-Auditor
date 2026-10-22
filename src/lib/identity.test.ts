import { describe, expect, it } from "vitest";
import { auditUsers, isGlobalAdminRole, isPaidLicense, mapHeaders, parseCsv, parseUsers, toCsv } from "./identity";
import { buildSampleCsv } from "./sampleData";

const NOW = new Date("2026-06-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

/** Shape of a Microsoft 365 / Entra ID user export. */
const ENTRA_CSV = [
  "displayName,userPrincipalName,accountEnabled,mfaStatus,lastSignInDateTime,role,licenses",
  `Ada Admin,ada@org.org,True,Disabled,${daysAgo(2)},Global Admin,Microsoft 365 Business Premium`,
  `Ben Staff,ben@org.org,True,Enabled,${daysAgo(5)},User,Microsoft 365 Business Premium`,
  `Cara Gone,cara@org.org,True,Enabled,${daysAgo(200)},User,Microsoft 365 Business Premium`,
  `Dan Disabled,dan@org.org,False,Disabled,${daysAgo(400)},User,Microsoft 365 Business Standard`,
  `Info Mailbox,info@org.org,True,,Never,User,Unlicensed`,
].join("\r\n");

/** Shape of a Google Workspace user export. */
const GOOGLE_CSV = [
  "First Name [Required],Email Address [Required],Status [READ ONLY],2sv Enrolled [READ ONLY],Last Sign In [READ ONLY],Admin Roles,Licenses",
  "Eve,eve@org.org,Active,True,2026/05/30 09:12:00 UTC,Super Admin,Google Workspace Business Standard",
  "Finn,finn@org.org,Suspended,False,2025/01/01 09:12:00 UTC,,Google Workspace Business Standard",
].join("\n");

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded newlines, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"multi\nline",z\r\n\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["multi\nline", "z"],
    ]);
  });

  it("round-trips through toCsv", () => {
    const rows = [["name", "note"], ["O'Brien, Pat", 'said "ok"']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("mapHeaders", () => {
  it("maps Entra ID and Google Workspace headers to the same fields", () => {
    expect(mapHeaders(ENTRA_CSV.split("\r\n")[0].split(",")).map).toMatchObject({ displayName: 0, upn: 1, enabled: 2, mfa: 3, lastSignIn: 4, role: 5, license: 6 });
    expect(mapHeaders(GOOGLE_CSV.split("\n")[0].split(",")).map).toMatchObject({ upn: 1, enabled: 2, mfa: 3, lastSignIn: 4, role: 5, license: 6 });
  });

  it("reports columns it does not recognize", () => {
    expect(mapHeaders(["Email", "Favorite Color"]).unmapped).toEqual(["Favorite Color"]);
  });
});

describe("parseUsers", () => {
  it("rejects a file with no data rows or no identity column", () => {
    expect(() => parseUsers("displayName\n")).toThrow(/no data rows/);
    expect(() => parseUsers("foo,bar\n1,2\n")).toThrow(/name or email column/);
  });

  it("warns about missing columns and the default license cost", () => {
    const { warnings } = parseUsers("Email,Licenses\na@org.org,E3\n");
    expect(warnings.join(" ")).toMatch(/No MFA column/);
    expect(warnings.join(" ")).toMatch(/No last sign-in column/);
    expect(warnings.join(" ")).toMatch(/\$22\/mo/);
  });

  it("normalizes Google Workspace values", () => {
    const [eve, finn] = parseUsers(GOOGLE_CSV).users;
    expect(eve).toMatchObject({ enabled: true, mfa: true, isGlobalAdmin: true, isPaid: true, monthlyCost: 22 });
    expect(eve.lastSignIn?.toISOString()).toBe("2026-05-30T09:12:00.000Z");
    expect(finn).toMatchObject({ enabled: false, mfa: false, isGlobalAdmin: false });
  });

  it("classifies shared mailboxes and guests", () => {
    const { users } = parseUsers("Email,accountType\ninfo@org.org,\nx_y#EXT#@org.org,\nbob@org.org,Member\n");
    expect(users.map((u) => u.accountType)).toEqual(["Shared/Service", "Guest", "Member"]);
  });
});

describe("role and license helpers", () => {
  it.each(["Global Admin", "Super Admin", "Company Administrator", "TRUE"])("treats %j as a global admin", (r) => {
    expect(isGlobalAdminRole(r)).toBe(true);
  });
  it.each(["User", "Billing Admin", ""])("does not treat %j as a global admin", (r) => {
    expect(isGlobalAdminRole(r)).toBe(false);
  });
  it("detects paid licenses", () => {
    expect(isPaidLicense("Microsoft 365 Business Premium")).toBe(true);
    expect(isPaidLicense("Unlicensed")).toBe(false);
    expect(isPaidLicense("")).toBe(false);
  });
});

describe("auditUsers", () => {
  const audit = () => {
    const { users, warnings } = parseUsers(ENTRA_CSV);
    return auditUsers(users, "entra.csv", warnings, NOW);
  };

  it("flags a global admin without MFA as critical admin sprawl", () => {
    const a = audit();
    expect(a.adminsWithoutMfa.map((u) => u.upn)).toEqual(["ada@org.org"]);
    expect(a.adminSprawl).toBe("critical");
    expect(a.users.find((u) => u.upn === "ada@org.org")?.flags).toContain("ADMIN_NO_MFA");
  });

  it("only counts enabled accounts as missing MFA", () => {
    expect(audit().missingMfa.map((u) => u.upn)).toEqual(["ada@org.org"]);
  });

  it("excludes shared mailboxes from stale detection and MFA coverage", () => {
    const a = audit();
    expect(a.stale.map((u) => u.upn)).toEqual(["cara@org.org"]);
    // Enabled members with known MFA: ada (off), ben (on), cara (on)
    expect(a.mfaCoveragePct).toBe(67);
  });

  it("counts paid licenses on disabled or stale accounts as waste", () => {
    const a = audit();
    expect(a.wasted.map((u) => u.upn).sort()).toEqual(["cara@org.org", "dan@org.org"]);
    expect(a.monthlyWaste).toBe(44);
    expect(a.annualWaste).toBe(528);
  });

  it("skips stale detection when the export has no sign-in data", () => {
    const { users } = parseUsers("Email,mfaStatus\na@org.org,Enabled\n");
    expect(auditUsers(users, "x", [], NOW).stale).toEqual([]);
  });

  it("only docks a clean tenant for admin ratio", () => {
    const { users } = parseUsers(`Email,mfaStatus,lastSignInDateTime,role\nboss@org.org,Enforced,${daysAgo(1)},Global Admin\nstaff@org.org,Enabled,${daysAgo(1)},User\n`);
    // 1 admin of 2 members is >10% sprawl → -6
    expect(auditUsers(users, "x", [], NOW).score).toBe(94);
  });
});

describe("Hope Valley demo tenant", () => {
  // CLAUDE.md promises the audience these exact numbers; guard them.
  const a = auditUsers(parseUsers(buildSampleCsv(NOW)).users, "sample", [], NOW);

  it("has 22 accounts with 5 global admins", () => {
    expect(a.totalAccounts).toBe(22);
    expect(a.globalAdmins).toHaveLength(5);
  });

  it("has 4 accounts missing MFA including 1 global admin", () => {
    expect(a.missingMfa).toHaveLength(4);
    expect(a.adminsWithoutMfa).toHaveLength(1);
  });

  it("wastes $792/yr on 3 dormant ex-employee licenses", () => {
    expect(a.annualWaste).toBe(792);
    expect(a.wasted).toHaveLength(3);
  });
});

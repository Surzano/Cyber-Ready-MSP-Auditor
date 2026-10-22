import { describe, expect, it } from "vitest";
import type { TxtResolver, WebDetails } from "../types";
import {
  UNAVAILABLE_WEB,
  analyzeDmarc,
  analyzeEmail,
  analyzeSpf,
  assembleResult,
  buildWebChecks,
  detectProvider,
  isNullMx,
  normalizeMx,
  parseDmarcTags,
  parseSpfTerms,
} from "./analyze";

/** In-memory DNS: TXT keyed by name, plus optional CNAME/MX tables. Unknown names resolve empty. */
function fakeDns(
  txt: Record<string, string[]>,
  extra: { cname?: Record<string, string[]>; mx?: Record<string, string[]> } = {},
): TxtResolver {
  return {
    txt: async (name) => txt[name] ?? [],
    cname: async (name) => extra.cname?.[name] ?? [],
    mx: async (name) => extra.mx?.[name] ?? [],
  };
}

const check = (result: ReturnType<typeof assembleResult>, id: string) => result.checks.find((c) => c.id === id)!;

describe("parseSpfTerms", () => {
  it("splits qualifiers, mechanisms and values", () => {
    expect(parseSpfTerms("v=spf1 include:_spf.google.com ip4:1.2.3.4 a/24 ~all")).toEqual([
      { qualifier: "+", mechanism: "include", value: "_spf.google.com" },
      { qualifier: "+", mechanism: "ip4", value: "1.2.3.4" },
      { qualifier: "+", mechanism: "a", value: null },
      { qualifier: "~", mechanism: "all", value: null },
    ]);
  });

  it("parses redirect= modifiers", () => {
    expect(parseSpfTerms("v=spf1 redirect=_spf.example.org")).toEqual([
      { qualifier: "+", mechanism: "redirect", value: "_spf.example.org" },
    ]);
  });
});

describe("analyzeSpf", () => {
  it("reports missing SPF", async () => {
    const spf = await analyzeSpf("org.org", fakeDns({ "org.org": ["google-site-verification=abc"] }));
    expect(spf.record).toBeNull();
    expect(spf.records).toEqual([]);
  });

  it("flags multiple SPF records as a permerror", async () => {
    const spf = await analyzeSpf("org.org", fakeDns({ "org.org": ["v=spf1 -all", "v=spf1 mx ~all"] }));
    expect(spf.errors[0]).toMatch(/2 SPF records/);
  });

  it("counts lookups recursively through includes", async () => {
    const dns = fakeDns({
      "org.org": ["v=spf1 include:a.net include:b.net mx -all"],
      "a.net": ["v=spf1 include:c.net a -all"],
      "b.net": ["v=spf1 ip4:10.0.0.0/8 -all"],
      "c.net": ["v=spf1 exists:%{i}.x.net -all"],
    });
    const spf = await analyzeSpf("org.org", dns);
    // org: include, include, mx (3) · a.net: include, a (2) · c.net: exists (1)
    expect(spf.lookupCount).toBe(6);
    expect(spf.allQualifier).toBe("-");
    expect(spf.includes).toEqual(["a.net", "b.net"]);
  });

  it("terminates include loops and records them", async () => {
    const dns = fakeDns({
      "org.org": ["v=spf1 include:loop.net -all"],
      "loop.net": ["v=spf1 include:org.org -all"],
    });
    const spf = await analyzeSpf("org.org", dns);
    expect(spf.errors.some((e) => /loop/i.test(e))).toBe(true);
  });

  it("flags includes with no SPF record as void lookups", async () => {
    const spf = await analyzeSpf("org.org", fakeDns({ "org.org": ["v=spf1 include:gone.net -all"] }));
    expect(spf.errors.some((e) => /void lookup/.test(e))).toBe(true);
  });

  it("follows redirect= to find the all qualifier", async () => {
    const dns = fakeDns({
      "org.org": ["v=spf1 redirect=_spf.org.org"],
      "_spf.org.org": ["v=spf1 ip4:1.2.3.4 ~all"],
    });
    expect((await analyzeSpf("org.org", dns)).allQualifier).toBe("~");
  });
});

describe("SPF grading", () => {
  async function gradeSpf(record: string, extra: Record<string, string[]> = {}) {
    const email = await analyzeEmail("org.org", fakeDns({ "org.org": [record], ...extra }));
    return check(assembleResult("org.org", "live-server", email, UNAVAILABLE_WEB), "spf");
  }

  it.each([
    ["v=spf1 mx -all", "pass", 20],
    ["v=spf1 mx ~all", "warn", 14],
    ["v=spf1 mx ?all", "fail", 4],
    ["v=spf1 +all", "fail", 0],
    ["v=spf1 mx", "warn", 8],
  ])("%s → %s (%i pts)", async (record, status, points) => {
    const c = await gradeSpf(record);
    expect(c.status).toBe(status);
    expect(c.points).toBe(points);
  });

  it("fails a record that exceeds 10 DNS lookups even with -all", async () => {
    const includes = Array.from({ length: 11 }, (_, i) => `include:s${i}.net`).join(" ");
    const extra = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`s${i}.net`, ["v=spf1 ip4:1.1.1.1 -all"]]));
    const c = await gradeSpf(`v=spf1 ${includes} -all`, extra);
    expect(c.status).toBe("fail");
    expect(c.points).toBeLessThanOrEqual(6);
    expect(c.summary).toMatch(/11 DNS lookups/);
  });

  it("warns when a passing record is near the lookup limit", async () => {
    const includes = Array.from({ length: 9 }, (_, i) => `include:s${i}.net`).join(" ");
    const extra = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`s${i}.net`, ["v=spf1 ip4:1.1.1.1 -all"]]));
    const c = await gradeSpf(`v=spf1 ${includes} -all`, extra);
    expect(c.status).toBe("warn");
    expect(c.points).toBe(17);
  });

  it("recommends hardening ~all to -all in the fix", async () => {
    expect((await gradeSpf("v=spf1 include:spf.protection.outlook.com ~all")).fix).toContain(
      '"v=spf1 include:spf.protection.outlook.com -all"',
    );
  });
});

describe("DMARC", () => {
  it("parses tags case-insensitively", () => {
    expect(parseDmarcTags("v=DMARC1; P=reject; rua=mailto:a@b.org")).toMatchObject({ v: "DMARC1", p: "reject", rua: "mailto:a@b.org" });
  });

  it("extracts policy, pct and rua", async () => {
    const dmarc = await analyzeDmarc("org.org", fakeDns({ "_dmarc.org.org": ["v=DMARC1; p=quarantine; pct=50; sp=none; rua=mailto:r@org.org"] }));
    expect(dmarc).toMatchObject({ policy: "quarantine", pct: 50, subdomainPolicy: "none", rua: "mailto:r@org.org" });
  });

  it.each([
    ["v=DMARC1; p=reject; rua=mailto:r@org.org", "pass", 25],
    ["v=DMARC1; p=reject", "pass", 23],
    ["v=DMARC1; p=reject; pct=25; rua=mailto:r@org.org", "warn", 20],
    ["v=DMARC1; p=quarantine; rua=mailto:r@org.org", "warn", 18],
    ["v=DMARC1; p=none; rua=mailto:r@org.org", "fail", 6],
    ["v=DMARC1; p=none", "fail", 4],
  ])("%s → %s (%i pts)", async (record, status, points) => {
    const email = await analyzeEmail("org.org", fakeDns({ "_dmarc.org.org": [record] }));
    const c = check(assembleResult("org.org", "live-server", email, UNAVAILABLE_WEB), "dmarc");
    expect(c.status).toBe(status);
    expect(c.points).toBe(points);
  });

  it("fails when DMARC is missing", async () => {
    const email = await analyzeEmail("org.org", fakeDns({}));
    const c = check(assembleResult("org.org", "live-server", email, UNAVAILABLE_WEB), "dmarc");
    expect(c.status).toBe("fail");
    expect(c.points).toBe(0);
  });
});

describe("DKIM", () => {
  it("passes when a key is found via TXT or CNAME", async () => {
    const email = await analyzeEmail(
      "org.org",
      fakeDns({}, { cname: { "selector1._domainkey.org.org": ["selector1-org-org._domainkey.org.onmicrosoft.com"] } }),
    );
    expect(email.dkim.found).toEqual([{ selector: "selector1", type: "CNAME", value: "selector1-org-org._domainkey.org.onmicrosoft.com" }]);
    expect(check(assembleResult("org.org", "live-server", email, UNAVAILABLE_WEB), "dkim").status).toBe("pass");
  });

  it("treats a revoked key (empty p=) as not active", async () => {
    const email = await analyzeEmail("org.org", fakeDns({ "google._domainkey.org.org": ["v=DKIM1; p="] }));
    const c = check(assembleResult("org.org", "live-server", email, UNAVAILABLE_WEB), "dkim");
    expect(c.status).toBe("warn");
    expect(c.notes.some((n) => /Revoked/.test(n))).toBe(true);
  });
});

describe("MX & provider detection", () => {
  it("restores the canonical null MX from both resolver formats", () => {
    expect(normalizeMx(["0 "])).toEqual(["0 ."]);
    expect(normalizeMx(["0 ."])).toEqual(["0 ."]);
    expect(normalizeMx(["10 mx.org.org"])).toEqual(["10 mx.org.org"]);
  });

  it("recognizes a null MX", () => {
    expect(isNullMx(["0 ."])).toBe(true);
    expect(isNullMx(["0 .", "10 mx.org.org"])).toBe(false);
    expect(isNullMx([])).toBe(false);
  });

  it("detects providers from MX and SPF includes", () => {
    expect(detectProvider(["0 org-org.mail.protection.outlook.com"], [])).toBe("Microsoft 365");
    expect(detectProvider([], ["_spf.google.com"])).toBe("Google Workspace");
    expect(detectProvider(["10 mx.fastmail.com"], [])).toBe("Other");
    expect(detectProvider([], [])).toBe("None detected");
    expect(detectProvider(["0 ."], [])).toBe("None detected");
  });

  it("normalizes null MX end-to-end through analyzeEmail", async () => {
    const email = await analyzeEmail("org.org", fakeDns({}, { mx: { "org.org": ["0 "] } }));
    expect(email.mx).toEqual(["0 ."]);
    expect(email.emailProvider).toBe("None detected");
  });
});

describe("buildWebChecks", () => {
  const web = (headers: Record<string, string>, over: Partial<WebDetails> = {}): WebDetails => ({
    available: true,
    finalUrl: "https://org.org/",
    httpsOk: true,
    httpRedirectsToHttps: true,
    statusCode: 200,
    headers,
    error: null,
    ...over,
  });
  const byId = (checks: ReturnType<typeof buildWebChecks>) => Object.fromEntries(checks.map((c) => [c.id, c]));

  it("passes every check for a hardened site and drops fix lines", () => {
    const checks = buildWebChecks(
      web({
        "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
        "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      }),
    );
    expect(checks.every((c) => c.status === "pass")).toBe(true);
    expect(checks.every((c) => c.fix === undefined)).toBe(true);
  });

  it("fails every header check for a bare site", () => {
    const c = byId(buildWebChecks(web({})));
    expect([c.hsts.status, c.csp.status, c.xfo.status, c.xcto.status]).toEqual(["fail", "fail", "fail", "fail"]);
    expect(c.referrer.status).toBe("warn");
  });

  it("grades partial configurations as warnings", () => {
    const c = byId(
      buildWebChecks(
        web(
          {
            "strict-transport-security": "max-age=3600",
            "content-security-policy-report-only": "default-src 'self'",
            "referrer-policy": "unsafe-url",
          },
          { httpRedirectsToHttps: false },
        ),
      ),
    );
    expect(c.https.status).toBe("warn");
    expect(c.hsts.status).toBe("warn");
    expect(c.csp.summary).toMatch(/report-only/);
    expect(c.referrer.summary).toMatch(/Weak/);
  });

  it("treats wildcard script sources as a permissive CSP", () => {
    expect(byId(buildWebChecks(web({ "content-security-policy": "default-src * 'unsafe-inline'" }))).csp.status).toBe("warn");
  });

  it("fails HTTPS when the site is unreachable", () => {
    const c = byId(buildWebChecks(web({}, { httpsOk: false, error: "timeout" })));
    expect(c.https.status).toBe("fail");
    expect(c.https.summary).toMatch(/timeout/);
  });
});

describe("assembleResult", () => {
  it("scores email-only when web data is unavailable", async () => {
    const dns = fakeDns(
      { "org.org": ["v=spf1 mx -all"], "_dmarc.org.org": ["v=DMARC1; p=reject; rua=mailto:r@org.org"], "google._domainkey.org.org": ["v=DKIM1; k=rsa; p=MIIB"] },
      { mx: { "org.org": ["1 smtp.google.com"] } },
    );
    const result = assembleResult("org.org", "live-doh", await analyzeEmail("org.org", dns), UNAVAILABLE_WEB);
    expect(result.checks).toHaveLength(3);
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A+");
    expect(result.emailProvider).toBe("Google Workspace");
  });
});

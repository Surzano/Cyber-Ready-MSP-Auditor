import type { DomainScanResult } from "../types";
import { DKIM_SELECTORS, assembleResult } from "./analyze";

export const SIMULATED_DOMAIN = "hopevalleycs.org";

/**
 * A realistic, fully offline scan of the fictional Hope Valley Community Services domain.
 * Used when presentation-room Wi-Fi blocks outbound DNS/HTTP. It shows the most common MSP
 * pattern: SPF soft-fail, DMARC stuck at p=none, partial header hardening.
 */
export function simulatedScan(domain: string = SIMULATED_DOMAIN): DomainScanResult {
  const spfRecord = `v=spf1 include:spf.protection.outlook.com include:servers.mcsv.net include:_spf.constantcontact.com include:sendgrid.net ~all`;
  return assembleResult(
    domain,
    "simulated",
    {
      mx: [`10 ${domain.replace(/\./g, "-")}.mail.protection.outlook.com`],
      emailProvider: "Microsoft 365",
      spf: {
        records: [spfRecord],
        record: spfRecord,
        allQualifier: "~",
        lookupCount: 8,
        includes: ["spf.protection.outlook.com", "servers.mcsv.net", "_spf.constantcontact.com", "sendgrid.net"],
        errors: [],
      },
      dmarc: {
        record: `v=DMARC1; p=none; rua=mailto:reports@apex-it-msp.example`,
        policy: "none",
        subdomainPolicy: null,
        pct: null,
        rua: "mailto:reports@apex-it-msp.example",
      },
      dkim: {
        probed: DKIM_SELECTORS,
        found: [
          {
            selector: "selector1",
            type: "CNAME",
            value: `selector1-${domain.replace(/\./g, "-")}._domainkey.hopevalleycs.onmicrosoft.com`,
          },
        ],
      },
    },
    {
      available: true,
      finalUrl: `https://www.${domain}/`,
      httpsOk: true,
      httpRedirectsToHttps: true,
      statusCode: 200,
      headers: {
        "strict-transport-security": "max-age=86400",
        "x-frame-options": "SAMEORIGIN",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer-when-downgrade",
        server: "nginx",
        "x-powered-by": "PHP/7.4.33",
      },
      error: null,
    },
    ["SIMULATED DEMO DATA — no network queries were made. Use this when room Wi-Fi blocks DNS/HTTP."],
  );
}

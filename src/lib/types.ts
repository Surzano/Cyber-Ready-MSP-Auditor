export type Status = "pass" | "warn" | "fail" | "info";

export type ScanMode = "live-server" | "live-doh" | "simulated";

export interface CheckResult {
  id: "spf" | "dmarc" | "dkim" | "https" | "hsts" | "csp" | "xfo" | "xcto" | "referrer";
  category: "email" | "web";
  label: string;
  status: Status;
  points: number;
  maxPoints: number;
  /** One-line technical finding, e.g. "SPF ends in ~all (soft fail)". */
  summary: string;
  /** Plain-English nonprofit impact for leadership. */
  plain: string;
  /** Raw records / header values exactly as observed. */
  raw: string[];
  /** Extra technical notes (lookup counts, parse warnings, etc.). */
  notes: string[];
  /** The exact fix to hand to the MSP (DNS record, header value...). */
  fix?: string;
}

export interface SpfDetails {
  records: string[];
  record: string | null;
  allQualifier: "-" | "~" | "?" | "+" | null;
  lookupCount: number;
  includes: string[];
  errors: string[];
}

export interface DmarcDetails {
  record: string | null;
  policy: "none" | "quarantine" | "reject" | null;
  subdomainPolicy: string | null;
  pct: number | null;
  rua: string | null;
}

export interface DkimDetails {
  probed: string[];
  found: { selector: string; type: "TXT" | "CNAME"; value: string }[];
}

export interface WebDetails {
  available: boolean;
  finalUrl: string | null;
  httpsOk: boolean;
  httpRedirectsToHttps: boolean | null;
  statusCode: number | null;
  headers: Record<string, string>;
  error: string | null;
}

export interface DomainScanResult {
  domain: string;
  scannedAt: string;
  mode: ScanMode;
  mx: string[];
  emailProvider: "Microsoft 365" | "Google Workspace" | "Other" | "None detected";
  spf: SpfDetails;
  dmarc: DmarcDetails;
  dkim: DkimDetails;
  web: WebDetails;
  checks: CheckResult[];
  score: number;
  grade: string;
  notes: string[];
}

/** Minimal resolver contract implemented by Node dns (server) and DNS-over-HTTPS (browser). */
export interface TxtResolver {
  txt(name: string): Promise<string[]>;
  cname(name: string): Promise<string[]>;
  mx(name: string): Promise<string[]>;
}

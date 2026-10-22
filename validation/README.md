# Validating MSP Auditor

Three kinds of evidence that the tool reports the right things, without needing anyone's real data.

| Check | What it proves | Command |
|---|---|---|
| Messy-file tests | Exports from real admin portals, Excel re-saves and damaged files either give the right answer or a clear warning, never a wrong number | `npm test` |
| Domain comparison | Step 1 matches independent DNS lookups and direct header checks on real nonprofit domains | `npm run validate:domains` |
| Test-tenant answer key | Step 2 flags exactly the accounts you know are risky in a tenant you control | `npm run validate:tenant` |

## 1. Domain comparison

```bash
npm run validate:domains                                    # live site, validation/domains.txt
npm run validate:domains -- --api http://localhost:3000     # a local dev server
npm run validate:domains -- --list my-domains.txt --out my-results.md
```

The script writes [`domain-results.md`](domain-results.md) with an agreement rate per check, a row per domain, and a **Disagreements to review** list with MXToolbox and securityheaders.com links for each one. Look at every disagreement by hand and note which side was right. A disagreement is either a bug in the app or a gap in the simple reference parser, and both are worth knowing about.

Only public DNS records and public website headers are read. Sites that time out or block automated requests are reported as "not graded" and are not counted either way.

## 2. Test-tenant answer key

### Set up a tenant you control

Start a free trial of Microsoft 365 Business Premium or Google Workspace on a domain you own. Then create about ten accounts with known, deliberate problems:

| Account | Set it up so that… | Tests |
|---|---|---|
| `admin1@` | Global Admin, MFA **on** | Admin count |
| `admin2@` | Global Admin, MFA **off** | Critical admin finding |
| `staff1@`, `staff2@` | MFA on, signed in this week | Clean accounts |
| `staff3@` | MFA **off**, signed in this week | Missing MFA |
| `former1@` | Sign-in **blocked**, still holds a paid license | License waste |
| `former2@` | Enabled, licensed, **never signed in** | Stale + license waste |
| `info@` | Shared mailbox, no license | Not counted as a person |
| a guest | Invited external user | Guest handling |
| `unlicensed@` | No license, MFA on | No false license waste |

A brand-new tenant can't contain an account that has been inactive for 90 days, so the stale rule on old dates is covered by `npm test` instead. "Never signed in" still tests the stale path.

### Write the answer key before you run the tool

Copy [`answer-key.hope-valley.json`](answer-key.hope-valley.json) to `client-data/lab-answer-key.json` and describe each account as you set it up:

```json
{
  "tenant": "My lab tenant (lab.example.org)",
  "exportedOn": "2026-10-22",
  "accounts": {
    "admin2@lab.example.org": { "mfa": false, "enabled": true, "globalAdmin": true, "stale": false, "paidLicense": true }
  }
}
```

`stale` means enabled with no sign-in for more than 90 days, or never.

### Export, then compare

Export users the way a nonprofit would (see the column guide on the site), save the file to `client-data/` (git-ignored), and run:

```bash
npm run validate:tenant -- --export client-data/lab-users.csv --key client-data/lab-answer-key.json
```

The script writes `tenant-results.md`: correct, false-positive and missed counts for each finding, totals side by side, and every mismatch by account. It exits with an error if anything doesn't match.

To see what a report looks like, run it on the built-in sample tenant. Its answer key was written by hand from the sample's design, not from the tool's output:

```bash
npm run sample:csv
npm run validate:tenant -- --export public/sample-hope-valley-users.csv --key validation/answer-key.hope-valley.json --as-of $(date +%F)
```

**Never commit a real export or a report built from one.** `client-data/`, `*.csv` and `*-audit-report.*` are git-ignored for this reason.

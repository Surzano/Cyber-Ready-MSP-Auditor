# CLAUDE.md — Project Specification & Architecture

## 1. Project Overview
- **App Name:** Cyber Ready MSP "Trust, But Verify" Security Auditor & Action Ticket Generator
- **Author:** Surzano R. Solomon (Cybersecurity Practitioner Intern, Cyber Ready Clinic)
- **Target Audience:** Nonprofits and Small-to-Medium Organizations (SMBs) managed by an outsourced Managed Service Provider (MSP), plus Cyber Ready Clinic student practitioners conducting Discover5 and Ready5 assessments.
- **Core Problem Solved:** Nonprofits assume their MSP handles 100% of their cybersecurity. In reality, baseline MSP contracts focus on IT uptime, frequently leaving email spoofing protections (SPF/DKIM/DMARC) unconfigured, HTTP security headers missing, MFA unenforced, dormant ex-employee accounts active, and wasted software licenses running. Furthermore, nonprofit leaders lack the technical vocabulary to hold their MSP accountable.
- **Core Solution:** A zero-setup, privacy-first web application that audits a nonprofit across 3 modules and automatically generates:
  1. A **Board-Ready Cyber Risk One-Pager** (`governance-r-17`) with an overall letter grade (A–F) and plain-English business impact explanations.
  2. **Copy-Paste MSP Remediation Tickets** pre-written with exact technical instructions that a nonprofit Executive Director can email directly to their MSP's help desk.

## 2. Mapped Cyber Ready Clinic Impact Project IDs
Display these official Clinic IDs as subtle badges in the UI so leadership sees direct alignment with the Practitioner 1 Impact Projects catalog:
- `email-securi-15`: SPF/DKIM/DMARC Health Checker
- `website-atta-05`: Website Security Grader
- `identity-sec-17`: MFA Coverage Scanner
- `identity-sec-21`: Stale Account Hunter
- `identity-sec-22`: Admin Sprawl Audit
- `asset-manage-11`: License Waste Audit
- `vendors-msps-08`: MSP Report Card (10-Question Grade)
- `vendors-msps-02`: Key Questions to Ask MSPs
- `identity-sec-24`: Technical Identity Verification for Help Desks
- `governance-r-17`: Board-Ready Cyber Risk One-Pager Generator

## 3. Tech Stack & Privacy Architecture
- **Framework:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide React icons.
- **Deployment Target:** Vercel (serverless compatible).
- **Zero-Data-Retention Privacy Guarantee:**
  - All user CSV parsing (Module 2) and MSP scorecard answers (Module 3) MUST execute 100% client-side in the browser memory. No sensitive user lists or PII are ever uploaded to a database or external server.
  - Display a prominent "Zero Data Retention — 100% Client-Side Processing for Internal Data" trust badge in the header.

## 4. Detailed Functional Modules

### Module 1: Domain & Email Spoofing Scanner (`email-securi-15` + `website-atta-05`)
- **Backend API Route (`/api/scan-domain`):** Accepts a domain name (e.g., `example.org`), sanitizes input, and uses Node.js native `dns.promises` and `fetch` (with a 6-second timeout) to perform passive, non-intrusive checks:
  1. **SPF Check:** Queries TXT records on root domain for `v=spf1`. Parses whether it ends in `-all` (Hard Fail / Pass), `~all` (Soft Fail / Warning), `?all` or `+all` (Neutral/PassAll / Critical Fail), or is missing. Also counts DNS lookup mechanisms (`include:`, `a`, `mx`, `ptr`, `exists`, `redirect`) to warn if > 10 lookups.
  2. **DMARC Check:** Queries TXT records on `_dmarc.<domain>` for `v=DMARC1`. Extracts policy `p=` (`reject` = Pass, `quarantine` = Good/Warning, `none` = Critical Warning: Monitoring Only, no protection against spoofing) and `rua=` reporting address.
  3. **DKIM Check:** Probes common nonprofit email selectors (`google`, `selector1`, `selector2`, `default`, `k1`, `mandrill`, `mailchimp`, `everlytickey1`, `s1`, `s2`) at `<selector>._domainkey.<domain>` via TXT/CNAME lookup. Reports which active selectors were discovered or if manual verification is needed.
  4. **Website & HTTP Security Headers Check:** Fetches `https://<domain>` (and checks if `http://` redirects to `https://`). Evaluates presence and configuration of:
     - `strict-transport-security` (HSTS)
     - `content-security-policy` (CSP)
     - `x-frame-options`
     - `x-content-type-options`
     - `referrer-policy`
- **Scoring & UI:** Calculates a Domain & Web Security Grade (A–F), displays pass/warn/fail cards with a toggle between **"Plain-English Nonprofit Impact"** and **"Technical Raw Record View"**.

### Module 2: Identity, Access & License Waste Auditor (`identity-sec-17`, `identity-sec-21`, `identity-sec-22`, `asset-manage-11`)
- **Client-Side CSV Parser:** Supports drag-and-drop CSV upload or a 1-click **"Load Sample Nonprofit Tenant (Hope Valley Community Services)"** button for live presentation demos.
- **Flexible Column Mapping:** Automatically normalizes column headers from either Microsoft 365 Entra ID exports or Google Workspace exports:
  - `displayName` / `Name`
  - `userPrincipalName` / `Email`
  - `accountEnabled` / `Status` (Active/Suspended/Blocked)
  - `mfaStatus` / `MFA` / `2SV Enrolled` (Enabled/Enforced/Disabled)
  - `lastSignInDateTime` / `Last Sign In` (ISO date or YYYY-MM-DD)
  - `role` / `Admin Roles` (Global Admin, Super Admin, User, Billing Admin)
  - `licenses` / `Assigned License` (e.g., M365 Business Premium, Business Standard, Unlicensed)
  - `monthlyCost` (Optional numeric column, defaults to $22/mo for paid licenses if omitted)
  - `accountType` (Member, Guest, Shared/Service)
- **Automated Audit Rules:**
  1. **Missing MFA (`identity-sec-17`):** Enabled accounts where `mfaStatus` is Disabled/False.
  2. **Stale / Dormant Accounts (`identity-sec-21`):** Enabled accounts where `lastSignInDateTime` > 90 days ago (or Never signed in).
  3. **Admin Sprawl (`identity-sec-22`):** Counts total Global/Super Admins. Flags Warning if > 3 admins or > 10% of org; flags Critical if any Admin account has MFA Disabled.
  4. **License Waste (`asset-manage-11`):** Calculates monthly and annual dollar waste for paid licenses assigned to Disabled/Blocked accounts OR Stale accounts (>90 days inactive).
- **UI Output:** KPI metric cards (MFA Coverage %, Stale Accounts Found, Global Admin Count, Annual License Savings $) + interactive filterable table highlighting risky user rows in red/amber + a button to **"Download Sample CSV Template"**.

### Module 3: 10-Question MSP Accountability Scorecard (`vendors-msps-08`, `vendors-msps-02`, `identity-sec-24`)
- Interactive 10-question assessment where each question can be answered: **Yes (10 pts)**, **Partial / Unsure (4 pts)**, or **No (0 pts)**.
- Each question includes a **"Why This Matters"** tooltip and the exact **"Question to Ask Your MSP"**.
- **The 10 Questions:**
  1. **Phishing-Resistant MFA Enforcement:** Does your MSP enforce MFA across 100% of accounts (including executives and board members) using app-based push/codes or security keys rather than SMS? (`identity-sec-07`)
  2. **Help Desk Caller Identity Verification (`identity-sec-24` / `vendors-msps-12`):** If someone calls your MSP help desk claiming to be an employee locked out of their account, does the MSP require technical out-of-band verification (like a push notification or callback to a manager) before resetting a password?
  3. **Immutable 3-2-1 Backups & Restore Drills (`data-managem-11`):** Does your MSP back up cloud data (Microsoft 365 SharePoint/OneDrive or Google Drive—not just servers) and have they provided proof of a successful test restore in the last 6 months?
  4. **24/7 Endpoint Detection & Response (`detection-al-01`):** Are all organization laptops running monitored EDR/MDR software (like Defender for Business, Huntress, or CrowdStrike) rather than basic traditional antivirus?
  5. **Automated OS & 3rd-Party Patching (`patch-manage-01`):** Does your MSP provide a monthly report proving that Windows/macOS and third-party browsers (Chrome, Adobe, Zoom) are patched within 14 days of critical releases?
  6. **15-Minute Offboarding Kill-Switch (`identity-sec-19`):** When an employee or volunteer leaves, does your MSP have a documented SLA to revoke all logins, active sessions, OAuth tokens, and email forwarding within 15 minutes of notification?
  7. **Silent Inbox Auto-Forwarding & BEC Monitoring (`email-securi-19`):** Has your MSP blocked external email auto-forwarding at the tenant level and enabled alerts for suspicious inbox rules or impossible-travel logins?
  8. **Removal of Local Admin Privileges (`endpoints-de-14`):** Do regular staff members operate as standard users on their laptops (requiring MSP elevation to install software), rather than holding full Local Administrator rights?
  9. **Live Hardware & Shadow IT Asset Inventory (`asset-manage-14`):** Can your MSP hand you an up-to-date list today of every laptop, mobile device, and third-party cloud app connected to your environment?
  10. **Written Incident Response & Breach Call Tree (`incident-res-06`):** Do you and your MSP have a shared 24/7 emergency call tree defining who to call during a ransomware or wire-fraud incident on a weekend?

### Module 4: The Deliverable Engine (MSP Ticket Generator + Board One-Pager)
- **Tab A: Auto-Generated MSP Support Tickets (Copy-Paste Ready)**
  - Dynamically compiles every failed/warned item from Modules 1, 2, and 3 into categorized, high-priority help desk tickets:
    - *Ticket #1: Email Authentication & Domain Hardening (SPF/DKIM/DMARC & HTTP Headers)* — includes exact recommended DNS TXT record strings and `vercel.json` / server header configs.
    - *Ticket #2: Urgent Identity Hygiene, MFA Enforcement & License Reclamation* — lists the exact usernames from the CSV needing MFA enforcement, offboarding/disabling, admin privilege removal, and license removal (citing exact $/year savings).
    - *Ticket #3: MSP Security Baseline & SLA Governance Alignment* — lists every "No" or "Unsure" item from the 10-question scorecard as formal action requests (e.g., implementing help-desk caller verification and scheduling a backup restore fire drill).
  - Includes 1-click **"Copy Ticket to Clipboard"** and **"Open in Email Client (`mailto:`)"** buttons.
- **Tab B: Board-Ready Cyber Risk One-Pager (`governance-r-17`)**
  - Clean, executive-formatted summary showing:
    - Overall Cyber Readiness Grade (A–F) & Composite Score (0–100)
    - Top 3 Business Risks in Plain English (Financial Fraud / BEC, Ransomware Downtime, Compliance/Grant Risk)
    - Immediate Quick Wins & Estimated Annual License Savings ($)
    - Print / Export to PDF button (`window.print()` with clean `@media print` CSS that hides navigation buttons and formats cleanly onto 1–2 pages).

## 5. Demo Mode & Presentation Polish
- Include a prominent **"⚡ Load Full Live Demo (Nonprofit Case Study)"** button in the top navigation bar.
- Clicking it populates:
  - A realistic sample nonprofit profile (*"Hope Valley Community Services — 24 Staff, Managed by Apex IT MSP"*).
  - Pre-loaded realistic CSV data (22 accounts: 4 missing MFA including 1 Global Admin, 3 dormant ex-employees still holding $22/mo M365 Business Premium licenses = $792/yr wasted, 5 total Global Admins).
  - Pre-filled MSP Scorecard responses showing common real-world MSP blind spots.
  - Also allow running a **live real-time DNS/Header scan** on any real domain typed by the user or audience during the presentation.

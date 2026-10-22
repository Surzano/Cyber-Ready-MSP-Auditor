# CLAUDE.md — Project Specification & Architecture

## 1. Project Overview
- **App Name:** MSP Auditor (a security check-up for nonprofits and their MSPs). Repo: github.com/Surzano/MSP-Auditor · Live: msp-auditor.vercel.app
- **Author:** Surzano R. Solomon
- **Branding:** Independent product. Do not use Cyber Ready Clinic names, logos or project IDs anywhere in the UI, tickets, metadata or README.
- **Target Audience:** Nonprofits and Small-to-Medium Organizations (SMBs) managed by an outsourced Managed Service Provider (MSP), plus volunteer and student assessors.
- **Core Problem Solved:** Nonprofits assume their MSP handles 100% of their cybersecurity. In reality, baseline MSP contracts focus on IT uptime, frequently leaving email spoofing protections (SPF/DKIM/DMARC) unconfigured, HTTP security headers missing, MFA unenforced, dormant ex-employee accounts active, and wasted software licenses running. Furthermore, nonprofit leaders lack the technical vocabulary to hold their MSP accountable.
- **Core Solution:** A zero-setup, privacy-first web application that audits a nonprofit across 3 modules and automatically generates:
  1. A **Board-Ready Cyber Risk One-Pager** with an overall letter grade (A–F) and plain-English business impact explanations.
  2. **Copy-Paste MSP Remediation Tickets** pre-written with exact technical instructions that a nonprofit Executive Director can email directly to their MSP's help desk.

## 2. Visual Design
- "Workshop" look: white surfaces, near-black ink, one deep-teal accent (token name `moss`), with `ochre` / `brick` / `harbor` for caution / problem / info. Tokens live in `src/app/globals.css` `@theme`.
- Type: Bricolage Grotesque for headings (`font-serif` slot), Atkinson Hyperlegible for body, IBM Plex Mono for tickets and records.
- Layout: plain header, numbered step sidebar (horizontal on mobile), privacy footer. Avoid gradients, glows, drop shadows, emoji and heavy rounded corners.

## 3. Tech Stack & Privacy Architecture
- **Framework:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide React icons.
- **Deployment Target:** Vercel (serverless compatible).
- **Zero-Data-Retention Privacy Guarantee:**
  - All user CSV parsing (Module 2) and MSP scorecard answers (Module 3) MUST execute 100% client-side in the browser memory. No sensitive user lists or PII are ever uploaded to a database or external server.
  - Explain the privacy model in plain language next to the upload (where the file goes, how to verify it with DevTools or offline). Do not link to the source repository from the UI and in the footer, and list which CSV columns are actually needed so users can strip or pseudonymize the rest.

## 4. Detailed Functional Modules

### Module 1: Domain & Email Spoofing Scanner
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

### Module 2: Identity, Access & License Waste Auditor
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
  1. **Missing MFA:** Enabled accounts where `mfaStatus` is Disabled/False.
  2. **Stale / Dormant Accounts:** Enabled accounts where `lastSignInDateTime` > 90 days ago (or Never signed in).
  3. **Admin Sprawl:** Counts total Global/Super Admins. Flags Warning if > 3 admins or > 10% of org; flags Critical if any Admin account has MFA Disabled.
  4. **License Waste:** Calculates monthly and annual dollar waste for paid licenses assigned to Disabled/Blocked accounts OR Stale accounts (>90 days inactive).
- **UI Output:** KPI metric cards (MFA Coverage %, Stale Accounts Found, Global Admin Count, Annual License Savings $) + interactive filterable table highlighting risky user rows in red/amber + a button to **"Download Sample CSV Template"**.

### Module 3: 10-Question MSP Accountability Scorecard
- Interactive 10-question assessment where each question can be answered: **Yes (10 pts)**, **Partial / Unsure (4 pts)**, or **No (0 pts)**.
- Each question includes a **"Why This Matters"** tooltip and the exact **"Question to Ask Your MSP"**.
- **The 10 Questions:**
  1. **Phishing-Resistant MFA Enforcement:** Does your MSP enforce MFA across 100% of accounts (including executives and board members) using app-based push/codes or security keys rather than SMS?
  2. **Help Desk Caller Identity Verification:** If someone calls your MSP help desk claiming to be an employee locked out of their account, does the MSP require technical out-of-band verification (like a push notification or callback to a manager) before resetting a password?
  3. **Immutable 3-2-1 Backups & Restore Drills:** Does your MSP back up cloud data (Microsoft 365 SharePoint/OneDrive or Google Drive—not just servers) and have they provided proof of a successful test restore in the last 6 months?
  4. **24/7 Endpoint Detection & Response:** Are all organization laptops running monitored EDR/MDR software (like Defender for Business, Huntress, or CrowdStrike) rather than basic traditional antivirus?
  5. **Automated OS & 3rd-Party Patching:** Does your MSP provide a monthly report proving that Windows/macOS and third-party browsers (Chrome, Adobe, Zoom) are patched within 14 days of critical releases?
  6. **15-Minute Offboarding Kill-Switch:** When an employee or volunteer leaves, does your MSP have a documented SLA to revoke all logins, active sessions, OAuth tokens, and email forwarding within 15 minutes of notification?
  7. **Silent Inbox Auto-Forwarding & BEC Monitoring:** Has your MSP blocked external email auto-forwarding at the tenant level and enabled alerts for suspicious inbox rules or impossible-travel logins?
  8. **Removal of Local Admin Privileges:** Do regular staff members operate as standard users on their laptops (requiring MSP elevation to install software), rather than holding full Local Administrator rights?
  9. **Live Hardware & Shadow IT Asset Inventory:** Can your MSP hand you an up-to-date list today of every laptop, mobile device, and third-party cloud app connected to your environment?
  10. **Written Incident Response & Breach Call Tree:** Do you and your MSP have a shared 24/7 emergency call tree defining who to call during a ransomware or wire-fraud incident on a weekend?

### Module 4: The Deliverable Engine (MSP Ticket Generator + Board One-Pager)
- **Tab A: Auto-Generated MSP Support Tickets (Copy-Paste Ready)**
  - Dynamically compiles every failed/warned item from Modules 1, 2, and 3 into categorized, high-priority help desk tickets:
    - *Ticket #1: Email Authentication & Domain Hardening (SPF/DKIM/DMARC & HTTP Headers)* — includes exact recommended DNS TXT record strings and `vercel.json` / server header configs.
    - *Ticket #2: Urgent Identity Hygiene, MFA Enforcement & License Reclamation* — lists the exact usernames from the CSV needing MFA enforcement, offboarding/disabling, admin privilege removal, and license removal (citing exact $/year savings).
    - *Ticket #3: MSP Security Baseline & SLA Governance Alignment* — lists every "No" or "Unsure" item from the 10-question scorecard as formal action requests (e.g., implementing help-desk caller verification and scheduling a backup restore fire drill).
  - Includes 1-click **"Copy Ticket to Clipboard"** and **"Open in Email Client (`mailto:`)"** buttons.
- **Tab B: Board-Ready Cyber Risk One-Pager**
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

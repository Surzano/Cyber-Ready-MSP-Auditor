/** Module 3 — 10-Question MSP Accountability Scorecard. */
import { letterGrade } from "./grading";

export type Answer = "yes" | "partial" | "no";
export type Answers = Partial<Record<string, Answer>>;

export const ANSWER_POINTS: Record<Answer, number> = { yes: 10, partial: 4, no: 0 };

export interface Question {
  id: string;
  title: string;
  question: string;
  why: string;
  askMsp: string;
  /** Formal action request used in Ticket #3 when the answer is No / Unsure. */
  action: string;
  risk: "fraud" | "ransomware" | "compliance";
}

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    title: "Phishing-Resistant MFA Enforcement",
    question:
      "Does your MSP enforce MFA on every account, including executives and board members, using an authenticator app or security key rather than text-message (SMS) codes?",
    why: "Microsoft reports that MFA blocks more than 99.9% of automated account-takeover attacks. SMS codes can be stolen through SIM swapping, and a single exempted executive or board account is where attackers aim first.",
    askMsp: "Can you send us a report from our tenant showing every account, its MFA method, and any Conditional Access exclusions?",
    action:
      "Enforce MFA for 100% of user, admin, and board accounts via Conditional Access / Security Defaults (2-Step Verification enforced in Google). Disable SMS and voice as methods, and require authenticator-app push notifications with number matching, or FIDO2 security keys, for all admins. Provide an exclusions report.",
    risk: "fraud",
  },
  {
    id: "q2",
    title: "Help Desk Caller Identity Verification",
    question:
      "If someone calls your MSP help desk claiming to be an employee locked out of their account, does the MSP require technical out-of-band verification (like a push notification or callback to a manager) before resetting a password?",
    why: "Attackers routinely phone help desks pretending to be staff; this was the reported entry point in the 2023 MGM Resorts breach. Knowing a name and job title from LinkedIn should never be enough to reset a password or MFA device.",
    askMsp: "Walk us through, step by step, exactly how your technician verifies a caller is really our employee before resetting their password or MFA.",
    action:
      "Implement and document a technical caller-verification procedure for all password and MFA resets: verify with an authenticator push or Entra Verified ID, or a callback to the number on file, plus approval from the user's manager. Never accept caller-supplied phone numbers or knowledge-based answers alone. Share the written SOP with us.",
    risk: "fraud",
  },
  {
    id: "q3",
    title: "Immutable 3-2-1 Backups & Restore Drills",
    question:
      "Does your MSP back up cloud data (Microsoft 365 SharePoint and OneDrive, or Google Drive, not just servers), and has it shown you proof of a successful test restore in the last 6 months?",
    why: "Microsoft and Google don't guarantee that you can recover deleted or encrypted data. A backup that has never been test-restored is a hope, not a plan, and ransomware groups go after backups first.",
    askMsp: "When was our last successful test restore of SharePoint/OneDrive (or Google Drive) data, and can we see the report?",
    action:
      "Confirm third-party, immutable backups of Microsoft 365 / Google Workspace (Exchange/Gmail, SharePoint/OneDrive/Drive, Teams) following the 3-2-1 rule. Schedule a backup restore fire drill within 30 days and deliver a written restore report (data restored, time to restore) twice yearly.",
    risk: "ransomware",
  },
  {
    id: "q4",
    title: "24/7 Endpoint Detection & Response",
    question:
      "Are all of the organization's laptops running monitored EDR/MDR software (such as Defender for Business, Huntress, or CrowdStrike) rather than traditional antivirus?",
    why: "Traditional antivirus often misses modern ransomware. EDR watches for suspicious behavior and, just as important, someone is responding to its alerts at 2 a.m. on a Saturday.",
    askMsp: "Which EDR product is on each of our devices, who monitors the alerts 24/7, and what is the response time?",
    action:
      "Deploy managed EDR/MDR (e.g., Microsoft Defender for Business, Huntress, CrowdStrike) on 100% of laptops and servers with 24/7 monitored alerting. Provide a device coverage report and the escalation SLA.",
    risk: "ransomware",
  },
  {
    id: "q5",
    title: "Automated OS & Third-Party Patching",
    question:
      "Does your MSP provide a monthly report showing that Windows, macOS, and third-party apps such as Chrome, Adobe Reader, and Zoom are patched within 14 days of critical updates?",
    why: "Many breaches exploit vulnerabilities that already had a patch available. Third-party apps such as browsers, Adobe Reader, and Zoom are often left out of basic MSP patching.",
    askMsp: "Can you send us this month's patch compliance report, including third-party applications?",
    action:
      "Provide a monthly patch compliance report covering OS and third-party applications (browsers, Adobe, Zoom, Java). Commit to a 14-day SLA for critical patches and 48 hours for actively exploited vulnerabilities (CISA KEV).",
    risk: "ransomware",
  },
  {
    id: "q6",
    title: "15-Minute Offboarding Kill-Switch",
    question:
      "When an employee or volunteer leaves, does your MSP have a documented SLA to revoke all logins, active sessions, OAuth tokens, and email forwarding within 15 minutes of notification?",
    why: "Former staff and volunteers who keep their access are a common cause of data leaks, and their idle licenses quietly cost money every month.",
    askMsp: "What is your written SLA for fully revoking a departing user's access, and can you show us the offboarding checklist?",
    action:
      "Adopt a documented offboarding SLA: within 15 minutes of notification, block sign-in, revoke sessions and refresh tokens, reset MFA, remove email forwarding and delegated access, and reclaim licenses. Confirm completion back to us in writing.",
    risk: "compliance",
  },
  {
    id: "q7",
    title: "Silent Inbox Auto-Forwarding & BEC Monitoring",
    question:
      "Has your MSP blocked external email auto-forwarding at the tenant level and enabled alerts for suspicious inbox rules or impossible-travel logins?",
    why: "In business email compromise, attackers secretly forward a finance inbox to themselves and wait for an invoice to hijack. Nonprofits have lost six-figure payments this way.",
    askMsp: "Is external auto-forwarding blocked in our tenant, and who gets alerted when a new inbox rule or a login from another country appears?",
    action:
      "Block automatic external email forwarding at the tenant level (outbound spam policy / Gmail routing), enable alerts for suspicious inbox rules, impossible travel, and risky sign-ins, and route alerts to a monitored queue.",
    risk: "fraud",
  },
  {
    id: "q8",
    title: "Removal of Local Admin Privileges",
    question:
      "Do regular staff members operate as standard users on their laptops (requiring MSP elevation to install software), rather than holding full Local Administrator rights?",
    why: "When a staff member with admin rights clicks a malicious link, the malware gets admin rights too. Removing local admin rights limits the damage from most critical Windows vulnerabilities.",
    askMsp: "How many of our users currently have local administrator rights on their computers?",
    action:
      "Remove local administrator rights from all standard user accounts; implement a just-in-time elevation process (e.g., Intune Endpoint Privilege Management or Windows LAPS for IT). Provide a report of remaining local admins.",
    risk: "ransomware",
  },
  {
    id: "q9",
    title: "Live Hardware & Shadow IT Asset Inventory",
    question:
      "Can your MSP hand you an up-to-date list today of every laptop, mobile device, and third-party cloud app connected to your environment?",
    why: "You can't protect what you don't know exists. Grant funders and cyber insurers increasingly require an asset inventory, and forgotten devices are rarely patched.",
    askMsp: "Please send us our current device inventory and a list of the third-party apps that can access our Microsoft 365 or Google data.",
    action:
      "Deliver a current inventory of all devices (laptops, mobiles, servers) and all third-party OAuth/SaaS apps with access to our tenant. Review and remove unused app consents; refresh the inventory quarterly.",
    risk: "compliance",
  },
  {
    id: "q10",
    title: "Written Incident Response & Breach Call Tree",
    question:
      "Do you and your MSP have a shared 24/7 emergency call tree defining who to call during a ransomware or wire-fraud incident on a weekend?",
    why: "After a fraudulent wire transfer, the best chance of getting the money back is in the first 72 hours. Confusion over who to call on a weekend can turn a recoverable incident into a permanent loss.",
    askMsp: "If we're hit by ransomware at 9 p.m. on a Friday, who exactly do we call, and what happens in the first hour?",
    action:
      "Co-develop a written incident response plan and 24/7 call tree (MSP emergency line, ED, board chair, bank fraud line, cyber insurer, legal counsel). Run a 1-hour tabletop exercise with leadership within 60 days.",
    risk: "compliance",
  },
];

export interface ScorecardResult {
  answered: number;
  score: number;
  grade: string;
  gaps: { q: Question; answer: Answer }[];
}

export function scoreAnswers(answers: Answers): ScorecardResult {
  let score = 0;
  let answered = 0;
  const gaps: ScorecardResult["gaps"] = [];
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (!a) continue;
    answered++;
    score += ANSWER_POINTS[a];
    if (a !== "yes") gaps.push({ q, answer: a });
  }
  return { answered, score, grade: letterGrade(score), gaps };
}

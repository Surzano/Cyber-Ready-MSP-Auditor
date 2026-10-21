"use client";

import { CheckCircle2, ClipboardCheck, Lock, Radar, RotateCcw, ShieldCheck, Ticket, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { simulatedScan } from "@/lib/domain/simulated";
import { auditCsv, type IdentityAudit } from "@/lib/identity";
import { compositeScore } from "@/lib/reports";
import { SAMPLE_ORG, SAMPLE_SCORECARD, buildSampleCsv, type OrgProfile } from "@/lib/sampleData";
import { scoreAnswers, type Answer, type Answers } from "@/lib/scorecard";
import type { DomainScanResult } from "@/lib/types";
import { ActionPlan } from "./ActionPlan";
import { DomainScanner } from "./DomainScanner";
import { IdentityAuditor } from "./IdentityAuditor";
import { MspScorecard } from "./MspScorecard";
import { GradeBadge, cx } from "./ui";

type TabKey = "domain" | "identity" | "msp" | "action";

const BLANK_ORG: OrgProfile = {
  orgName: "Your Organization",
  staffCount: 0,
  mspName: "Your MSP",
  mspEmail: "",
  domain: "",
  preparedBy: "Cyber Ready Clinic",
};

export function AuditorApp() {
  const [tab, setTab] = useState<TabKey>("domain");
  const [org, setOrg] = useState<OrgProfile>(BLANK_ORG);
  const [domain, setDomain] = useState<DomainScanResult | null>(null);
  const [identity, setIdentity] = useState<IdentityAudit | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [actionView, setActionView] = useState<"tickets" | "board">("tickets");

  const scorecard = useMemo(() => scoreAnswers(answers), [answers]);
  const ctx = useMemo(() => ({ org, domain, identity, scorecard }), [org, domain, identity, scorecard]);
  const composite = useMemo(() => compositeScore(ctx), [ctx]);

  function loadSampleTenant() {
    setIdentity(auditCsv(buildSampleCsv(), "Sample: Hope Valley Community Services (synthetic)"));
    setOrg((o) => (o === BLANK_ORG ? SAMPLE_ORG : o));
  }

  function loadFullDemo() {
    setOrg(SAMPLE_ORG);
    setDomain(simulatedScan());
    setIdentity(auditCsv(buildSampleCsv(), "Sample: Hope Valley Community Services (synthetic)"));
    setAnswers(SAMPLE_SCORECARD);
    setDemoLoaded(true);
    setTab("domain");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Presenter shortcut: /?demo=1 opens with the full case study loaded (optionally &tab=action).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("demo")) return;
    loadFullDemo();
    const t = params.get("tab");
    if (t === "domain" || t === "identity" || t === "msp" || t === "action") setTab(t);
    if (params.get("view") === "board") setActionView("board");
  }, []);

  function resetAll() {
    setOrg(BLANK_ORG);
    setDomain(null);
    setIdentity(null);
    setAnswers({});
    setDemoLoaded(false);
    setTab("domain");
  }

  const tabs: { key: TabKey; n: number; label: string; Icon: typeof Radar; grade: string | null; done: boolean }[] = [
    { key: "domain", n: 1, label: "Domain & Website", Icon: Radar, grade: domain?.grade ?? null, done: !!domain },
    { key: "identity", n: 2, label: "Identity & Licenses", Icon: Users, grade: identity?.grade ?? null, done: !!identity },
    { key: "msp", n: 3, label: "MSP Report Card", Icon: ClipboardCheck, grade: scorecard.answered === 10 ? scorecard.grade : null, done: scorecard.answered === 10 },
    { key: "action", n: 4, label: "Action Plan & Tickets", Icon: Ticket, grade: composite.grade, done: composite.score !== null },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white print:hidden">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/15 ring-1 ring-emerald-400/30">
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.2em] text-emerald-300/90 uppercase">Cyber Ready Clinic</div>
              <h1 className="text-lg leading-tight font-bold tracking-tight sm:text-xl">
                &ldquo;Trust, But Verify&rdquo; MSP Security Auditor
                <span className="hidden font-normal text-slate-400 md:inline"> &amp; Action Ticket Generator</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-400/10 px-3.5 py-2 ring-1 ring-emerald-400/30">
            <Lock className="h-4 w-4 shrink-0 text-emerald-300" />
            <div className="leading-tight">
              <div className="text-xs font-bold text-emerald-200">Zero Data Retention</div>
              <div className="text-[11px] text-emerald-100/70">100% Client-Side Processing for Internal Data</div>
            </div>
          </div>
        </div>
      </header>

      {/* Demo bar */}
      <div className="border-b border-amber-200/60 bg-gradient-to-r from-amber-50 via-white to-amber-50 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={loadFullDemo}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 px-4 py-2 text-sm font-bold text-navy-950 shadow-lg shadow-amber-500/25 transition hover:from-amber-300 hover:to-amber-200 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              ⚡ Load Full Presentation Demo
            </button>
            <div className="hidden text-slate-600 sm:block">
              {demoLoaded ? (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <b className="text-slate-800">{SAMPLE_ORG.orgName}</b> — {SAMPLE_ORG.staffCount} Staff, Managed by {SAMPLE_ORG.mspName}
                  <span className="hidden text-slate-400 xl:inline">· live scans still work in Tab 1</span>
                </span>
              ) : (
                <>Nonprofit case study: <b className="text-slate-800">Hope Valley Community Services</b> — 24 staff, managed by Apex IT MSP</>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {composite.score !== null && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Overall readiness <GradeBadge grade={composite.grade} size="sm" />
              </div>
            )}
            <button onClick={resetAll} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden" aria-label="Audit modules">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={cx(
                "group flex shrink-0 items-center gap-2.5 border-b-2 px-3 py-3.5 text-sm font-semibold transition",
                tab === t.key ? "border-emerald-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <span
                className={cx(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                  t.done ? "bg-emerald-600 text-white" : tab === t.key ? "bg-navy-900 text-white" : "bg-slate-200 text-slate-600",
                )}
              >
                {t.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : t.n}
              </span>
              <t.Icon className="h-4 w-4 opacity-70" />
              {t.label}
              {t.grade && (
                <span className={cx("rounded-md px-1.5 py-0.5 text-[11px] font-bold", t.grade.startsWith("A") || t.grade === "B" ? "bg-emerald-50 text-emerald-700" : t.grade === "F" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800")}>
                  {t.grade}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Keep every module mounted so in-progress form state survives tab switches. */}
        <div hidden={tab !== "domain"}>
          <DomainScanner
            result={domain}
            onResult={(r) => {
              setDomain(r);
              setOrg((o) => ({ ...o, domain: r.domain }));
            }}
          />
        </div>
        <div hidden={tab !== "identity"}>
          <IdentityAuditor audit={identity} onAudit={setIdentity} onLoadSample={loadSampleTenant} />
        </div>
        <div hidden={tab !== "msp"}>
          <MspScorecard
            answers={answers}
            result={scorecard}
            mspName={org.mspName}
            onChange={(id: string, a: Answer) => setAnswers((prev) => ({ ...prev, [id]: a }))}
            onReset={() => setAnswers({})}
          />
        </div>
        <div hidden={tab !== "action"}>
          <ActionPlan ctx={ctx} onOrgChange={setOrg} view={actionView} onViewChange={setActionView} />
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-5 text-xs text-slate-500">
          <div>
            Built by <b className="text-slate-700">Surzano R. Solomon</b> · Cybersecurity Practitioner Intern, Cyber Ready Clinic
          </div>
          <div>Passive checks only · No data stored · Demo data is synthetic</div>
        </div>
      </footer>
    </div>
  );
}

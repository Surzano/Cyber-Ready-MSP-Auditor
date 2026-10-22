"use client";

import { Lock, RotateCcw } from "lucide-react";
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
  preparedBy: "",
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

  const steps: { key: TabKey; n: number; label: string; grade: string | null; done: boolean }[] = [
    { key: "domain", n: 1, label: "Email & website", grade: domain?.grade ?? null, done: !!domain },
    { key: "identity", n: 2, label: "Users & licenses", grade: identity?.grade ?? null, done: !!identity },
    { key: "msp", n: 3, label: "Ask your MSP", grade: scorecard.answered === 10 ? scorecard.grade : null, done: scorecard.answered === 10 },
    { key: "action", n: 4, label: "Tickets & board brief", grade: composite.grade, done: composite.score !== null },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-300 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-serif text-2xl font-semibold text-ink-900 sm:text-3xl">MSP Auditor</h1>
            <p className="text-sm text-stone-600">A security check-up for nonprofits and the IT company that runs their systems.</p>
          </div>
          <nav className="flex items-center gap-5 text-sm text-stone-600">
            <a href="#privacy" className="underline decoration-stone-400 underline-offset-4 hover:text-ink-900">How your data is handled</a>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr] lg:gap-12">
        <aside className="print:hidden lg:sticky lg:top-6 lg:self-start">
          <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-stone-300 bg-stone-300 lg:grid-cols-1" aria-label="Audit steps">
            {steps.map((s) => (
              <li key={s.key}>
                <button
                  onClick={() => setTab(s.key)}
                  aria-current={tab === s.key ? "step" : undefined}
                  className={cx("flex h-full w-full items-baseline gap-3 px-4 py-3 text-left transition", tab === s.key ? "bg-ink-900 text-paper" : "bg-paper text-ink-900 hover:bg-stone-100")}
                >
                  <span className={cx("font-serif text-2xl leading-none", tab === s.key ? "text-ochre-300" : "text-stone-400")}>{s.n}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className={cx("block text-xs", tab === s.key ? "text-stone-300" : "text-stone-500")}>
                      {s.grade ? `Grade ${s.grade}` : s.done ? "Done" : "Not started"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          {composite.score !== null && (
            <div className="mt-4 flex items-center justify-between rounded-md border border-stone-300 bg-paper px-4 py-3">
              <span className="text-sm text-stone-600">Overall</span>
              <GradeBadge grade={composite.grade} size="sm" />
            </div>
          )}

          <div className="mt-6 hidden text-sm leading-relaxed text-stone-600 lg:block">
            {demoLoaded ? (
              <p>
                Showing sample data for <b className="font-medium text-ink-900">{SAMPLE_ORG.orgName}</b>, a made-up {SAMPLE_ORG.staffCount}-person nonprofit. Live scans in step 1 still work.
              </p>
            ) : (
              <p>No data handy? Walk through the whole thing with a made-up 24-person nonprofit.</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {!demoLoaded && (
              <button onClick={loadFullDemo} className="text-sm font-medium text-moss-700 underline decoration-moss-300 underline-offset-4 hover:text-moss-900">
                Load sample data
              </button>
            )}
            <button onClick={resetAll} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-ink-900">
              <RotateCcw className="h-3.5 w-3.5" /> Start over
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          {/* Keep every module mounted so in-progress form state survives step switches. */}
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
      </div>

      <footer id="privacy" className="border-t border-stone-300 print:hidden">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm leading-relaxed text-stone-600 sm:px-6 md:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-ink-900">
              <Lock className="h-4 w-4" /> How your data is handled
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>Your user list and your report card answers stay in this browser tab. They are never uploaded, stored, or logged. Refreshing the page erases them.</li>
              <li>The only thing that leaves your browser is the domain name you type in step 1. It is used to look up public DNS records and public website headers, the same information any email server or web browser can see.</li>
              <li>No accounts, no cookies, no analytics.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink-900">About</h2>
            <p className="mt-3">
              Built by Surzano R. Solomon. These are passive, point-in-time checks, not a penetration test. All sample data is made up.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

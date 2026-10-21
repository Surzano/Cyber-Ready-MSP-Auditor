"use client";

import { Code2, FlaskConical, Globe, Loader2, Mail, MessageSquareText, Radar, Search, ServerCog, ShieldAlert, WifiOff } from "lucide-react";
import { useState } from "react";
import { ScanError, scanDomain } from "@/lib/domain/clientScan";
import { simulatedScan } from "@/lib/domain/simulated";
import type { CheckResult, DomainScanResult } from "@/lib/types";
import { Button, Card, ClinicBadge, GradeBadge, SectionTitle, StatusPill, cx } from "./ui";

const MODE_LABEL: Record<DomainScanResult["mode"], { label: string; cls: string; Icon: typeof Radar }> = {
  "live-server": { label: "Live scan · Serverless API (DNS + HTTP headers)", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: ServerCog },
  "live-doh": { label: "Live scan · Browser DNS-over-HTTPS (email checks only)", cls: "bg-sky-50 text-sky-700 ring-sky-200", Icon: Globe },
  simulated: { label: "Simulated Demo Domain · offline", cls: "bg-amber-50 text-amber-800 ring-amber-200", Icon: FlaskConical },
};

const SCAN_STEPS = ["Sanitizing domain", "Querying SPF TXT & counting DNS lookups", "Reading _dmarc policy", "Probing DKIM selectors", "Inspecting HTTPS & security headers"];

export function DomainScanner({
  result,
  onResult,
  initialDomain,
}: {
  result: DomainScanResult | null;
  onResult: (r: DomainScanResult) => void;
  initialDomain?: string;
}) {
  const [input, setInput] = useState(initialDomain ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ScanError | null>(null);
  const [view, setView] = useState<"plain" | "technical">("plain");

  async function runScan(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      onResult(await scanDomain(input));
    } catch (err) {
      setError(err instanceof ScanError ? err : new ScanError(String(err), "OFFLINE"));
    } finally {
      setLoading(false);
    }
  }

  function runSimulated() {
    setError(null);
    onResult(simulatedScan());
  }

  const email = result?.checks.filter((c) => c.category === "email") ?? [];
  const web = result?.checks.filter((c) => c.category === "web") ?? [];
  const counts = result
    ? (["pass", "warn", "fail"] as const).map((s) => ({ s, n: result.checks.filter((c) => c.status === s).length }))
    : [];

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<Radar className="h-5 w-5" />}
        title="Domain & Website Scanner"
        subtitle="Passive, non-intrusive checks of the same public records every email provider and browser reads: SPF, DKIM, DMARC, and HTTP security headers. No login, no agents, nothing touches your internal systems."
        ids={["email-securi-15", "website-atta-05"]}
      />

      <Card className="p-5">
        <form onSubmit={runScan} className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Domain to scan</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type any domain — e.g. redcross.org or paste https://www.example.org/donate"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pr-4 pl-10 text-[15px] text-slate-900 shadow-inner shadow-slate-100 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15"
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
            />
          </label>
          <Button type="submit" disabled={loading || !input.trim()} className="py-3 md:w-40">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            {loading ? "Scanning…" : "Scan Live"}
          </Button>
          <Button variant="secondary" onClick={runSimulated} disabled={loading} className="py-3" title="Offline-safe sample results for Hope Valley Community Services">
            <FlaskConical className="h-4 w-4" />
            Simulated Demo Domain
          </Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          URLs, email addresses and paths are cleaned automatically. Live scans use the serverless API when available and fall back to DNS-over-HTTPS in your browser.
        </p>

        {loading && (
          <ol className="mt-4 grid gap-2 sm:grid-cols-5">
            {SCAN_STEPS.map((s, i) => (
              <li key={s} className="animate-fade-up flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" style={{ animationDelay: `${i * 250}ms` }}>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-600" />
                {s}
              </li>
            ))}
          </ol>
        )}

        {error && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              {error.code === "OFFLINE" ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{error.message}</span>
            </div>
            {error.code === "OFFLINE" && (
              <Button variant="dark" onClick={runSimulated} className="shrink-0">
                <FlaskConical className="h-4 w-4" /> Use Simulated Demo Domain
              </Button>
            )}
          </div>
        )}
      </Card>

      {result && (
        <div className="animate-fade-up space-y-6" key={result.scannedAt}>
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <Card className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Domain & Web Security Grade</div>
              <GradeBadge grade={result.grade} size="xl" />
              <div>
                <div className="text-lg font-bold break-all text-slate-900">{result.domain}</div>
                <div className="text-sm text-slate-500 tabular-nums">{result.score}/100 points</div>
              </div>
              <div className="flex gap-2">
                {counts.map(({ s, n }) => (
                  <StatusPill key={s} status={s} label={`${n} ${s === "pass" ? "Pass" : s === "warn" ? "Warn" : "Fail"}`} />
                ))}
              </div>
              <dl className="w-full space-y-1.5 border-t border-slate-100 pt-4 text-left text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Email provider</dt>
                  <dd className="font-medium text-slate-800">{result.emailProvider}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">MX</dt>
                  <dd className="truncate font-mono text-slate-700" title={result.mx.join(", ")}>
                    {result.mx[0]?.split(" ").pop() ?? "none"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Scanned</dt>
                  <dd className="text-slate-700">{new Date(result.scannedAt).toLocaleString()}</dd>
                </div>
              </dl>
              <ModeChip mode={result.mode} />
            </Card>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="Result view">
                  {(
                    [
                      ["plain", "Plain-English Nonprofit Impact", MessageSquareText],
                      ["technical", "Technical Raw Record View", Code2],
                    ] as const
                  ).map(([v, label, Icon]) => (
                    <button
                      key={v}
                      role="tab"
                      aria-selected={view === v}
                      onClick={() => setView(v)}
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                        view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <CheckGroup title="Email Authentication — Anti-Spoofing" icon={<Mail className="h-4 w-4" />} clinicId="email-securi-15" checks={email} view={view} />
              {web.length > 0 ? (
                <CheckGroup title="Website Security Headers" icon={<Globe className="h-4 w-4" />} clinicId="website-atta-05" checks={web} view={view} />
              ) : (
                <Card className="border-dashed p-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Globe className="h-4 w-4" /> Website Security Headers <ClinicBadge id="website-atta-05" />
                  </div>
                  <p className="mt-1">
                    Not graded in browser-only mode — browsers block reading another website&apos;s response headers. Deploy with the serverless API (e.g. Vercel) to include the website grade.
                  </p>
                </Card>
              )}
            </div>
          </div>

          {result.notes.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
              {result.notes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ModeChip({ mode }: { mode: DomainScanResult["mode"] }) {
  const m = MODE_LABEL[mode];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", m.cls)}>
      <m.Icon className="h-3.5 w-3.5" />
      {m.label}
    </span>
  );
}

function CheckGroup({ title, icon, clinicId, checks, view }: { title: string; icon: React.ReactNode; clinicId: string; checks: CheckResult[]; view: "plain" | "technical" }) {
  const earned = checks.reduce((s, c) => s + c.points, 0);
  const max = checks.reduce((s, c) => s + c.maxPoints, 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          {icon}
          {title}
          <ClinicBadge id={clinicId} />
        </div>
        <div className="text-xs font-semibold text-slate-500 tabular-nums">
          {earned}/{max} pts
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {checks.map((c) => (
          <li
            key={c.id}
            className={cx(
              "border-l-4 px-5 py-4",
              c.status === "pass" ? "border-l-emerald-500" : c.status === "warn" ? "border-l-amber-400" : c.status === "fail" ? "border-l-rose-500" : "border-l-sky-400",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusPill status={c.status} />
                <span className="font-semibold text-slate-900">{c.label}</span>
              </div>
              <span className="text-xs font-medium text-slate-400 tabular-nums">
                {c.points}/{c.maxPoints}
              </span>
            </div>
            <div className="mt-1 text-sm font-medium text-slate-700">{c.summary}</div>
            {view === "plain" ? (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{c.plain}</p>
            ) : (
              <div className="mt-2 space-y-2">
                <pre className="overflow-x-auto rounded-lg bg-navy-950 px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-emerald-200">
                  {c.raw.length ? c.raw.join("\n") : "(no record / header observed)"}
                </pre>
                {c.notes.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-slate-500">
                    {c.notes.map((n) => (
                      <li key={n}>› {n}</li>
                    ))}
                  </ul>
                )}
                {c.fix && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="text-[11px] font-bold tracking-wide text-emerald-700 uppercase">Recommended fix</div>
                    <pre className="mt-1 overflow-x-auto font-mono text-[12px] whitespace-pre-wrap text-emerald-900">{c.fix}</pre>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

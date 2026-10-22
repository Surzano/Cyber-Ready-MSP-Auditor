"use client";

import { Code2, FlaskConical, Globe, Loader2, Mail, MessageSquareText, Radar, Search, ServerCog, ShieldAlert, WifiOff } from "lucide-react";
import { useState } from "react";
import { isNullMx } from "@/lib/domain/analyze";
import { ScanError, scanDomain } from "@/lib/domain/clientScan";
import { simulatedScan } from "@/lib/domain/simulated";
import type { CheckResult, DomainScanResult } from "@/lib/types";
import { Button, Card, GradeBadge, SectionTitle, StatusPill, cx } from "./ui";

const MODE_LABEL: Record<DomainScanResult["mode"], { label: string; cls: string; Icon: typeof Radar }> = {
  "live-server": { label: "Live check · email and website", cls: "bg-moss-50 text-moss-700 ring-moss-200", Icon: ServerCog },
  "live-doh": { label: "Live check · email only", cls: "bg-harbor-50 text-harbor-700 ring-harbor-200", Icon: Globe },
  simulated: { label: "Sample domain · offline", cls: "bg-ochre-50 text-ochre-800 ring-ochre-200", Icon: FlaskConical },
};

const SCAN_STEPS = ["Cleaning up the address", "Checking SPF and counting DNS lookups", "Reading the DMARC policy", "Looking for DKIM keys", "Checking HTTPS and security headers"];

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

  // When a result arrives from anywhere (scan, simulated, sample data), show its cleaned domain in the box.
  const [shownDomain, setShownDomain] = useState(result?.domain);
  if (result?.domain !== shownDomain) {
    setShownDomain(result?.domain);
    if (result) {
      setInput(result.domain);
      setError(null);
    }
  }

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
        step={1}
        title="Email & website"
        subtitle="Can someone send email that looks like it came from you? Is your website set up safely? This reads the same public records every mail server and browser already sees (SPF, DKIM, DMARC and security headers). No login, nothing installed."
      />

      <Card className="p-5">
        <form onSubmit={runScan} className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Domain to scan</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your domain, like example.org, or paste your website address"
              className="w-full rounded-md border border-stone-300 bg-paper py-3 pr-4 pl-10 text-[15px] text-stone-900 outline-none placeholder:text-stone-400 focus:border-moss-500 focus:ring-4 focus:ring-moss-500/15"
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
            />
          </label>
          <Button type="submit" disabled={loading || !input.trim()} className="py-3 md:w-40">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            {loading ? "Checking…" : "Check domain"}
          </Button>
          <Button variant="secondary" onClick={runSimulated} disabled={loading} className="py-3" title="Offline-safe sample results for Hope Valley Community Services">
            <FlaskConical className="h-4 w-4" />
            Try a sample domain
          </Button>
        </form>
        <p className="mt-3 text-xs text-stone-500">
          You can paste a full web address or an email address; it will be trimmed to the domain. Only public records are read.
        </p>

        {loading && (
          <ol className="mt-4 grid gap-2 sm:grid-cols-5">
            {SCAN_STEPS.map((s, i) => (
              <li key={s} className="animate-fade-up flex items-center gap-2 rounded bg-stone-50 px-3 py-2 text-xs text-stone-600" style={{ animationDelay: `${i * 250}ms` }}>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-moss-600" />
                {s}
              </li>
            ))}
          </ol>
        )}

        {error && (
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-brick-200 bg-brick-50 p-4 text-sm text-brick-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              {error.code === "OFFLINE" ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{error.message}</span>
            </div>
            {error.code === "OFFLINE" && (
              <Button variant="dark" onClick={runSimulated} className="shrink-0">
                <FlaskConical className="h-4 w-4" /> Use the sample domain instead
              </Button>
            )}
          </div>
        )}
      </Card>

      {result && (
        <div className="animate-fade-up space-y-6" key={result.scannedAt}>
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <Card className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Grade</div>
              <GradeBadge grade={result.grade} size="xl" />
              <div>
                <div className="text-lg font-bold break-all text-stone-900">{result.domain}</div>
                <div className="text-sm text-stone-500 tabular-nums">{result.score}/100 points</div>
              </div>
              <div className="flex gap-2">
                {counts.map(({ s, n }) => (
                  <StatusPill key={s} status={s} label={`${n} ${s === "pass" ? "Pass" : s === "warn" ? "Warn" : "Fail"}`} />
                ))}
              </div>
              <dl className="w-full space-y-1.5 border-t border-stone-100 pt-4 text-left text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500">Email provider</dt>
                  <dd className="font-medium text-stone-800">{result.emailProvider}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500">MX</dt>
                  <dd className="truncate font-mono text-stone-700" title={result.mx.join(", ")}>
                    {isNullMx(result.mx) ? "null MX (no mail)" : (result.mx[0]?.split(" ").pop() ?? "none")}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-stone-500">Scanned</dt>
                  <dd className="text-stone-700">{new Date(result.scannedAt).toLocaleString()}</dd>
                </div>
              </dl>
              <ModeChip mode={result.mode} />
            </Card>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-md bg-stone-200/70 p-1" role="tablist" aria-label="Result view">
                  {(
                    [
                      ["plain", "Plain English", MessageSquareText],
                      ["technical", "Technical detail", Code2],
                    ] as const
                  ).map(([v, label, Icon]) => (
                    <button
                      key={v}
                      role="tab"
                      aria-selected={view === v}
                      onClick={() => setView(v)}
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition",
                        view === v ? "bg-paper text-stone-900" : "text-stone-600 hover:text-stone-900",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <CheckGroup title="Email: can someone pretend to be you?" icon={<Mail className="h-4 w-4" />} checks={email} view={view} />
              {web.length > 0 ? (
                <CheckGroup title="Website security headers" icon={<Globe className="h-4 w-4" />} checks={web} view={view} />
              ) : (
                <Card className="border-dashed p-4 text-sm text-stone-600">
                  <div className="flex items-center gap-2 font-semibold text-stone-800">
                    <Globe className="h-4 w-4" /> Website Security Headers
                  </div>
                  <p className="mt-1">
                    {result.web.error
                      ? `Not graded this time: ${result.web.error}. The grade above covers email only. Try again in a few minutes.`
                      : "Not graded in browser-only mode, because browsers can't read another website's response headers. The grade above covers email only."}
                  </p>
                </Card>
              )}
            </div>
          </div>

          {result.notes.length > 0 && (
            <ul className="space-y-1 rounded-md bg-stone-100 px-4 py-3 text-xs text-stone-600">
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

function CheckGroup({ title, icon, checks, view }: { title: string; icon: React.ReactNode; checks: CheckResult[]; view: "plain" | "technical" }) {
  const earned = checks.reduce((s, c) => s + c.points, 0);
  const max = checks.reduce((s, c) => s + c.maxPoints, 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/70 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-stone-800">
          {icon}
          {title}
        </div>
        <div className="text-xs font-semibold text-stone-500 tabular-nums">
          {earned}/{max} pts
        </div>
      </div>
      <ul className="divide-y divide-stone-100">
        {checks.map((c) => (
          <li
            key={c.id}
            className={cx(
              "border-l-4 px-5 py-4",
              c.status === "pass" ? "border-l-moss-500" : c.status === "warn" ? "border-l-ochre-400" : c.status === "fail" ? "border-l-brick-500" : "border-l-harbor-400",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusPill status={c.status} />
                <span className="font-semibold text-stone-900">{c.label}</span>
              </div>
              <span className="text-xs font-medium text-stone-400 tabular-nums">
                {c.points}/{c.maxPoints}
              </span>
            </div>
            <div className="mt-1 text-sm font-medium text-stone-700">{c.summary}</div>
            {view === "plain" ? (
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{c.plain}</p>
            ) : (
              <div className="mt-2 space-y-2">
                <pre className="overflow-x-auto rounded bg-ink-950 px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-moss-200">
                  {c.raw.length ? c.raw.join("\n") : "(no record / header observed)"}
                </pre>
                {c.notes.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-stone-500">
                    {c.notes.map((n) => (
                      <li key={n}>› {n}</li>
                    ))}
                  </ul>
                )}
                {c.fix && (
                  <div className="rounded border border-moss-200 bg-moss-50 px-3 py-2">
                    <div className="text-[11px] font-bold tracking-wide text-moss-700 uppercase">Recommended fix</div>
                    <pre className="mt-1 overflow-x-auto font-mono text-[12px] whitespace-pre-wrap text-moss-900">{c.fix}</pre>
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

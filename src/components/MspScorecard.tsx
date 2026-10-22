"use client";

import { HelpCircle, MessageCircleQuestion, RotateCcw } from "lucide-react";
import { ANSWER_POINTS, QUESTIONS, type Answer, type Answers, type ScorecardResult } from "@/lib/scorecard";
import { Button, Card, GradeBadge, SectionTitle, Tooltip, cx } from "./ui";

const OPTIONS: { value: Answer; label: string; on: string }[] = [
  { value: "yes", label: "Yes", on: "bg-moss-600 text-white ring-moss-600" },
  { value: "partial", label: "Partial / Unsure", on: "bg-ochre-400 text-ink-950 ring-ochre-400" },
  { value: "no", label: "No", on: "bg-brick-600 text-white ring-brick-600" },
];

export function MspScorecard({
  answers,
  result,
  onChange,
  onReset,
  mspName,
}: {
  answers: Answers;
  result: ScorecardResult;
  onChange: (id: string, a: Answer) => void;
  onReset: () => void;
  mspName: string;
}) {
  const pct = (result.answered / QUESTIONS.length) * 100;
  return (
    <div className="space-y-6">
      <SectionTitle
        step={3}
        title="Ask your MSP"
        subtitle={`Ten controls that separate "keeping the lights on" from actually protecting the organization. Answer what you know today — "Unsure" is an answer, and it becomes a question for ${mspName || "your MSP"}.`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <ol className="space-y-3">
          {QUESTIONS.map((q, i) => {
            const a = answers[q.id];
            return (
              <li key={q.id}>
                <Card className={cx("p-5 transition", a === "no" && "ring-1 ring-brick-200", a === "partial" && "ring-1 ring-ochre-200", a === "yes" && "ring-1 ring-moss-200")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-ink-900 text-xs font-bold text-white tabular-nums">{i + 1}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-stone-900">{q.title}</h3>
                          <Tooltip label={<><b className="text-moss-300">Why this matters:</b> {q.why}</>}>
                            <HelpCircle className="h-4 w-4 text-stone-400 hover:text-moss-600" aria-label="Why this matters" />
                          </Tooltip>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-stone-600">{q.question}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pl-10">
                    <div className="inline-flex gap-1.5" role="radiogroup" aria-label={q.title}>
                      {OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          role="radio"
                          aria-checked={a === o.value}
                          onClick={() => onChange(q.id, o.value)}
                          className={cx(
                            "rounded px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                            a === o.value ? o.on : "bg-paper text-stone-600 ring-stone-300 hover:bg-stone-50",
                          )}
                        >
                          {o.label}
                          <span className="ml-1 opacity-70">({ANSWER_POINTS[o.value]})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {a && a !== "yes" && (
                    <div className="animate-fade-up mt-4 ml-10 flex items-start gap-2 rounded-md border border-harbor-200 bg-harbor-50 px-4 py-3 text-sm text-harbor-900">
                      <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-harbor-600" />
                      <div>
                        <div className="text-[11px] font-bold tracking-wide text-harbor-700 uppercase">What to ask {mspName || "your MSP"}</div>
                        <div className="mt-0.5">&ldquo;{q.askMsp}&rdquo;</div>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="space-y-4 p-6 text-center">
            <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">MSP Accountability Grade</div>
            <div className="flex justify-center">
              <GradeBadge grade={result.answered ? result.grade : null} size="xl" />
            </div>
            <div className="text-3xl font-semibold text-stone-900 tabular-nums">
              {result.score}
              <span className="text-lg font-semibold text-stone-400">/100</span>
            </div>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-moss-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-stone-500">{result.answered} of 10 answered</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(["yes", "partial", "no"] as const).map((v) => (
                <div key={v} className={cx("rounded py-2", v === "yes" ? "bg-moss-50 text-moss-700" : v === "partial" ? "bg-ochre-50 text-ochre-800" : "bg-brick-50 text-brick-700")}>
                  <div className="text-lg font-bold tabular-nums">{Object.values(answers).filter((x) => x === v).length}</div>
                  {v === "yes" ? "Yes" : v === "partial" ? "Unsure" : "No"}
                </div>
              ))}
            </div>
            {result.gaps.length > 0 && <p className="text-xs text-stone-500">{result.gaps.length} gaps will become formal requests in MSP Ticket #3.</p>}
            <Button variant="ghost" onClick={onReset} className="w-full text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Reset answers
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

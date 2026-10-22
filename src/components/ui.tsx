"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { gradeTone, toneClasses } from "@/lib/grading";
import type { Status } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const statusStyle: Record<Status, { cls: string; label: string; Icon: typeof CheckCircle2 }> = {
  pass: { cls: "bg-moss-50 text-moss-700 ring-moss-200", label: "Pass", Icon: CheckCircle2 },
  warn: { cls: "bg-ochre-50 text-ochre-800 ring-ochre-200", label: "Warning", Icon: AlertTriangle },
  fail: { cls: "bg-brick-50 text-brick-700 ring-brick-200", label: "Fail", Icon: XCircle },
  info: { cls: "bg-harbor-50 text-harbor-700 ring-harbor-200", label: "Info", Icon: Info },
};

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const s = statusStyle[status];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", s.cls)}>
      <s.Icon className="h-3.5 w-3.5" aria-hidden />
      {label ?? s.label}
    </span>
  );
}

export function GradeBadge({ grade, size = "md", score }: { grade: string | null; size?: "sm" | "md" | "lg" | "xl"; score?: number | null }) {
  const t = toneClasses[gradeTone(grade)];
  const dims = { sm: "h-7 w-7 text-base", md: "h-12 w-12 text-3xl", lg: "h-20 w-20 text-5xl", xl: "h-28 w-28 text-7xl" }[size];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cx("flex items-center justify-center rounded-sm border-2 font-serif leading-none font-semibold", dims, t.bg, t.text, t.border)}>{grade ?? "–"}</div>
      {score !== undefined && score !== null && <div className="text-xs text-stone-500 tabular-nums">{score} of 100</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-md border border-stone-300 bg-paper", className)}>{children}</div>;
}

export function SectionTitle({ step, title, subtitle, right }: { step?: number; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-stone-300 pb-5">
      <div>
        {step && <div className="text-sm text-stone-500">Step {step} of 4</div>}
        <h2 className="mt-1 font-serif text-3xl font-semibold text-ink-900 sm:text-4xl">{title}</h2>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-stone-600">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Tooltip({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("group relative inline-flex", className)}>
      <span tabIndex={0} className="inline-flex cursor-help rounded outline-none focus-visible:ring-2 focus-visible:ring-moss-500">
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 rounded bg-ink-950 px-3 py-2 text-xs leading-relaxed font-normal text-stone-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

export function Kpi({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone: "good" | "ok" | "bad" | "none"; icon: ReactNode }) {
  const t = toneClasses[tone];
  return (
    <Card className={cx("border-l-4 p-5", t.borderLeft)}>
      <div className="flex items-center gap-1.5 text-sm text-stone-600">
        <span className="text-stone-400">{icon}</span>
        {label}
      </div>
      <div className={cx("mt-1 font-serif text-4xl font-semibold tabular-nums", t.text)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-stone-500">{sub}</div>}
    </Card>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "dark";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  const styles = {
    primary: "bg-moss-700 text-white hover:bg-moss-800",
    secondary: "bg-paper text-ink-900 ring-1 ring-inset ring-stone-400 hover:bg-stone-100",
    ghost: "text-stone-600 hover:bg-stone-200/60",
    dark: "bg-ink-900 text-paper hover:bg-ink-700",
  }[variant];
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-moss-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed bg-transparent px-6 py-14 text-center">
      <div className="text-stone-400">{icon}</div>
      <div className="font-serif text-xl font-semibold text-ink-900">{title}</div>
      {children && <div className="max-w-lg text-sm text-stone-600">{children}</div>}
    </Card>
  );
}

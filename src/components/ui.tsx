"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { gradeTone, toneClasses } from "@/lib/grading";
import type { Status } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function ClinicBadge({ id, dark = false }: { id: string; dark?: boolean }) {
  return (
    <span
      title="Cyber Ready Clinic — Practitioner 1 Impact Project ID"
      className={cx(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-tight ring-1 ring-inset",
        dark ? "bg-white/5 text-slate-300 ring-white/15" : "bg-slate-50 text-slate-500 ring-slate-200",
      )}
    >
      {id}
    </span>
  );
}

const statusStyle: Record<Status, { cls: string; label: string; Icon: typeof CheckCircle2 }> = {
  pass: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Pass", Icon: CheckCircle2 },
  warn: { cls: "bg-amber-50 text-amber-800 ring-amber-200", label: "Warning", Icon: AlertTriangle },
  fail: { cls: "bg-rose-50 text-rose-700 ring-rose-200", label: "Fail", Icon: XCircle },
  info: { cls: "bg-sky-50 text-sky-700 ring-sky-200", label: "Info", Icon: Info },
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
  const dims = { sm: "h-7 w-7 text-sm", md: "h-12 w-12 text-2xl", lg: "h-20 w-20 text-4xl", xl: "h-28 w-28 text-6xl" }[size];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cx("flex items-center justify-center rounded-2xl font-extrabold tracking-tight ring-2 ring-inset", dims, t.bg, t.text, t.ring)}>
        {grade ?? "—"}
      </div>
      {score !== undefined && score !== null && <div className="text-xs font-medium tabular-nums text-slate-500">{score}/100</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function SectionTitle({ icon, title, subtitle, ids, right }: { icon: ReactNode; title: string; subtitle?: string; ids?: string[]; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-emerald-300">{icon}</div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
          {ids && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ids.map((id) => (
                <ClinicBadge key={id} id={id} />
              ))}
            </div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Tooltip({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("group relative inline-flex", className)}>
      <span tabIndex={0} className="inline-flex cursor-help rounded outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 rounded-lg bg-navy-950 px-3 py-2 text-xs leading-relaxed font-normal text-slate-100 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

export function Kpi({ label, value, sub, tone, icon, id }: { label: string; value: ReactNode; sub?: ReactNode; tone: "good" | "ok" | "bad" | "none"; icon: ReactNode; id?: string }) {
  const t = toneClasses[tone];
  return (
    <Card className="relative overflow-hidden p-5">
      <div className={cx("absolute inset-x-0 top-0 h-1", t.solid)} />
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
        <div className={cx("rounded-lg p-1.5", t.bg, t.text)}>{icon}</div>
      </div>
      <div className={cx("mt-2 text-3xl font-extrabold tracking-tight tabular-nums", t.text)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      {id && (
        <div className="mt-3">
          <ClinicBadge id={id} />
        </div>
      )}
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
  variant?: "primary" | "secondary" | "ghost" | "demo" | "dark";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  const styles = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm",
    secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100",
    demo: "bg-gradient-to-r from-amber-400 to-amber-300 text-navy-950 hover:from-amber-300 hover:to-amber-200 shadow-lg shadow-amber-500/20",
    dark: "bg-navy-900 text-white hover:bg-navy-800 shadow-sm",
  }[variant];
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed px-6 py-14 text-center">
      <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">{icon}</div>
      <div className="text-base font-semibold text-slate-800">{title}</div>
      {children && <div className="max-w-lg text-sm text-slate-600">{children}</div>}
    </Card>
  );
}

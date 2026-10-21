export function letterGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export type Tone = "good" | "ok" | "bad" | "none";

export function gradeTone(grade: string | null | undefined): Tone {
  if (!grade) return "none";
  if (grade.startsWith("A") || grade === "B") return "good";
  if (grade === "C" || grade === "D") return "ok";
  return "bad";
}

export const toneClasses: Record<Tone, { text: string; bg: string; ring: string; solid: string }> = {
  good: { text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", solid: "bg-emerald-600" },
  ok: { text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", solid: "bg-amber-500" },
  bad: { text: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", solid: "bg-rose-600" },
  none: { text: "text-slate-500", bg: "bg-slate-50", ring: "ring-slate-200", solid: "bg-slate-400" },
};

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
}

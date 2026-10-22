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

export const toneClasses: Record<Tone, { text: string; bg: string; ring: string; border: string; borderLeft: string; solid: string }> = {
  good: { text: "text-moss-700", bg: "bg-moss-50", ring: "ring-moss-200", border: "border-moss-600", borderLeft: "border-l-moss-600", solid: "bg-moss-600" },
  ok: { text: "text-ochre-700", bg: "bg-ochre-50", ring: "ring-ochre-200", border: "border-ochre-500", borderLeft: "border-l-ochre-500", solid: "bg-ochre-500" },
  bad: { text: "text-brick-700", bg: "bg-brick-50", ring: "ring-brick-200", border: "border-brick-600", borderLeft: "border-l-brick-600", solid: "bg-brick-600" },
  none: { text: "text-stone-500", bg: "bg-stone-50", ring: "ring-stone-200", border: "border-stone-300", borderLeft: "border-l-stone-300", solid: "bg-stone-400" },
};

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
}

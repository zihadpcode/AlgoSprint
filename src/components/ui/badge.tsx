import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-line bg-surface-raised text-muted",
  accent: "border-accent/25 bg-accent/10 text-accent",
  info: "border-info/25 bg-info/10 text-info",
  success: "border-success/25 bg-success/10 text-success",
  warm: "border-warm/25 bg-warm/10 text-warm",
  danger: "border-danger/25 bg-danger/10 text-danger",
};
export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return <span {...props} className={cn("inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium whitespace-nowrap", tones[tone], className)} />;
}

const difficultyTone: Record<string, BadgeTone> = { EASY: "success", MEDIUM: "warm", HARD: "danger" };
const difficultyLabel: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

/** Easy / Medium / Hard tag with the platform's fixed colours (emerald, amber, rose). */
export function DifficultyBadge({ difficulty, className }: { difficulty: string; className?: string }) {
  return <Badge tone={difficultyTone[difficulty] ?? "neutral"} className={className}>{difficultyLabel[difficulty] ?? difficulty}</Badge>;
}

/** Text colour for a difficulty when a full badge would be too heavy (tables, compact lists). */
export function difficultyText(difficulty: string) {
  return difficulty === "EASY" ? "text-success" : difficulty === "MEDIUM" ? "text-warm" : difficulty === "HARD" ? "text-danger" : "text-muted";
}

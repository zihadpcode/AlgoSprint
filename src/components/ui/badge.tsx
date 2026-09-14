import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
const tones = { neutral: "border-line bg-surface-raised text-muted", accent: "border-accent/30 bg-accent/10 text-accent", success: "border-success/30 bg-success/10 text-success", warm: "border-warm/30 bg-warm/10 text-warm", danger: "border-danger/30 bg-danger/10 text-danger" };
export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return <span {...props} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone], className)} />;
}

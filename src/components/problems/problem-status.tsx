import { Check, Circle } from "lucide-react";
import { progressLabel, type ProgressView } from "@/features/progress/presentation";

/** Solved check, attempted dot, or nothing. The text label is always available to assistive technology. */
export function ProblemStatus({ progress }: { progress: ProgressView | null }) {
  if (!progress) return <span className="inline-block size-4" aria-hidden="true" />;
  const text = progressLabel(progress);
  if (progress.status === "SOLVED") {
    return <span title={text} className="inline-grid size-4 place-items-center rounded-full bg-success/15 text-success"><Check aria-hidden="true" size={11} strokeWidth={3} /><span className="sr-only">{text}</span></span>;
  }
  if (progress.status === "ATTEMPTED") {
    return <span title={text} className="inline-grid size-4 place-items-center text-warm"><Circle aria-hidden="true" size={9} fill="currentColor" /><span className="sr-only">{text}</span></span>;
  }
  return <span title={text} className="inline-block size-4"><span className="sr-only">{text}</span></span>;
}

import type { ProgressView } from "@/features/progress/presentation";

export type RoadmapStepView = {
  position: number; title: string; description: string | null;
  problem: { slug: string; title: string; difficulty: "EASY" | "MEDIUM" | "HARD"; estimatedMinutes: number };
  progress: ProgressView | null;
};

export function roadmapProgress(steps: RoadmapStepView[], signedIn: boolean) {
  if (!signedIn) return null;
  const solved = steps.filter((s) => s.progress?.status === "SOLVED");
  return {
    total: steps.length, solved: solved.length,
    percent: steps.length ? Math.round(solved.length / steps.length * 100) : 0,
    selfMarked: solved.filter((s) => s.progress?.selfMarked).length,
    verifiedCurrent: solved.filter((s) => s.progress?.verification === "current").length,
    verifiedEarlier: solved.filter((s) => s.progress?.verification === "earlier").length,
    recorded: solved.filter((s) => !s.progress?.selfMarked && !s.progress?.verification).length,
    reviewLater: steps.filter((s) => s.progress?.reviewLater).length,
  };
}

// Query supplies position-ordered steps. Suggestions never write or verify progress.
export function recommendStep(steps: RoadmapStepView[], signedIn: boolean) {
  if (!steps.length) return null;
  if (!signedIn) return { position: steps[0].position, slug: steps[0].problem.slug, title: steps[0].problem.title, reason: "Start with the first step. Sign in for a personal suggestion." };
  const incomplete = steps.find((s) => s.progress?.status !== "SOLVED");
  const review = steps.find((s) => s.progress?.reviewLater);
  const earlier = steps.find((s) => s.progress?.verification === "earlier");
  const next = incomplete ?? review ?? earlier;
  if (!next) return null;
  return { position: next.position, slug: next.problem.slug, title: next.problem.title,
    reason: incomplete ? "Your first unsolved step in this path." : review ? "All steps are recorded solved. Revisit your first review flag." : "All steps are recorded solved. Recheck the first problem verified on an earlier revision." };
}

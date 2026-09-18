import { expect, it } from "vitest";
import { roadmapProgress, recommendStep, type RoadmapStepView } from "@/features/roadmaps/policy";
import { progressView } from "@/features/progress/presentation";
const steps = (): RoadmapStepView[] => [1, 2, 3, 4].map((position) => ({ position, title: `Step ${position}`, description: null,
  problem: { slug: `problem-${position}`, title: `Problem ${position}`, difficulty: "EASY", estimatedMinutes: 10 }, progress: progressView(null, 1) }));
it("guests have no fabricated progress; empty collections avoid invalid percentages", () => {
  expect(roadmapProgress(steps(), false)).toBeNull();
  expect(recommendStep(steps(), false)).toMatchObject({ position: 1, reason: expect.stringContaining("Sign in") });
  expect(roadmapProgress([], true)).toMatchObject({ total: 0, solved: 0, percent: 0 }); expect(recommendStep([], true)).toBeNull();
});
it("retains manual, current, earlier and legacy solves with exact denominators", () => {
  const rows = steps();
  rows[0].progress = progressView({ status: "SOLVED", selfMarked: true, reviewLater: true, verifiedRevision: null }, 2);
  rows[1].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: false, verifiedRevision: 2 }, 2);
  rows[2].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: false, verifiedRevision: 1 }, 2);
  rows[3].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: false, verifiedRevision: null }, 2);
  expect(roadmapProgress(rows, true)).toEqual({ total: 4, solved: 4, percent: 100, selfMarked: 1, verifiedCurrent: 1, verifiedEarlier: 1, recorded: 1, reviewLater: 1 });
});
it("prioritizes first incomplete step, then review, then earlier verification", () => {
  const rows = steps();
  for (const row of rows) row.progress = progressView({ status: "SOLVED", selfMarked: true, reviewLater: false, verifiedRevision: null }, 1);
  rows[0].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: false, verifiedRevision: 1 }, 2);
  rows[1].progress!.reviewLater = true;
  rows[3].progress!.status = "ATTEMPTED";
  expect(recommendStep(rows, true)?.position).toBe(4);
  rows[3].progress!.status = "SOLVED";
  expect(recommendStep(rows, true)).toMatchObject({ position: 2, reason: expect.stringContaining("review flag") });
  rows[1].progress!.reviewLater = false;
  expect(recommendStep(rows, true)).toMatchObject({ position: 1, reason: expect.stringContaining("earlier revision") });
  rows[0].progress!.verification = "current";
  expect(recommendStep(rows, true)).toBeNull();
});

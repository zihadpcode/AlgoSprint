import { expect, it } from "vitest";
import { ROADMAPS } from "@/data/seeds/roadmaps";
import { roadmapBatchSchema, validateRoadmapReferences } from "@/lib/validators/roadmap";
import { loadProblems } from "../scripts/lib/load-problems";
it("validates original paths against all five published reviewed problems", async () => {
  const problems = await loadProblems();
  expect(validateRoadmapReferences(ROADMAPS, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)))).toHaveLength(2);
  expect(new Set(ROADMAPS.flatMap((r) => r.steps.map((s) => s.problemSlug))).size).toBe(5);
});
it("rejects duplicate slugs, repeated steps, empty paths and invalid estimates before seeding", () => {
  for (const input of [[ROADMAPS[0], ROADMAPS[0]], [{ ...ROADMAPS[0], steps: [ROADMAPS[0].steps[0], ROADMAPS[0].steps[0]] }], [{ ...ROADMAPS[0], steps: [] }], [{ ...ROADMAPS[0], estimatedMinutes: 0 }], [{ ...ROADMAPS[0], slug: "../private" }]]) expect(roadmapBatchSchema.safeParse(input).success).toBe(false);
  expect(() => validateRoadmapReferences(ROADMAPS, new Set(["quiet-badge"]))).toThrow(/requires published problem/);
});

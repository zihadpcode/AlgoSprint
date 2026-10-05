import { expect, it } from "vitest";
import { ROADMAPS } from "@/data/seeds/roadmaps";
import { roadmapBatchSchema, validateRoadmapReferences } from "@/lib/validators/roadmap";
import { loadProblems } from "../scripts/lib/load-problems";
it("validates original paths against published problems and places every published problem on some path", async () => {
  const problems = await loadProblems();
  const published = problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug);
  expect(validateRoadmapReferences(ROADMAPS, new Set(published))).toHaveLength(ROADMAPS.length);
  expect(new Set(ROADMAPS.flatMap((r) => r.steps.map((s) => s.problemSlug)))).toEqual(new Set(published));
  expect(ROADMAPS.slice(0, 2).map((r) => r.slug)).toEqual(["scan-store-reuse", "boundaries-to-decisions"]);
});
it("rejects duplicate slugs, repeated steps, empty paths and invalid estimates before seeding", () => {
  for (const input of [[ROADMAPS[0], ROADMAPS[0]], [{ ...ROADMAPS[0], steps: [ROADMAPS[0].steps[0], ROADMAPS[0].steps[0]] }], [{ ...ROADMAPS[0], steps: [] }], [{ ...ROADMAPS[0], estimatedMinutes: 0 }], [{ ...ROADMAPS[0], slug: "../private" }]]) expect(roadmapBatchSchema.safeParse(input).success).toBe(false);
  expect(() => validateRoadmapReferences(ROADMAPS, new Set(["quiet-badge"]))).toThrow(/requires published problem/);
});

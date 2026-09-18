import { z } from "zod";

export const roadmapSlug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = (max: number) => z.string().trim().min(1).max(max).refine((value) => !value.includes("\u0000"));
export const roadmapBatchSchema = z.array(z.object({
  slug: roadmapSlug, title: text(160), description: text(5000),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]), estimatedMinutes: z.number().int().min(1).max(100000),
  steps: z.array(z.object({ problemSlug: roadmapSlug, title: text(160), description: text(2000) }).strict()).min(1).max(100),
}).strict()).min(1).max(100).superRefine((roadmaps, ctx) => {
  const slugs = new Set<string>();
  for (const [i, roadmap] of roadmaps.entries()) {
    if (slugs.has(roadmap.slug)) ctx.addIssue({ code: "custom", message: "Duplicate roadmap slug", path: [i, "slug"] });
    slugs.add(roadmap.slug);
    const problems = new Set<string>();
    for (const [j, step] of roadmap.steps.entries()) {
      if (problems.has(step.problemSlug)) ctx.addIssue({ code: "custom", message: "Duplicate roadmap problem", path: [i, "steps", j] });
      problems.add(step.problemSlug);
    }
  }
});
export type RoadmapSeed = z.infer<typeof roadmapBatchSchema>[number];

export function validateRoadmapReferences(input: unknown, publishedSlugs: ReadonlySet<string>) {
  const roadmaps = roadmapBatchSchema.parse(input);
  for (const roadmap of roadmaps) for (const step of roadmap.steps) {
    if (!publishedSlugs.has(step.problemSlug)) throw new Error(`Roadmap ${roadmap.slug} requires published problem ${step.problemSlug}.`);
  }
  return roadmaps;
}

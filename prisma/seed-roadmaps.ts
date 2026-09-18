import type { PrismaClient } from "../src/generated/prisma/client";
import { roadmapBatchSchema, validateRoadmapReferences } from "../src/lib/validators/roadmap";
import { canonicalJson } from "./seed-data";

export async function seedRoadmaps(db: PrismaClient, input: unknown) {
  const roadmaps = roadmapBatchSchema.parse(input);
  return db.$transaction(async (tx) => {
    // Serialize cooperating seed jobs; all roadmaps in this batch commit or roll back together.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(712012::bigint)`;
    const problems = await tx.problem.findMany({ where: { slug: { in: roadmaps.flatMap((r) => r.steps.map((s) => s.problemSlug)) } }, select: { id: true, slug: true, status: true } });
    validateRoadmapReferences(roadmaps, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
    const ids = new Map(problems.map((p) => [p.slug, p.id]));
    let created = 0; let skipped = 0;
    for (const roadmap of roadmaps) {
      const { steps, ...content } = roadmap;
      const expected = { ...content, status: "PUBLISHED" as const, steps: steps.map(({ problemSlug, ...step }, i) => ({ ...step, position: i + 1, problemId: ids.get(problemSlug)! })) };
      const current = await tx.roadmap.findUnique({ where: { slug: roadmap.slug }, select: {
        slug: true, title: true, description: true, difficulty: true, estimatedMinutes: true, status: true,
        steps: { orderBy: { position: "asc" }, select: { title: true, description: true, position: true, problemId: true } },
      } });
      if (current) {
        if (canonicalJson(current) !== canonicalJson(expected)) throw new Error(`Roadmap seed conflict for ${roadmap.slug}; existing content was preserved.`);
        skipped++; continue;
      }
      await tx.roadmap.create({ data: { ...content, status: "PUBLISHED", steps: { create: expected.steps } } });
      created++;
    }
    return { created, skipped };
  }, { timeout: 30_000 });
}

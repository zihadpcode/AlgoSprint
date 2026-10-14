import type { PrismaClient } from "../src/generated/prisma/client";
import { videoBatchSchema, validateVideoReferences } from "../src/lib/validators/video";
import { canonicalJson } from "./seed-data";
import { VIDEOS } from "../src/data/seeds/videos";

// Insert-only: a missing video row is created, an identical one is skipped, and a (problem, video) row whose stored
// content differs from the seed raises a conflict before any row is written. Existing rows are never updated.
export async function seedVideos(db: PrismaClient, input: unknown = VIDEOS) {
  const videos = videoBatchSchema.parse(input);
  return db.$transaction(async (tx) => {
    // Serialize cooperating seed jobs; the whole batch commits or rolls back together.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(712013::bigint)`;
    const problems = await tx.problem.findMany({ where: { slug: { in: [...new Set(videos.map((v) => v.problemSlug))] } }, select: { id: true, slug: true, status: true } });
    validateVideoReferences(videos, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
    const ids = new Map(problems.map((p) => [p.slug, p.id]));
    const existing = await tx.problemVideo.findMany({
      where: { problemId: { in: [...ids.values()] } },
      select: { problemId: true, youtubeId: true, title: true, channel: true, concept: true, referenceProblem: true, bridge: true, segments: true, position: true },
    });
    const byKey = new Map(existing.map((row) => [`${row.problemId}:${row.youtubeId}`, row]));
    const byPosition = new Map(existing.map((row) => [`${row.problemId}:${row.position}`, row]));

    const counters = new Map<string, number>();
    const planned: { problemId: string; youtubeId: string; title: string; channel: string; concept: string; referenceProblem: string; bridge: string; segments: typeof videos[number]["segments"]; position: number }[] = [];
    let skipped = 0;
    for (const video of videos) {
      const { problemSlug, ...content } = video;
      const problemId = ids.get(problemSlug)!;
      // The seed list order is the display order within one problem.
      const position = (counters.get(problemSlug) ?? 0) + 1;
      counters.set(problemSlug, position);
      const expected = { problemId, ...content, position };
      const current = byKey.get(`${problemId}:${video.youtubeId}`);
      if (current) {
        if (canonicalJson(current) !== canonicalJson(expected)) throw new Error(`Video seed conflict for ${problemSlug}/${video.youtubeId}; existing content was preserved.`);
        skipped++; continue;
      }
      if (byPosition.has(`${problemId}:${position}`)) throw new Error(`Video seed conflict for ${problemSlug}: position ${position} is already used by a different video; existing content was preserved.`);
      planned.push(expected);
    }
    // Every comparison has passed; only now write.
    if (planned.length) await tx.problemVideo.createMany({ data: planned });
    return { created: planned.length, skipped };
  }, { timeout: 30_000 });
}

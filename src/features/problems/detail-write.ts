import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeProgress } from "@/features/progress/write";
import type { ProblemChange } from "./detail-validation";

// Trusted helper: caller must validate input and verify the user before entering.
export async function writeProblemChange(db: PrismaClient, userId: string, change: ProblemChange) {
  if (!userId) throw new Error("Verified viewer required");
  return db.$transaction(async (tx) => {
    // Parameterized SQL. A shared row lock prevents archival during the write.
    const [problem] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM app."Problem" WHERE slug = ${change.slug} AND status = 'PUBLISHED' FOR SHARE
    `;
    if (!problem) return "not-found" as const;
    const owner = { userId, problemId: problem.id };
    if (change.operation === "save-note" || change.operation === "delete-note") {
      // A transaction lock also covers a missing note, so save/delete cannot race
      // through a temporary placeholder row. No external requests hold this lock.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`note:${userId}:${problem.id}`}, 0))`;
      const existing = await tx.userNote.findUnique({ where: { userId_problemId: owner }, select: { content: true } });
      const removing = change.operation === "delete-note" || change.content === "";
      if (removing && !existing) return "saved" as const;
      if ((existing?.content ?? "") !== change.expectedContent) return "conflict" as const;
      if (removing) await tx.userNote.deleteMany({ where: owner });
      else if (change.operation === "save-note" && existing?.content !== change.content) {
        await tx.userNote.upsert({ where: { userId_problemId: owner }, create: { ...owner, content: change.content }, update: { content: change.content } });
      }
      return "saved" as const;
    }
    const at = new Date();
    if (change.operation === "set-review") await writeProgress(tx, userId, problem.id, { kind: "review", value: change.review === "true", at });
    else if (change.operation === "set-bookmark") await writeProgress(tx, userId, problem.id, { kind: "bookmark", value: change.bookmarked === "true", at });
    else await writeProgress(tx, userId, problem.id, { kind: change.operation === "mark-attempted" ? "attempt" : change.operation === "mark-solved" ? "manual-solve" : "clear-manual", at });
    return "saved" as const;
  });
}

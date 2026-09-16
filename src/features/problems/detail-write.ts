import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeProgress } from "@/features/progress/write";
import type { ProblemChange } from "./detail-validation";

// Trusted helper: caller must validate input and verify the user before entering.
export async function writeProblemChange(db: PrismaClient, userId: string, change: ProblemChange) {
  return db.$transaction(async (tx) => {
    // Parameterized SQL. A shared row lock prevents archival during the write.
    const [problem] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM app."Problem" WHERE slug = ${change.slug} AND status = 'PUBLISHED' FOR SHARE
    `;
    if (!problem) return "not-found" as const;
    const owner = { userId, problemId: problem.id };
    if (change.operation === "save-note") {
      // Concurrent first saves are safe; the baseline check catches stale tabs.
      await tx.userNote.createMany({ data: { ...owner, content: "" }, skipDuplicates: true });
      const updated = await tx.userNote.updateMany({
        where: { ...owner, content: change.expectedContent }, data: { content: change.content },
      });
      return updated.count ? "saved" as const : "conflict" as const;
    }
    const at = new Date();
    if (change.operation === "set-review") await writeProgress(tx, userId, problem.id, { kind: "review", value: change.review === "true", at });
    else await writeProgress(tx, userId, problem.id, { kind: change.operation === "mark-attempted" ? "attempt" : change.operation === "mark-solved" ? "manual-solve" : "clear-manual", at });
    return "saved" as const;
  });
}

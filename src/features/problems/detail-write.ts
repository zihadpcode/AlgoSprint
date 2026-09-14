import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
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
    await tx.userProgress.createMany({ data: owner, skipDuplicates: true });
    if (change.operation === "set-review") {
      await tx.userProgress.updateMany({ where: owner, data: { reviewLater: change.review === "true" } });
    } else if (change.operation === "mark-solved") {
      // Preserve an existing solve's date and provenance; this is a manual mark.
      await tx.userProgress.updateMany({
        where: { ...owner, status: { not: "SOLVED" } },
        data: { status: "SOLVED", solvedAt: new Date(), selfMarked: true },
      });
    } else {
      // Undo only manual marks. Future runner-verified solves cannot be cleared here.
      await tx.userProgress.updateMany({
        where: { ...owner, status: "SOLVED", selfMarked: true, attemptedAt: null },
        data: { status: "NOT_STARTED", solvedAt: null, selfMarked: false },
      });
      await tx.userProgress.updateMany({
        where: { ...owner, status: "SOLVED", selfMarked: true, attemptedAt: { not: null } },
        data: { status: "ATTEMPTED", solvedAt: null, selfMarked: false },
      });
    }
    return "saved" as const;
  });
}

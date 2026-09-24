import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type ProgressEvent = { kind: "attempt" | "manual-solve" | "clear-manual" | "clear-verified" | "clear-attempt"; at: Date }
  | { kind: "review" | "bookmark"; value: boolean; at: Date }
  | { kind: "verified-solve"; revision: number; at: Date };

// Trusted transaction helper. Caller locks the problem first and verifies ownership.
// The same row lock serializes runner completion with manual solve/undo/review.
export async function writeProgress(tx: Prisma.TransactionClient, userId: string, problemId: string, event: ProgressEvent) {
  const owner = { userId, problemId };
  await tx.userProgress.createMany({ data: owner, skipDuplicates: true });
  await tx.$queryRaw`SELECT 1 FROM app."UserProgress" WHERE "userId" = ${userId}::uuid AND "problemId" = ${problemId}::uuid FOR UPDATE`;
  const row = await tx.userProgress.findUniqueOrThrow({ where: { userId_problemId: owner } });
  const data: Prisma.UserProgressUpdateManyMutationInput = {};
  if (event.kind === "attempt") {
    if (!row.attemptedAt || event.at < row.attemptedAt) data.attemptedAt = event.at;
    if (row.status === "NOT_STARTED") data.status = "ATTEMPTED";
  } else if (event.kind === "manual-solve" && row.status !== "SOLVED") {
    Object.assign(data, { status: "SOLVED", selfMarked: true, solvedAt: event.at });
  } else if (event.kind === "clear-manual" && row.status === "SOLVED" && row.selfMarked) {
    Object.assign(data, { status: row.attemptedAt ? "ATTEMPTED" : "NOT_STARTED", selfMarked: false, solvedAt: null });
  } else if (event.kind === "clear-verified" && row.status === "SOLVED" && !row.selfMarked) {
    // Submission history is kept; passing the full suite again verifies the solve anew.
    Object.assign(data, { status: row.attemptedAt ? "ATTEMPTED" : "NOT_STARTED", solvedAt: null, verifiedRevision: null, verifiedAt: null });
  } else if (event.kind === "clear-attempt" && row.status === "ATTEMPTED") {
    Object.assign(data, { status: "NOT_STARTED", attemptedAt: null });
  } else if (event.kind === "review" && row.reviewLater !== event.value) {
    data.reviewLater = event.value;
  } else if (event.kind === "bookmark" && row.bookmarked !== event.value) {
    data.bookmarked = event.value;
  } else if (event.kind === "verified-solve" && (row.verifiedRevision ?? 0) <= event.revision) {
    if (row.status !== "SOLVED") Object.assign(data, { status: "SOLVED", solvedAt: event.at });
    if (row.selfMarked) data.selfMarked = false;
    if (row.verifiedRevision !== event.revision) Object.assign(data, { verifiedRevision: event.revision, verifiedAt: event.at });
  }
  // Repeated marks/completions must not manufacture new activity timestamps.
  if (Object.keys(data).length) await tx.userProgress.updateMany({ where: owner, data });
}

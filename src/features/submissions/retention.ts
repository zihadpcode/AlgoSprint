import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";

// Proposed policy: this candidate must not be merged/deployed without owner
// approval. Age is elapsed UTC time since creation, not a deletion deadline.
const PAYLOAD_RETENTION_MS = 30 * 24 * 3600_000;
const CLEANUP_BATCH_SIZE = 50;

// Trusted server helper, called only after an owned attempt has been committed.
// savedAt comes from that server-side completion, never from an action payload.
export async function pruneSubmissionPayloads(db: PrismaClient, userId: string, savedAt: Date) {
  if (!userId || !Number.isFinite(savedAt.getTime())) throw new Error("Verified completion required");
  const cutoff = new Date(savedAt.getTime() - PAYLOAD_RETENTION_MS);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '50ms'`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '250ms'`;
    // The matching partial index excludes cleared/active/incomplete rows. Skip
    // row locks held by another completion/cleanup rather than waiting for them.
    return tx.$executeRaw`WITH candidates AS MATERIALIZED (
      SELECT id FROM app."UserSubmission"
      WHERE "userId" = ${userId}::uuid AND "createdAt" < ${cutoff}
        AND status NOT IN ('QUEUED', 'RUNNING') AND "completedAt" IS NOT NULL
        AND (code <> '' OR result IS NOT NULL)
      ORDER BY "createdAt", id LIMIT ${CLEANUP_BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE app."UserSubmission" AS submission SET code = '', result = NULL
    FROM candidates WHERE submission.id = candidates.id AND submission."userId" = ${userId}::uuid`;
  }, { maxWait: 250, timeout: 750 });
}

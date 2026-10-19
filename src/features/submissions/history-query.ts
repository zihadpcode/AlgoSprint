import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";

export const SUBMISSION_HISTORY_LIMIT = 20;

// Owner-scoped, read-only attempt history for one published problem. The viewer id comes from the verified session
// (never from a request), and the projection is an allowlist: no source code, stdout, stored result JSON or ids of other users.
const historySelect = {
  id: true, mode: true, language: true, status: true, passedCount: true, totalCount: true, runtimeMs: true, createdAt: true,
} as const;

export type SubmissionHistoryItem = {
  id: string; mode: "RUN" | "SUBMIT"; language: string; status: string; passedCount: number; totalCount: number; runtimeMs: number | null; createdAt: Date;
};

export async function queryProblemSubmissions(db: PrismaClient, viewerId: string | null, slug: string): Promise<SubmissionHistoryItem[]> {
  if (!viewerId) return [];
  return db.userSubmission.findMany({
    where: { userId: viewerId, problem: { slug, status: "PUBLISHED" } },
    select: historySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: SUBMISSION_HISTORY_LIMIT,
  });
}

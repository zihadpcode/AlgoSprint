import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { queryPracticeSummary } from "@/features/dashboard/query";

type Difficulty = "EASY" | "MEDIUM" | "HARD";
const emptyBreakdown = () => ({ EASY: { solved: 0, total: 0 }, MEDIUM: { solved: 0, total: 0 }, HARD: { solved: 0, total: 0 } });

/** Share of completed full submissions that were accepted, as a whole percent; null until there is one. */
export function acceptanceRate(accepted: number, submitted: number) {
  return submitted > 0 ? Math.round(accepted / submitted * 100) : null;
}

/**
 * Compact owner-scoped numbers for the Practice page: solved/total by difficulty, acceptance rate of the user's own
 * full submissions, and the current streak. Only counts leave the database.
 */
export async function queryPracticeStats(db: PrismaClient, userId: string) {
  if (!userId) throw new Error("Verified viewer required");
  const [totals, solvedRows, submitted, accepted, summary] = await Promise.all([
    db.problem.groupBy({ by: ["difficulty"], where: { status: "PUBLISHED" }, _count: { _all: true } }),
    db.userProgress.findMany({ where: { userId, status: "SOLVED", problem: { status: "PUBLISHED" } }, select: { problem: { select: { difficulty: true } } } }),
    db.userSubmission.count({ where: { userId, mode: "SUBMIT", completedAt: { not: null }, problem: { status: "PUBLISHED" } } }),
    db.userSubmission.count({ where: { userId, mode: "SUBMIT", status: "ACCEPTED", problem: { status: "PUBLISHED" } } }),
    queryPracticeSummary(db, userId),
  ]);
  const difficulty = emptyBreakdown();
  for (const row of totals) difficulty[row.difficulty as Difficulty].total = row._count._all;
  for (const row of solvedRows) difficulty[row.problem.difficulty as Difficulty].solved++;
  const solved = difficulty.EASY.solved + difficulty.MEDIUM.solved + difficulty.HARD.solved;
  const total = difficulty.EASY.total + difficulty.MEDIUM.total + difficulty.HARD.total;
  return { solved, total, difficulty, submitted, accepted, acceptance: acceptanceRate(accepted, submitted), streak: summary.streak, activeToday: summary.activeToday };
}
export type PracticeStats = Awaited<ReturnType<typeof queryPracticeStats>>;

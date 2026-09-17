import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { progressView } from "./presentation";

const emptyCounts = () => ({ total: 0, started: 0, attempted: 0, solved: 0, manualSolved: 0, verifiedCurrent: 0, verifiedEarlier: 0, reviewLater: 0 });
export type ProgressCounts = ReturnType<typeof emptyCounts>;
// Trusted boundary supplies the verified owner. No cross-user or public caching.
export async function queryProgress(db: PrismaClient, userId: string) {
  if (!userId) throw new Error("Verified viewer required");
  return db.$transaction((tx) => readProgress(tx, userId), { isolationLevel: "RepeatableRead", timeout: 15_000 });
}

// Shared by progress and dashboard inside their own consistent transaction.
export async function readProgress(tx: Prisma.TransactionClient, userId: string) {
  if (!userId) throw new Error("Verified viewer required");
    // Minimal collection projection is appropriate for the planned 1,000-problem MVP.
    // Statements, solutions, tests, notes and submission code/result never enter this DTO.
    const problems = await tx.problem.findMany({ where: { status: "PUBLISHED" }, select: {
      revision: true, difficulty: true,
      categories: { select: { category: { select: { slug: true, name: true } } } },
      progress: { where: { userId }, select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true, attemptedAt: true } },
    } });
    const overall = emptyCounts();
    const difficulty = { EASY: emptyCounts(), MEDIUM: emptyCounts(), HARD: emptyCounts() };
    const categories = new Map<string, { slug: string; name: string; counts: ProgressCounts }>();
    for (const problem of problems) {
      const row = problem.progress[0]; const view = progressView(row, problem.revision);
      const groups = [overall, difficulty[problem.difficulty]];
      for (const { category } of problem.categories) {
        if (!categories.has(category.slug)) categories.set(category.slug, { ...category, counts: emptyCounts() });
        groups.push(categories.get(category.slug)!.counts);
      }
      for (const counts of groups) {
        counts.total++;
        if (view.status !== "NOT_STARTED") counts.started++;
        if (row?.attemptedAt) counts.attempted++;
        if (view.status === "SOLVED") counts.solved++;
        if (view.status === "SOLVED" && view.selfMarked) counts.manualSolved++;
        if (view.verification === "current") counts.verifiedCurrent++;
        if (view.verification === "earlier") counts.verifiedEarlier++;
        if (view.reviewLater) counts.reviewLater++;
      }
    }
    const recentAttempts = await tx.userSubmission.findMany({ where: { userId, problem: { status: "PUBLISHED" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10,
      select: { mode: true, status: true, problemRevision: true, passedCount: true, totalCount: true, createdAt: true, completedAt: true,
        problem: { select: { slug: true, title: true, revision: true } } },
    });
    const recentProgress = await tx.userProgress.findMany({ where: { userId, problem: { status: "PUBLISHED" } },
      orderBy: [{ updatedAt: "desc" }, { problemId: "asc" }], take: 10,
      select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true, updatedAt: true,
        problem: { select: { slug: true, title: true, revision: true } } },
    });
    return { overall, difficulty, categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
      recentAttempts: recentAttempts.map(({ problem, createdAt, completedAt, ...attempt }) => ({ ...attempt,
        slug: problem.slug, title: problem.title, currentRevision: problem.revision,
        createdAt: createdAt.toISOString(), completedAt: completedAt?.toISOString() ?? null })),
      recentProgress: recentProgress.map(({ problem, updatedAt, ...row }) => ({ slug: problem.slug, title: problem.title,
        progress: progressView(row, problem.revision), updatedAt: updatedAt.toISOString() })),
    };
}
export type ProgressSummary = Awaited<ReturnType<typeof queryProgress>>;

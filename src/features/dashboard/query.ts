import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { readProgress } from "@/features/progress/query";
import { interviewHistory, practiceStreak, practiceSuggestions, strongestTopics } from "./policy";

export async function queryDashboard(db: PrismaClient, userId: string, now = new Date()) {
  if (!userId) throw new Error("Verified viewer required");
  return db.$transaction(async (tx) => {
    const { overall, difficulty, categories } = await readProgress(tx, userId);
    const problems = await tx.problem.findMany({ where: { status: "PUBLISHED" }, select: {
      slug: true, title: true, difficulty: true, revision: true,
      categories: { select: { category: { select: { slug: true, name: true } } } },
      progress: { where: { userId }, select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true } },
      submissions: { where: { userId, mode: "SUBMIT", completedAt: { not: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1,
        select: { status: true, problemRevision: true } },
    } });
    const suggestions = practiceSuggestions(problems.map(({ categories, progress, submissions, ...problem }) => ({ ...problem,
      categories: categories.map(({ category }) => category), progress: progress[0] ?? null, latest: submissions[0] ?? null,
    })));
    // Query SUBMIT directly: filtering ten mixed runs could hide recent full submissions.
    const recent = await tx.userSubmission.findMany({ where: { userId, mode: "SUBMIT", problem: { status: "PUBLISHED" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5,
      select: { status: true, problemRevision: true, passedCount: true, totalCount: true, createdAt: true, completedAt: true,
        problem: { select: { slug: true, title: true, revision: true } } },
    });
    const dayRows = await practiceDays(tx, userId);
    const interviews = await tx.mockInterview.findMany({ where: { userId, status: "COMPLETED", score: { not: null }, completedAt: { not: null } },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: 5, select: { id: true, score: true, durationMinutes: true, completedAt: true } });
    return { analytics: { overall, difficulty, categories }, insights: { ...suggestions,
      streak: practiceStreak(dayRows.map((row) => row.day), now),
      strongest: strongestTopics(categories),
      interviews: interviewHistory(interviews.map(({ id, score, durationMinutes, completedAt }) => ({ id, score: score!, durationMinutes, completedAt: completedAt!.toISOString() }))),
      recentSubmissions: recent.map(({ problem, createdAt, completedAt, ...submission }) => ({ ...submission,
        slug: problem.slug, title: problem.title, currentRevision: problem.revision,
        createdAt: createdAt.toISOString(), completedAt: completedAt?.toISOString() ?? null,
      })),
    } };
  }, { isolationLevel: "RepeatableRead", timeout: 15_000 });
}
export type DashboardInsights = Awaited<ReturnType<typeof queryDashboard>>["insights"];

type Reader = Pick<PrismaClient, "$queryRaw">;

// Distinct UTC days with saved practice: first attempts, solves, and every server run or submission. Only dates leave
// the database, so no problem, code or result data can reach the streak.
function practiceDays(db: Reader, userId: string) {
  return db.$queryRaw<{ day: string }[]>`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day FROM (
      SELECT (s."createdAt" AT TIME ZONE 'UTC')::date AS day FROM app."UserSubmission" s WHERE s."userId" = ${userId}::uuid
      UNION SELECT (p."attemptedAt" AT TIME ZONE 'UTC')::date FROM app."UserProgress" p WHERE p."userId" = ${userId}::uuid AND p."attemptedAt" IS NOT NULL
      UNION SELECT (p."solvedAt" AT TIME ZONE 'UTC')::date FROM app."UserProgress" p WHERE p."userId" = ${userId}::uuid AND p."solvedAt" IS NOT NULL
    ) d ORDER BY d.day DESC`;
}

/** Small owner-scoped summary for the navigation bar: current streak and solved published problems. */
export async function queryPracticeSummary(db: PrismaClient, userId: string, now = new Date()) {
  if (!userId) throw new Error("Verified viewer required");
  const [days, solved] = await Promise.all([
    practiceDays(db, userId),
    db.userProgress.count({ where: { userId, status: "SOLVED", problem: { status: "PUBLISHED" } } }),
  ]);
  const streak = practiceStreak(days.map((row) => row.day), now);
  return { streak: streak.current, activeToday: streak.activeToday, solved };
}

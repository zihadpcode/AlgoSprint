import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { readProgress } from "@/features/progress/query";
import { practiceSuggestions } from "./policy";

export async function queryDashboard(db: PrismaClient, userId: string) {
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
    return { analytics: { overall, difficulty, categories }, insights: { ...suggestions,
      recentSubmissions: recent.map(({ problem, createdAt, completedAt, ...submission }) => ({ ...submission,
        slug: problem.slug, title: problem.title, currentRevision: problem.revision,
        createdAt: createdAt.toISOString(), completedAt: completedAt?.toISOString() ?? null,
      })),
    } };
  }, { isolationLevel: "RepeatableRead", timeout: 15_000 });
}
export type DashboardInsights = Awaited<ReturnType<typeof queryDashboard>>["insights"];

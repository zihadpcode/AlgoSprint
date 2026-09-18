import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { progressView } from "@/features/progress/presentation";
import { recommendStep, roadmapProgress } from "./policy";

// Keep a complete path: no partial denominators or unpublished step metadata.
const available = {
  status: "PUBLISHED", steps: { some: {}, none: { problem: { status: { not: "PUBLISHED" } } } },
} satisfies Prisma.RoadmapWhereInput;

async function readRoadmaps(tx: Prisma.TransactionClient, viewerId: string | null, where: Prisma.RoadmapWhereInput, page?: number) {
  const rows = await tx.roadmap.findMany({ where, orderBy: [{ title: "asc" }, { slug: "asc" }],
    ...(page === undefined ? {} : { skip: (page - 1) * 12, take: 12 }),
    select: { slug: true, title: true, description: true, difficulty: true, estimatedMinutes: true,
      steps: { orderBy: { position: "asc" }, select: { position: true, title: true, description: true,
        problem: { select: { slug: true, title: true, difficulty: true, estimatedMinutes: true, revision: true,
          // A false predicate prevents all personal reads for guests.
          progress: { where: viewerId ? { userId: viewerId } : { OR: [] }, select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true } },
        } },
      } },
    },
  });
  return rows.map(({ steps: rows, ...roadmap }) => {
    const steps = rows.map(({ problem: { progress, revision, ...problem }, ...step }) => ({ ...step, problem, progress: viewerId ? progressView(progress[0], revision) : null }));
    return { ...roadmap, steps, progress: roadmapProgress(steps, Boolean(viewerId)), next: recommendStep(steps, Boolean(viewerId)) };
  });
}

export async function queryRoadmaps(db: PrismaClient, viewerId: string | null, requestedPage = 1) {
  return db.$transaction(async (tx) => {
    const total = await tx.roadmap.count({ where: available });
    const pages = Math.max(1, Math.ceil(total / 12));
    const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pages);
    const items = await readRoadmaps(tx, viewerId, available, page);
    return { items, total, pages, page };
  }, { isolationLevel: "RepeatableRead" });
}

export async function queryRoadmap(db: PrismaClient, viewerId: string | null, slug: string) {
  return db.$transaction(async (tx) => (await readRoadmaps(tx, viewerId, { ...available, slug }))[0] ?? null, { isolationLevel: "RepeatableRead" });
}
export type RoadmapView = NonNullable<Awaited<ReturnType<typeof queryRoadmap>>>;

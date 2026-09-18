import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { progressView } from "@/features/progress/presentation";
import type { SavedFilters, SavedKind } from "./filters";

export async function querySaved(db: PrismaClient, userId: string, kind: SavedKind, filters: SavedFilters) {
  if (!userId) throw new Error("Verified viewer required");
  return db.$transaction(async (tx) => {
    const where: Prisma.ProblemWhereInput = { status: "PUBLISHED",
      ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" } } : {}),
      ...(kind === "notes" ? { notes: { some: { userId, content: { not: "" } } } }
        : { progress: { some: { userId, ...(kind === "bookmarks" ? { bookmarked: true } : { reviewLater: true }) } } }),
    };
    const total = await tx.problem.count({ where });
    const pages = Math.max(1, Math.ceil(total / 10)); const page = Math.min(filters.page, pages);
    const rows = await tx.problem.findMany({ where, orderBy: [{ title: "asc" }, { slug: "asc" }], skip: (page - 1) * 10, take: 10,
      select: { slug: true, title: true, difficulty: true, revision: true,
        progress: { where: { userId }, select: { status: true, selfMarked: true, reviewLater: true, verifiedRevision: true, bookmarked: true } },
        ...(kind === "notes" ? { notes: { where: { userId }, select: { content: true }, take: 1 } } : {}),
      },
    });
    return { total, pages, page, q: filters.q, items: rows.map((row) => ({ slug: row.slug, title: row.title, difficulty: row.difficulty,
      progress: progressView(row.progress[0], row.revision), bookmarked: row.progress[0]?.bookmarked ?? false,
      note: kind === "notes" ? row.notes?.[0]?.content ?? "" : "",
    })) };
  }, { isolationLevel: "RepeatableRead" });
}
export type SavedCollection = Awaited<ReturnType<typeof querySaved>>;

import "server-only";
import { progressView } from "@/features/progress/presentation";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PAGE_SIZE, literalSearch, needsPersonalProgress, type LibraryFilters } from "./filters";

const publicSelect = {
  id: true, revision: true, slug: true, title: true, difficulty: true, pattern: true, estimatedMinutes: true,
  categories: {
    select: { category: { select: { slug: true, name: true } } },
    orderBy: { category: { name: "asc" } },
  },
  tags: {
    select: { tag: { select: { slug: true, name: true } } },
    orderBy: { tag: { name: "asc" } },
  },
} satisfies Prisma.ProblemSelect;

function orderBy(sort: LibraryFilters["sort"]): Prisma.ProblemOrderByWithRelationInput[] {
  switch (sort) {
    case "newest": return [{ publishedAt: { sort: "desc", nulls: "last" } }, { slug: "asc" }];
    case "difficulty": return [{ difficulty: "asc" }, { slug: "asc" }];
    case "time": return [{ estimatedMinutes: "asc" }, { slug: "asc" }];
    default: return [{ title: "asc" }, { slug: "asc" }];
  }
}

export function libraryWhere(filters: LibraryFilters, viewerId: string | null): Prisma.ProblemWhereInput {
  if (!viewerId && needsPersonalProgress(filters)) throw new Error("Verified viewer required for personal filters.");
  const and: Prisma.ProblemWhereInput[] = [];
  if (filters.q) and.push({ title: { contains: literalSearch(filters.q), mode: "insensitive" } });
  if (filters.difficulty) and.push({ difficulty: filters.difficulty });
  if (filters.category) and.push({ categories: { some: { category: { slug: filters.category } } } });
  if (filters.tag) and.push({ tags: { some: { tag: { slug: filters.tag } } } });
  if (filters.pattern) and.push({ pattern: filters.pattern });
  if (filters.maxMinutes) and.push({ estimatedMinutes: { lte: filters.maxMinutes } });
  if (viewerId) {
    if (filters.completion === "NOT_STARTED") {
      and.push({ progress: { none: { userId: viewerId, status: { in: ["ATTEMPTED", "SOLVED"] } } } });
    } else if (filters.completion !== "ALL") {
      and.push({ progress: { some: { userId: viewerId, status: filters.completion } } });
    }
    if (filters.review) and.push({ progress: { some: { userId: viewerId, reviewLater: true } } });
  }
  return { status: "PUBLISHED", AND: and };
}

// Trusted server helper. Only the load.ts boundary supplies the verified viewer ID.
// Keep count, rows, facets, and progress in one consistent database snapshot.
export async function queryLibrary(db: PrismaClient, filters: LibraryFilters, viewerId: string | null) {
  const where = libraryWhere(filters, viewerId);
  return db.$transaction(async (tx) => {
    const total = await tx.problem.count({ where });
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(filters.page, pages);
    const rows = await tx.problem.findMany({
      where, select: publicSelect, orderBy: orderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    });
    const progress = viewerId && rows.length ? await tx.userProgress.findMany({
      where: { userId: viewerId, problemId: { in: rows.map((row) => row.id) } },
      select: { problemId: true, status: true, reviewLater: true, selfMarked: true, verifiedRevision: true },
    }) : [];
    const byProblem = new Map(progress.map((entry) => [entry.problemId, entry]));
    const [categories, tags, patterns] = await Promise.all([
      tx.category.findMany({
        where: { problems: { some: { problem: { status: "PUBLISHED" } } } },
        select: { slug: true, name: true }, orderBy: { name: "asc" },
      }),
      tx.tag.findMany({
        where: { problems: { some: { problem: { status: "PUBLISHED" } } } },
        select: { slug: true, name: true }, orderBy: { name: "asc" },
      }),
      tx.problem.findMany({
        where: { status: "PUBLISHED" }, select: { pattern: true },
        distinct: ["pattern"], orderBy: { pattern: "asc" },
      }),
    ]);
    return {
      total, page, pages, pageSize: PAGE_SIZE,
      facets: { categories, tags, patterns: patterns.map((row) => row.pattern) },
      items: rows.map((row) => {
        const entry = byProblem.get(row.id);
        return {
          slug: row.slug, title: row.title, difficulty: row.difficulty,
          pattern: row.pattern, estimatedMinutes: row.estimatedMinutes,
          categories: row.categories.map((link) => link.category),
          tags: row.tags.map((link) => link.tag),
          progress: viewerId ? progressView(entry, row.revision) : null,
        };
      }),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15_000 });
}
export type LibraryResult = Awaited<ReturnType<typeof queryLibrary>>;

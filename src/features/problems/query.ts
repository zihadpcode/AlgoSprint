import "server-only";
import { progressView } from "@/features/progress/presentation";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { buildCategoryTree, type PublishedCategoryRow } from "./category-tree";
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

// `dir` is literal: title A-Z / easiest / shortest / oldest are "asc". The slug tie-breaker stays ascending so paging
// is stable. The parser defaults `dir` to "desc" for "newest" so existing links keep their meaning.
export function orderBy(sort: LibraryFilters["sort"], dir: LibraryFilters["dir"]): Prisma.ProblemOrderByWithRelationInput[] {
  switch (sort) {
    case "newest": return [{ publishedAt: { sort: dir, nulls: "last" } }, { slug: "asc" }];
    case "difficulty": return [{ difficulty: dir }, { slug: "asc" }];
    case "time": return [{ estimatedMinutes: dir }, { slug: "asc" }];
    default: return [{ title: dir }, { slug: "asc" }];
  }
}

export function libraryWhere(filters: LibraryFilters, viewerId: string | null, hierarchy = true): Prisma.ProblemWhereInput {
  if (!viewerId && needsPersonalProgress(filters)) throw new Error("Verified viewer required for personal filters.");
  const and: Prisma.ProblemWhereInput[] = [];
  if (filters.q) and.push({ title: { contains: literalSearch(filters.q), mode: "insensitive" } });
  // Selected values within one filter are alternatives (OR); different filters narrow each other (AND).
  if (filters.difficulty.length) and.push({ difficulty: { in: filters.difficulty } });
  if (filters.category.length) and.push({ categories: { some: { category: { slug: { in: filters.category } } } } });
  if (filters.group.length) {
    // A group matches its children (and any problem attached to the group row itself). Without the hierarchy columns
    // (migration not applied yet) no group exists, so the filter matches nothing instead of failing.
    and.push({ categories: { some: { category: hierarchy
      ? { OR: [{ slug: { in: filters.group } }, { parent: { slug: { in: filters.group } } }] }
      : { slug: "" } } } });
  }
  if (filters.tag) and.push({ tags: { some: { tag: { slug: filters.tag } } } });
  if (filters.pattern) and.push({ pattern: filters.pattern });
  if (filters.maxMinutes) and.push({ estimatedMinutes: { lte: filters.maxMinutes } });
  if (viewerId) {
    if (filters.completion.length) {
      const started = filters.completion.filter((status) => status !== "NOT_STARTED");
      const alternatives: Prisma.ProblemWhereInput[] = [];
      if (filters.completion.includes("NOT_STARTED")) alternatives.push({ progress: { none: { userId: viewerId, status: { in: ["ATTEMPTED", "SOLVED"] } } } });
      if (started.length) alternatives.push({ progress: { some: { userId: viewerId, status: { in: started } } } });
      and.push({ OR: alternatives });
    }
    if (filters.review) and.push({ progress: { some: { userId: viewerId, reviewLater: true } } });
  }
  return { status: "PUBLISHED", AND: and };
}

// Trusted server helper. Only the load.ts boundary supplies the verified viewer ID.
// Keep count, rows, facets, and progress in one consistent database snapshot.
export async function queryLibrary(db: PrismaClient, filters: LibraryFilters, viewerId: string | null) {
  try {
    return await queryLibrarySnapshot(db, filters, viewerId, true);
  } catch (error) {
    // Deploy-order safety: if this code runs before the category_hierarchy migration, the hierarchy columns are
    // missing (Prisma P2022 on Category). Serve the flat library instead of failing the page.
    if (!isMissingCategoryColumn(error)) throw error;
    return queryLibrarySnapshot(db, filters, viewerId, false);
  }
}

// Prisma reports a missing column as P2022. The hierarchy columns can surface on the Category model itself or, for the
// group filter's relation join, on a Problem query whose column is `<alias>.parentId` (parentId exists only on Category).
export function isMissingCategoryColumn(error: unknown) {
  const failure = error as { code?: unknown; meta?: { modelName?: unknown; driverAdapterError?: { cause?: { column?: unknown } } } } | null;
  if (failure?.code !== "P2022") return false;
  const column = failure.meta?.driverAdapterError?.cause?.column;
  return failure.meta?.modelName === "Category" || (typeof column === "string" && /(^|\.)parentId$/.test(column));
}

async function queryLibrarySnapshot(db: PrismaClient, filters: LibraryFilters, viewerId: string | null, hierarchy: boolean) {
  const where = libraryWhere(filters, viewerId, hierarchy);
  return db.$transaction(async (tx) => {
    const total = await tx.problem.count({ where });
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(filters.page, pages);
    const rows = await tx.problem.findMany({
      where, select: publicSelect, orderBy: orderBy(filters.sort, filters.dir),
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    });
    const progress = viewerId && rows.length ? await tx.userProgress.findMany({
      where: { userId: viewerId, problemId: { in: rows.map((row) => row.id) } },
      select: { problemId: true, status: true, reviewLater: true, selfMarked: true, verifiedRevision: true },
    }) : [];
    const byProblem = new Map(progress.map((entry) => [entry.problemId, entry]));
    const [categoryRows, tags, patterns] = await Promise.all([
      tx.category.findMany({
        where: { problems: { some: { problem: { status: "PUBLISHED" } } } },
        select: hierarchy
          ? { slug: true, name: true, position: true, parent: { select: { slug: true, name: true, position: true } } }
          : { slug: true, name: true },
        orderBy: { name: "asc" },
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
      facets: {
        categories: categoryRows.map(({ slug, name }) => ({ slug, name })),
        // null = nothing is grouped (or the migration is not applied yet): the UI shows the flat list.
        categoryTree: hierarchy ? buildCategoryTree(categoryRows as PublishedCategoryRow[]) : null,
        tags, patterns: patterns.map((row) => row.pattern),
      },
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

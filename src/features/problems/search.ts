import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { literalSearch, stripSearchControls } from "@/lib/search";

export const PALETTE_QUERY_MAX = 80;
export const PALETTE_RESULTS = 8;

/** Title search for the command palette. Published problems only; public catalogue fields only (no progress, no
 *  content). Same literal-matching rules as the library search. */
export async function searchPublishedProblems(db: PrismaClient, raw: string) {
  const q = stripSearchControls(raw).trim().slice(0, PALETTE_QUERY_MAX);
  if (q.length < 2) return [];
  const select = { slug: true, title: true, difficulty: true, pattern: true } as const;
  // Titles that start with the query first, then other matches; both alphabetical. Two bounded queries so a prefix
  // match can never be crowded out by many earlier-sorting "contains" matches.
  const pattern = literalSearch(q);
  const prefix = await db.problem.findMany({
    where: { status: "PUBLISHED", title: { startsWith: pattern, mode: "insensitive" } },
    orderBy: [{ title: "asc" }], take: PALETTE_RESULTS, select,
  });
  if (prefix.length >= PALETTE_RESULTS) return prefix;
  const rest = await db.problem.findMany({
    where: { status: "PUBLISHED", title: { contains: pattern, mode: "insensitive" }, NOT: { title: { startsWith: pattern, mode: "insensitive" } } },
    orderBy: [{ title: "asc" }], take: PALETTE_RESULTS - prefix.length, select,
  });
  return [...prefix, ...rest];
}

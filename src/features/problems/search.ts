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
  const rows = await db.problem.findMany({
    where: { status: "PUBLISHED", title: { contains: literalSearch(q), mode: "insensitive" } },
    orderBy: [{ title: "asc" }],
    take: 40,
    select: { slug: true, title: true, difficulty: true, pattern: true },
  });
  // Titles that start with the query rank first, then alphabetical.
  const lower = q.toLowerCase();
  return rows
    .sort((a, b) => Number(!a.title.toLowerCase().startsWith(lower)) - Number(!b.title.toLowerCase().startsWith(lower)) || a.title.localeCompare(b.title))
    .slice(0, PALETTE_RESULTS);
}

import { z } from "zod";

export const PAGE_SIZE = 12;
export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export const SORTS = ["title", "newest", "difficulty", "time"] as const;
export const COMPLETIONS = ["ALL", "NOT_STARTED", "ATTEMPTED", "SOLVED"] as const;
export type SearchParams = Record<string, string | string[] | undefined>;

const slug = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).catch("");
const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;
const positive = (max: number, fallback: number) =>
  z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).pipe(z.number().int().max(max)).catch(fallback);

export function parseLibraryFilters(params: SearchParams) {
  return {
    q: z.string().trim().max(100).catch("").parse(scalar(params.q)),
    difficulty: z.enum(["", ...DIFFICULTIES]).catch("").parse(scalar(params.difficulty)),
    category: slug.parse(scalar(params.category)),
    tag: slug.parse(scalar(params.tag)),
    pattern: slug.parse(scalar(params.pattern)),
    maxMinutes: positive(240, 0).parse(scalar(params.maxMinutes)),
    completion: z.enum(COMPLETIONS).catch("ALL").parse(scalar(params.completion)),
    review: scalar(params.review) === "1",
    sort: z.enum(SORTS).catch("title").parse(scalar(params.sort)),
    page: positive(10_000, 1).parse(scalar(params.page)),
  };
}
export type LibraryFilters = ReturnType<typeof parseLibraryFilters>;

export function needsPersonalProgress(filters: LibraryFilters) {
  return filters.completion !== "ALL" || filters.review;
}

// Explicit keys prevent unknown URL fields (including userId) from propagating.
export function libraryHref(filters: LibraryFilters) {
  const params = new URLSearchParams();
  for (const key of ["q", "difficulty", "category", "tag", "pattern"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.maxMinutes) params.set("maxMinutes", String(filters.maxMinutes));
  if (filters.completion !== "ALL") params.set("completion", filters.completion);
  if (filters.review) params.set("review", "1");
  if (filters.sort !== "title") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return "/problems" + (params.size ? "?" + params.toString() : "");
}

// Prisma's PostgreSQL contains filter uses LIKE syntax; search punctuation literally.
export function literalSearch(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

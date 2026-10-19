import { z } from "zod";
import { stripSearchControls } from "@/lib/search";

export { literalSearch } from "@/lib/search";

export const PAGE_SIZE = 12;
export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export const SORTS = ["title", "newest", "difficulty", "time"] as const;
export const COMPLETIONS = ["ALL", "NOT_STARTED", "ATTEMPTED", "SOLVED"] as const;
export const STATUSES = ["NOT_STARTED", "ATTEMPTED", "SOLVED"] as const;
export const SORT_DIRECTIONS = ["asc", "desc"] as const;
// Multi-select filters accept repeated parameters; the cap keeps URLs and queries bounded.
export const MAX_CATEGORIES = 8;
export type Difficulty = (typeof DIFFICULTIES)[number];
export type CompletionStatus = (typeof STATUSES)[number];
export type SearchParams = Record<string, string | string[] | undefined>;

const slug = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).catch("");
// The category control is one select, so it also carries "all of a group" as `group:<slug>` (this is what lets the
// plain GET form work without JavaScript). Anything else that is not a bare slug is dropped, as before.
export const GROUP_PREFIX = "group:";
const many = (value: string | string[] | undefined) => typeof value === "string" ? [value] : Array.isArray(value) ? value.slice(0, 24) : [];
// Valid values only, de-duplicated, in the canonical order (so equal selections produce equal URLs).
function pickEnum<T extends string>(allowed: readonly T[], value: string | string[] | undefined): T[] {
  const raw = new Set(many(value));
  return allowed.filter((entry) => raw.has(entry));
}
const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;
const positive = (max: number, fallback: number) =>
  z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).pipe(z.number().int().max(max)).catch(fallback);

function uniqueSlugs(values: string[]) {
  const out: string[] = [];
  for (const value of values) {
    const parsed = slug.parse(value);
    if (parsed && !out.includes(parsed)) out.push(parsed);
    if (out.length >= MAX_CATEGORIES) break;
  }
  return out;
}

// `category` may repeat (multi-select). Each value is a bare slug or `group:<slug>` (the single-select form of "all
// of a group"). Anything else that is not a slug is dropped.
function parseCategory(params: SearchParams) {
  const raw = many(params.category);
  const encoded = raw.filter((value) => value.startsWith(GROUP_PREFIX)).map((value) => value.slice(GROUP_PREFIX.length));
  const category = uniqueSlugs(raw.filter((value) => !value.startsWith(GROUP_PREFIX)));
  // A specific category is narrower than a group, so it wins when a URL names both.
  const group = category.length ? [] : uniqueSlugs([...encoded, ...many(params.group)]);
  return { category, group };
}

export const defaultDirection = (sort: (typeof SORTS)[number]): (typeof SORT_DIRECTIONS)[number] => sort === "newest" ? "desc" : "asc";

export function parseLibraryFilters(params: SearchParams) {
  const sort = z.enum(SORTS).catch("title").parse(scalar(params.sort));
  return {
    q: z.string().transform(stripSearchControls).pipe(z.string().trim().max(100)).catch("").parse(scalar(params.q)),
    difficulty: pickEnum(DIFFICULTIES, params.difficulty),
    ...parseCategory(params),
    tag: slug.parse(scalar(params.tag)),
    pattern: slug.parse(scalar(params.pattern)),
    maxMinutes: positive(240, 0).parse(scalar(params.maxMinutes)),
    // Empty means "all problems". `completion=ALL` from older links parses to the same thing.
    completion: pickEnum(STATUSES, params.completion),
    review: scalar(params.review) === "1",
    sort,
    dir: z.enum(SORT_DIRECTIONS).catch(defaultDirection(sort)).parse(scalar(params.dir)),
    page: positive(10_000, 1).parse(scalar(params.page)),
  };
}
export type LibraryFilters = ReturnType<typeof parseLibraryFilters>;

export function needsPersonalProgress(filters: LibraryFilters) {
  return filters.completion.length > 0 || filters.review;
}

// Explicit keys prevent unknown URL fields (including userId) from propagating.
export function libraryHref(filters: LibraryFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const value of filters.difficulty) params.append("difficulty", value);
  for (const value of filters.category) params.append("category", value);
  for (const value of filters.group) params.append("group", value);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.pattern) params.set("pattern", filters.pattern);
  if (filters.maxMinutes) params.set("maxMinutes", String(filters.maxMinutes));
  for (const value of filters.completion) params.append("completion", value);
  if (filters.review) params.set("review", "1");
  if (filters.sort !== "title") params.set("sort", filters.sort);
  if (filters.dir !== defaultDirection(filters.sort)) params.set("dir", filters.dir);
  if (filters.page > 1) params.set("page", String(filters.page));
  return "/problems" + (params.size ? "?" + params.toString() : "");
}


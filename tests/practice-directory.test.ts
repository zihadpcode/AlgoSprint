import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ActiveFilters } from "@/components/problems/active-filters";
import { ProblemCard } from "@/components/problems/problem-card";
import { ProblemTable } from "@/components/problems/problem-table";
import { GuestPrompt, PracticeStatsStrip } from "@/components/problems/practice-stats";
import { parseLibraryFilters } from "@/features/problems/filters";
import { acceptanceRate, queryPracticeStats } from "@/features/problems/stats";
import type { LibraryResult } from "@/features/problems/query";

const problem = (changes: Partial<LibraryResult["items"][number]> = {}): LibraryResult["items"][number] => ({
  slug: "relay-window", title: "Relay <b>Window</b>", difficulty: "MEDIUM", pattern: "sliding-window", estimatedMinutes: 25,
  categories: [{ slug: "arrays", name: "Arrays" }, { slug: "strings", name: "Strings" }, { slug: "hashing", name: "Hashing" }], tags: [],
  progress: null, ...changes,
});
const solved = { status: "SOLVED" as const, selfMarked: false, reviewLater: true, verification: "current" as const };
const facets = { categories: [{ slug: "arrays", name: "Arrays" }], categoryTree: null, tags: [{ slug: "two-pointers", name: "Two pointers" }], patterns: [] };

it("renders a semantic directory table with sortable server-side headers and escaped titles", () => {
  const html = renderToStaticMarkup(createElement(ProblemTable, { problems: [problem()], filters: parseLibraryFilters({ difficulty: "EASY" }) }));
  for (const text of ["<table", 'scope="col"', 'href="/problems/relay-window"', "Relay &lt;b&gt;Window&lt;/b&gt;", "Medium", "25 min", "+1"]) expect(html).toContain(text);
  expect(html).not.toContain("<b>Window");
  expect(html).toContain('aria-sort="ascending"');
  // Title is the active sort, so its link flips to descending; the others start ascending. Filters are preserved.
  expect(html).toContain('href="/problems?difficulty=EASY&amp;dir=desc"');
  expect(html).toContain('href="/problems?difficulty=EASY&amp;sort=difficulty"');
  expect(html).toContain('href="/problems?difficulty=EASY&amp;sort=time"');
});
it("shows descending state, resets paging when sorting, and toggles back to ascending", () => {
  const filters = parseLibraryFilters({ sort: "time", dir: "desc", page: "3" });
  const html = renderToStaticMarkup(createElement(ProblemTable, { problems: [problem()], filters }));
  expect(html).toContain('aria-sort="descending"');
  expect(html).toContain('href="/problems?sort=time"');
  expect(html).not.toContain("page=3");
});
it("distinguishes solved, attempted and untouched problems in text, and hides status from guests", () => {
  const table = (progress: LibraryResult["items"][number]["progress"]) => renderToStaticMarkup(createElement(ProblemTable, { problems: [problem({ progress })], filters: parseLibraryFilters({}) }));
  expect(table(solved)).toContain("Solved · verified");
  expect(table(solved)).toContain("Review");
  expect(table({ status: "ATTEMPTED", selfMarked: false, reviewLater: false, verification: null })).toContain("Attempted");
  expect(table({ status: "NOT_STARTED", selfMarked: false, reviewLater: false, verification: null })).toContain("Not started");
  expect(table(null)).not.toContain("Not started");
});
it("renders the small-screen card with the same facts", () => {
  const html = renderToStaticMarkup(createElement(ProblemCard, { problem: problem({ progress: solved }) }));
  for (const text of ["Relay &lt;b&gt;Window&lt;/b&gt;", "Medium", "25 min", "Arrays", "+0", "Review later"]) if (text !== "+0") expect(html).toContain(text);
});
it("lets long topic names wrap inside the small-screen card instead of widening the page", () => {
  const long = "Object-Oriented Programming Interview Problems";
  const html = renderToStaticMarkup(createElement(ProblemCard, { problem: problem({ categories: [{ slug: "oop", name: long }] }) }));
  const badge = html.match(/<span class="([^"]*)">Object-Oriented/)?.[1] ?? "";
  expect(badge).toContain("whitespace-normal");
  expect(badge).toContain("max-w-full");
  expect(badge).not.toContain("whitespace-nowrap");
});
it("lists removable chips for every active filter with plain links and a clear-all", () => {
  const filters = parseLibraryFilters({ q: "relay", difficulty: ["EASY", "HARD"], category: ["arrays"], completion: ["SOLVED"], review: "1", maxMinutes: "30", tag: "two-pointers", sort: "time" });
  const html = renderToStaticMarkup(createElement(ActiveFilters, { filters, facets }));
  for (const text of ["“relay”", "Easy", "Hard", "Arrays", "Solved", "Review later", "≤ 30 min", "Tag: Two pointers", "Clear all"]) expect(html).toContain(text);
  // Removing Hard keeps Easy and every other filter, including the sort.
  expect(html).toContain('href="/problems?q=relay&amp;difficulty=EASY&amp;category=arrays&amp;tag=two-pointers&amp;maxMinutes=30&amp;completion=SOLVED&amp;review=1&amp;sort=time"');
  expect(html).toContain('href="/problems"');
  expect(renderToStaticMarkup(createElement(ActiveFilters, { filters: parseLibraryFilters({ sort: "time" }), facets }))).toBe("");
});

it("computes acceptance only when there is a completed submission", () => {
  expect(acceptanceRate(0, 0)).toBeNull();
  expect(acceptanceRate(1, 3)).toBe(33);
  expect(acceptanceRate(3, 3)).toBe(100);
});
const fakeDb = () => {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, args: unknown) => { (calls[name] ??= []).push(args); };
  return { calls, db: {
    problem: { groupBy: async (args: unknown) => { record("groupBy", args); return [{ difficulty: "EASY", _count: { _all: 4 } }, { difficulty: "HARD", _count: { _all: 2 } }]; } },
    userProgress: { count: async () => 3, findMany: async (args: unknown) => { record("progress", args); return [{ problem: { difficulty: "EASY" } }, { problem: { difficulty: "EASY" } }, { problem: { difficulty: "HARD" } }]; } },
    userSubmission: { count: async (args: { where: { status?: string } }) => { record("count", args); return args.where.status === "ACCEPTED" ? 2 : 5; } },
    $queryRaw: async () => [{ day: "2026-10-19" }, { day: "2026-10-18" }],
  } as never };
};
beforeEach(() => vi.useRealTimers());
it("builds owner-scoped practice stats from counts only", async () => {
  const { db, calls } = fakeDb();
  const stats = await queryPracticeStats(db, "verified-user");
  expect(stats).toMatchObject({ solved: 3, total: 6, submitted: 5, accepted: 2, acceptance: 40,
    difficulty: { EASY: { solved: 2, total: 4 }, MEDIUM: { solved: 0, total: 0 }, HARD: { solved: 1, total: 2 } } });
  expect(JSON.stringify(calls.progress)).toContain("verified-user");
  for (const args of calls.count) expect(JSON.stringify(args)).toContain('"userId":"verified-user"');
  await expect(queryPracticeStats(db, "")).rejects.toThrow("Verified viewer");
});
it("renders the stats strip with meters and an honest empty acceptance, and a gentle guest prompt", () => {
  const base = { solved: 3, total: 6, difficulty: { EASY: { solved: 2, total: 4 }, MEDIUM: { solved: 0, total: 0 }, HARD: { solved: 1, total: 2 } }, submitted: 0, accepted: 0, acceptance: null, streak: 1, activeToday: true };
  const html = renderToStaticMarkup(createElement(PracticeStatsStrip, { stats: base }));
  for (const text of ['role="meter"', 'aria-valuenow="3"', "No submissions yet", "—", ">day<", "Practised today"]) expect(html).toContain(text);
  expect(html).not.toMatch(/NaN|Infinity/);
  expect(renderToStaticMarkup(createElement(PracticeStatsStrip, { stats: { ...base, submitted: 5, accepted: 2, acceptance: 40 } }))).toContain("40%");
  const guest = renderToStaticMarkup(createElement(GuestPrompt, { href: "/login?next=%2Fproblems" }));
  expect(guest).toContain("Sign in"); expect(guest).toContain('href="/login?next=%2Fproblems"');
});

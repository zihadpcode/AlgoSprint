import { expect, it } from "vitest";
import { interviewHistory, practiceStreak, practiceSuggestions, strongestTopics, utcDay, type EvidenceProblem } from "@/features/dashboard/policy";
const problem = (slug: string, changes: Partial<EvidenceProblem> = {}): EvidenceProblem => ({ slug, title: slug, difficulty: "EASY", revision: 2, categories: [{ slug: "arrays", name: "Arrays" }], progress: null, latest: null, ...changes });
const attempted = { status: "ATTEMPTED" as const, selfMarked: false, reviewLater: false, verifiedRevision: null };
const wrong = { status: "WRONG_ANSWER", problemRevision: 2 };
it("does not infer weakness from no activity, coverage, or just one failed problem", () => {
  expect(practiceSuggestions([problem("a"), problem("b")]).topics).toEqual([]);
  expect(practiceSuggestions([problem("a", { latest: wrong })]).topics).toEqual([]);
  expect(practiceSuggestions([problem("a", { latest: wrong }), problem("b", { latest: wrong })]).topics[0].unresolvedCount).toBe(2);
});
it("ignores stale, infrastructure, visible-query-excluded and solved evidence", () => {
  const inputs = [problem("a", { latest: { ...wrong, problemRevision: 1 } }), problem("b", { latest: { ...wrong, status: "INTERNAL_ERROR" } }), problem("c", { progress: { ...attempted, status: "SOLVED", selfMarked: true }, latest: wrong })];
  expect(practiceSuggestions(inputs).topics).toEqual([]);
});
it("honors a single explicit review mark even on a currently verified solve", () => {
  const result = practiceSuggestions([problem("a", { progress: { ...attempted, status: "SOLVED", verifiedRevision: 2, reviewLater: true } })]);
  expect(result.topics[0]).toMatchObject({ reviewCount: 1, unresolvedCount: 0 });
  expect(result.recommendations[0].reason).toContain("marked this problem for review");
});
it("prioritizes review, revised verification and wrong answers before fresh practice", () => {
  const inputs = [problem("fresh"), problem("wrong", { latest: wrong }), problem("revision", { progress: { ...attempted, status: "SOLVED", verifiedRevision: 1 } }), problem("review", { progress: { ...attempted, reviewLater: true } })];
  expect(practiceSuggestions(inputs).recommendations.map((p) => p.slug)).toEqual(["review", "revision", "wrong"]);
});
it("excludes manual/current/legacy solves unless reviewed and sorts ties deterministically", () => {
  const inputs = [problem("z-hard", { difficulty: "HARD" }), problem("b"), problem("a"), problem("manual", { progress: { ...attempted, status: "SOLVED", selfMarked: true } }), problem("legacy", { progress: { ...attempted, status: "SOLVED" } }), problem("verified", { progress: { ...attempted, status: "SOLVED", verifiedRevision: 2 } })];
  expect(practiceSuggestions(inputs).recommendations.map((p) => p.slug)).toEqual(["a", "b", "z-hard"]);
  expect(practiceSuggestions([...inputs].reverse())).toEqual(practiceSuggestions(inputs));
});
it("favors an unfinished attempt before a new problem in a focus topic", () => {
  const inputs = [problem("a-review", { progress: { ...attempted, reviewLater: true } }), problem("z-attempt", { progress: attempted, categories: [] }), problem("b-focus"), problem("a-other", { categories: [] })];
  expect(practiceSuggestions(inputs).recommendations.map((p) => p.slug)).toEqual(["a-review", "z-attempt", "b-focus"]);
});
it("bounds overlapping topic signals and recommendations", () => {
  const categories = Array.from({ length: 8 }, (_, i) => ({ slug: `cat-${i}`, name: `Category ${i}` }));
  const result = practiceSuggestions(Array.from({ length: 8 }, (_, i) => problem(`p-${i}`, { categories, progress: { ...attempted, reviewLater: true } })));
  expect(result.topics).toHaveLength(5); expect(result.recommendations).toHaveLength(3);
  expect(result.topics[0].reviewCount).toBe(8);
});

const at = (iso: string) => new Date(iso);
it("counts consecutive UTC practice days and keeps a streak alive until the end of the day after the last one", () => {
  const now = at("2026-10-12T09:30:00Z");
  expect(practiceStreak([], now)).toEqual({ current: 0, longest: 0, activeToday: false, lastActiveDay: null, activeDays: 0 });
  expect(practiceStreak(["2026-10-12"], now)).toMatchObject({ current: 1, longest: 1, activeToday: true });
  // Not yet practised today, but yesterday counts: the streak is not shown as broken in the morning.
  expect(practiceStreak(["2026-10-11", "2026-10-10", "2026-10-09"], now)).toMatchObject({ current: 3, activeToday: false, lastActiveDay: "2026-10-11" });
  // Two days without practice ends it, while the longest run is remembered.
  expect(practiceStreak(["2026-10-10", "2026-10-09", "2026-10-08", "2026-10-01"], now)).toMatchObject({ current: 0, longest: 3, activeDays: 4 });
});
it("ignores duplicate and unordered days and handles month, year and leap-day boundaries", () => {
  const now = at("2027-01-02T23:59:59Z");
  expect(practiceStreak(["2027-01-01", "2026-12-31", "2027-01-02", "2026-12-31", "2026-12-30"], now)).toMatchObject({ current: 4, longest: 4, activeDays: 4 });
  expect(practiceStreak(["2028-02-29", "2028-03-01", "2028-02-28"], at("2028-03-01T00:00:00Z"))).toMatchObject({ current: 3, longest: 3 });
  // A gap of exactly one missing day splits the runs.
  expect(practiceStreak(["2026-10-12", "2026-10-10", "2026-10-09"], at("2026-10-12T12:00:00Z"))).toMatchObject({ current: 1, longest: 2 });
});
it("uses UTC for the day boundary regardless of server time zone", () => {
  expect(utcDay(at("2026-10-12T23:59:59.999Z"))).toBe("2026-10-12");
  expect(utcDay(at("2026-10-13T00:00:00Z"))).toBe("2026-10-13");
  expect(practiceStreak(["2026-10-12"], at("2026-10-13T00:00:01Z"))).toMatchObject({ current: 1, activeToday: false });
});
const category = (slug: string, solved: number, total: number, verifiedCurrent = 0) => ({ slug, name: slug.toUpperCase(), counts: { total, solved, verifiedCurrent } });
it("names strongest topics only with at least two solves and orders by verified, solved and coverage", () => {
  expect(strongestTopics([category("one", 1, 1, 1), category("none", 0, 5)])).toEqual([]);
  const result = strongestTopics([category("b", 3, 10, 1), category("a", 3, 10, 1), category("c", 2, 2, 2), category("d", 4, 8, 1), category("e", 2, 4, 0)]);
  expect(result.map((topic) => topic.slug)).toEqual(["c", "d", "a"]);
  expect(result[0]).toEqual({ slug: "c", name: "C", solved: 2, total: 2, verifiedCurrent: 2 });
  // Equal verified and solved counts fall back to completion, then slug.
  expect(strongestTopics([category("wide", 2, 20), category("tight", 2, 3), category("alpha", 2, 3)]).map((t) => t.slug)).toEqual(["alpha", "tight", "wide"]);
  expect(strongestTopics([category("a", 2, 2), category("b", 2, 2), category("c", 2, 2), category("d", 2, 2)], 2)).toHaveLength(2);
});
it("summarizes interview history without inventing an average", () => {
  expect(interviewHistory([])).toEqual({ recent: [], average: null });
  const rows = [{ id: "a", score: 50, durationMinutes: 15, completedAt: "2026-10-01T00:00:00.000Z" }, { id: "b", score: 67, durationMinutes: 30, completedAt: "2026-09-30T00:00:00.000Z" }];
  expect(interviewHistory(rows)).toMatchObject({ average: 59 });
  expect(interviewHistory(rows).recent).toEqual(rows);
});

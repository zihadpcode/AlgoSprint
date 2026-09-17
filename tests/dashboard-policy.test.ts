import { expect, it } from "vitest";
import { practiceSuggestions, type EvidenceProblem } from "@/features/dashboard/policy";
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

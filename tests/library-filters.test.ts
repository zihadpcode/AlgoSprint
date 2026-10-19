import { describe, expect, it } from "vitest";
import { MAX_CATEGORIES, libraryHref, literalSearch, needsPersonalProgress, parseLibraryFilters } from "@/features/problems/filters";

describe("library URL boundaries", () => {
  it("normalizes empty, duplicated, malformed and oversized parameters", () => {
    const filters = parseLibraryFilters({
      q: ["one", "two"], page: "-1", maxMinutes: "Infinity", difficulty: "ADMIN",
      category: "../private", tag: "x".repeat(101), completion: "DRAFT", sort: "drop table",
    });
    expect(filters).toMatchObject({ q: "", page: 1, maxMinutes: 0, difficulty: [], category: [], tag: "", completion: [], sort: "title", dir: "asc" });
    expect(parseLibraryFilters({ q: "x".repeat(101), page: "10001", maxMinutes: "241" })).toMatchObject({ q: "", page: 1, maxMinutes: 0 });
  });
  it("keeps valid filters and trims title searches", () => {
    expect(parseLibraryFilters({ q: "  Relay  ", difficulty: "EASY", review: "1", page: "2", maxMinutes: "30" }))
      .toMatchObject({ q: "Relay", difficulty: ["EASY"], review: true, page: 2, maxMinutes: 30 });
  });
  it("round trips only allowed keys and preserves filters across pages", () => {
    const filters = parseLibraryFilters({ q: "a & b", category: "arrays", completion: "SOLVED", review: "1", userId: "forged", status: "DRAFT" });
    const url = new URL(libraryHref({ ...filters, page: 3 }), "https://example.test");
    expect(url.pathname).toBe("/problems");
    expect(url.searchParams.has("userId")).toBe(false);
    expect(url.searchParams.has("status")).toBe(false);
    expect(parseLibraryFilters(Object.fromEntries(url.searchParams))).toEqual({ ...filters, page: 3 });
    expect(libraryHref(parseLibraryFilters({}))).toBe("/problems");
  });
  it("escapes PostgreSQL LIKE wildcard characters for literal searches", () => {
    expect(literalSearch("50%_done\\")).toBe("50\\%\\_done\\\\");
  });
  it("parses the group filter like a slug and drops anything unsafe", () => {
    expect(parseLibraryFilters({ group: "algorithms" })).toMatchObject({ group: ["algorithms"], category: [] });
    for (const bad of ["../x", "Algorithms", "a b", "x".repeat(101), "group:algorithms"]) {
      expect(parseLibraryFilters({ group: bad }).group).toEqual([]);
    }
  });
  it("accepts a group chosen in the category select as group:<slug>, without a script", () => {
    expect(parseLibraryFilters({ category: "group:data-structures" })).toMatchObject({ group: ["data-structures"], category: [] });
    for (const bad of ["group:", "group:../x", "group:Bad", "group:a:b", "GROUP:algorithms", "group:" + "x".repeat(101)]) {
      expect(parseLibraryFilters({ category: bad })).toMatchObject({ group: [], category: [] });
    }
  });
  it("lets a specific category win over a group named in the same URL", () => {
    expect(parseLibraryFilters({ category: "arrays", group: "algorithms" })).toMatchObject({ category: ["arrays"], group: [] });
  });
  it("round trips group and category separately and keeps existing category URLs unchanged", () => {
    const group = parseLibraryFilters({ category: "group:algorithms", sort: "time", page: "2" });
    const url = new URL(libraryHref(group), "https://example.test");
    expect(url.searchParams.getAll("group")).toEqual(["algorithms"]);
    expect(url.searchParams.has("category")).toBe(false);
    expect(parseLibraryFilters(Object.fromEntries(url.searchParams))).toEqual(group);
    expect(libraryHref(parseLibraryFilters({ category: "arrays" }))).toBe("/problems?category=arrays");
    expect(libraryHref(parseLibraryFilters({}))).toBe("/problems");
  });
  it("accepts repeated values for difficulty, category and completion, validated and de-duplicated in canonical order", () => {
    const filters = parseLibraryFilters({
      difficulty: ["HARD", "EASY", "EASY", "ADMIN"], category: ["trees", "arrays", "trees", "../x", "Bad"], completion: ["SOLVED", "ALL", "NOT_STARTED", "DRAFT"],
    });
    expect(filters).toMatchObject({ difficulty: ["EASY", "HARD"], category: ["trees", "arrays"], completion: ["NOT_STARTED", "SOLVED"] });
    const url = new URL(libraryHref(filters), "https://example.test");
    expect(url.searchParams.getAll("difficulty")).toEqual(["EASY", "HARD"]);
    expect(url.searchParams.getAll("category")).toEqual(["trees", "arrays"]);
    expect(url.searchParams.getAll("completion")).toEqual(["NOT_STARTED", "SOLVED"]);
    expect(parseLibraryFilters(Object.fromEntries([...new Set(url.searchParams.keys())].map((key) => [key, url.searchParams.getAll(key)])))).toEqual(filters);
  });
  it("keeps old single-value URLs working, including completion=ALL", () => {
    expect(parseLibraryFilters({ difficulty: "MEDIUM", category: "arrays", completion: "ATTEMPTED" })).toMatchObject({ difficulty: ["MEDIUM"], category: ["arrays"], completion: ["ATTEMPTED"] });
    expect(parseLibraryFilters({ completion: "ALL" }).completion).toEqual([]);
    expect(libraryHref(parseLibraryFilters({ difficulty: "EASY", completion: "SOLVED" }))).toBe("/problems?difficulty=EASY&completion=SOLVED");
  });
  it("caps the number of category values and ignores oversized repeated lists", () => {
    const many = Array.from({ length: 30 }, (_, index) => "topic-" + index);
    const parsed = parseLibraryFilters({ category: many });
    expect(parsed.category).toHaveLength(MAX_CATEGORIES);
    expect(parsed.category).toEqual(many.slice(0, MAX_CATEGORIES));
    expect(parseLibraryFilters({ difficulty: Array.from({ length: 500 }, () => "NOPE") }).difficulty).toEqual([]);
  });
  it("requires a viewer for any status filter, however it is spelled", () => {
    expect(needsPersonalProgress(parseLibraryFilters({ completion: ["SOLVED", "ATTEMPTED"] }))).toBe(true);
    expect(needsPersonalProgress(parseLibraryFilters({ completion: "ALL" }))).toBe(false);
    expect(needsPersonalProgress(parseLibraryFilters({ difficulty: ["EASY", "HARD"], category: ["arrays"] }))).toBe(false);
  });
  it("validates sort and direction, defaulting to the unchanged ordering", () => {
    expect(parseLibraryFilters({})).toMatchObject({ sort: "title", dir: "asc" });
    expect(parseLibraryFilters({ sort: "newest" })).toMatchObject({ sort: "newest", dir: "desc" });
    expect(parseLibraryFilters({ sort: "difficulty", dir: "desc" })).toMatchObject({ sort: "difficulty", dir: "desc" });
    expect(parseLibraryFilters({ sort: "time", dir: "sideways" })).toMatchObject({ sort: "time", dir: "asc" });
    expect(parseLibraryFilters({ sort: "password", dir: ["asc", "desc"] })).toMatchObject({ sort: "title", dir: "asc" });
  });
  it("serialises direction only when it differs from the sort's default, and round trips", () => {
    expect(libraryHref(parseLibraryFilters({ sort: "time" }))).toBe("/problems?sort=time");
    expect(libraryHref(parseLibraryFilters({ sort: "title", dir: "desc" }))).toBe("/problems?dir=desc");
    expect(libraryHref(parseLibraryFilters({ sort: "newest", dir: "desc" }))).toBe("/problems?sort=newest");
    expect(libraryHref(parseLibraryFilters({ sort: "newest", dir: "asc" }))).toBe("/problems?sort=newest&dir=asc");
    const filters = parseLibraryFilters({ sort: "difficulty", dir: "desc", difficulty: ["EASY", "MEDIUM"] });
    const url = new URL(libraryHref(filters), "https://example.test");
    expect(parseLibraryFilters({ sort: url.searchParams.get("sort")!, dir: url.searchParams.get("dir")!, difficulty: url.searchParams.getAll("difficulty") })).toEqual(filters);
  });
});

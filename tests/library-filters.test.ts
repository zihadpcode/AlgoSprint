import { describe, expect, it } from "vitest";
import { libraryHref, literalSearch, parseLibraryFilters } from "@/features/problems/filters";

describe("library URL boundaries", () => {
  it("normalizes empty, duplicated, malformed and oversized parameters", () => {
    const filters = parseLibraryFilters({
      q: ["one", "two"], page: "-1", maxMinutes: "Infinity", difficulty: "ADMIN",
      category: "../private", tag: "x".repeat(101), completion: "DRAFT", sort: "drop table",
    });
    expect(filters).toMatchObject({ q: "", page: 1, maxMinutes: 0, difficulty: "", category: "", tag: "", completion: "ALL", sort: "title" });
    expect(parseLibraryFilters({ q: "x".repeat(101), page: "10001", maxMinutes: "241" })).toMatchObject({ q: "", page: 1, maxMinutes: 0 });
  });
  it("keeps valid filters and trims title searches", () => {
    expect(parseLibraryFilters({ q: "  Relay  ", difficulty: "EASY", review: "1", page: "2", maxMinutes: "30" }))
      .toMatchObject({ q: "Relay", difficulty: "EASY", review: true, page: 2, maxMinutes: 30 });
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
});

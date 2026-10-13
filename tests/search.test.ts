import { describe, expect, it } from "vitest";
import { literalSearch, stripSearchControls } from "@/lib/search";
import { parseLibraryFilters } from "@/features/problems/filters";
import { parseSavedFilters } from "@/features/saved/filters";

// adminFilters lives in a server-only module; its parsing is covered with the other admin boundaries.
describe("shared title-search rules", () => {
  it("escapes the LIKE wildcards and the escape character, leaving other punctuation alone", () => {
    expect(literalSearch("100%")).toBe("100\\%");
    expect(literalSearch("a_b")).toBe("a\\_b");
    expect(literalSearch("back\\slash")).toBe("back\\\\slash");
    expect(literalSearch("%_\\")).toBe("\\%\\_\\\\");
    expect(literalSearch("Two Sum (easy) & co. [x] {y} *? ^$|+")).toBe("Two Sum (easy) & co. [x] {y} *? ^$|+");
    expect(literalSearch("")).toBe("");
  });
  it("removes C0 controls and DEL but keeps ordinary and non-ASCII text", () => {
    expect(stripSearchControls("a\u0000b\nc\td\re\u001ff\u007fg")).toBe("abcdefg");
    expect(stripSearchControls("Café ✓ 数組")).toBe("Café ✓ 数組");
  });
  it("makes the library and saved-list parsers agree on controls, trimming and punctuation", () => {
    for (const q of ["  Relay  ", "x\u0000 y", "\nline\tbreak\r", "50% _off\\", "\u0000\u0000", "Café ✓"]) {
      expect(parseLibraryFilters({ q }).q, JSON.stringify(q)).toBe(parseSavedFilters({ q }).q);
    }
    expect(parseLibraryFilters({ q: "a\u0000b\nc" }).q).toBe("abc");
    expect(parseLibraryFilters({ q: "\u0000\u0000" }).q).toBe("");
    // Controls are removed before the length check, so they cannot push a short search over the limit.
    expect(parseLibraryFilters({ q: "x".repeat(100) + "\u0000\u0000" }).q).toBe("x".repeat(100));
  });
});

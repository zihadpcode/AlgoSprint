import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { leaderboardNameSchema, leaderboardSettingsSchema, nameSkeleton, normalizeName } from "@/features/leaderboard/validation";
import { composeLeaderboard } from "@/features/leaderboard/query";

const ok = (name: string) => leaderboardNameSchema.safeParse(name).success;

describe("leaderboard display name", () => {
  it("trims, normalizes to NFKC and accepts ordinary names", () => {
    expect(leaderboardNameSchema.parse("  Ada Lovelace  ")).toBe("Ada Lovelace");
    expect(leaderboardNameSchema.parse("Ada   Lovelace")).toBe("Ada Lovelace");
    expect(leaderboardNameSchema.parse("Zoë_K-9")).toBe("Zoë_K-9");
    expect(leaderboardNameSchema.parse("ab")).toBe("ab");
    expect(leaderboardNameSchema.parse("x".repeat(40))).toHaveLength(40);
    expect(leaderboardNameSchema.parse("Ｂｏｂ")).toBe("Bob");
    for (const fine of ["J.Smith", "Dr.Who", "node.js fan", "山田太郎", "Борис", "Γιώργος", "Mary-Jane O'Neil", "한글 이름", "Zoë"]) expect(ok(fine), fine).toBe(true);
  });
  it("rejects short, long, control and link-like names", () => {
    for (const bad of ["", " a ", "x".repeat(41), "a\u0000b", "tab\there", "zero​width", "flip‮me", "me@example.com", "http://x.y", "https://example.org/a", "www.spam", "buy at spam.com"]) {
      expect(ok(bad), JSON.stringify(bad)).toBe(false);
    }
  });
  it("rejects obfuscated emails and domains (fullwidth, ideographic, spaced, bracketed)", () => {
    for (const bad of ["bob＠gmail．com", "bob@gmail.com", "example。com", "example｡com", "example . com", "example .com", "bob(at)gmail", "bob [at] gmail [dot] com", "bob at gmail dot com", "visit ｗｗｗ．spam．io", "mailto: bob", "ｈｔｔｐｓ：／／evil"]) {
      expect(ok(bad), bad).toBe(false);
    }
  });
  it("rejects invisible and blank names", () => {
    const blanks = ["ㅤ", "⠀", "­", "؜", "᠎", "️", "︎", "\u{e0100}", "\u{e0020}", "ᅟ", "ᅠ", "ﾠ", "͏", "​", " ", " ", "  "];
    for (const b of blanks) {
      expect(ok(b), JSON.stringify(b)).toBe(false);
      expect(ok(b.repeat(3)), JSON.stringify(b.repeat(3))).toBe(false);
      expect(ok(`A${b}`), `A+${JSON.stringify(b)}`).toBe(false);
      // Only plain no-break spaces are whitespace; everything else is invisible and refused anywhere in the name.
      expect(ok(`${b}${b}Bo`), `pad ${JSON.stringify(b)}`).toBe(b === "  ");
    }
  });
  it("requires two letters or numbers and refuses stacked marks", () => {
    for (const bad of ["a!", "!!", "_-_", "..", "\u{1F600}\u{1F600}", "Z̀́̂̃", "à́̂̃̄b"]) expect(ok(bad), bad).toBe(false);
    expect(ok("a1")).toBe(true);
    expect(ok("e\u0301\u0301x")).toBe(true);
    expect(ok("e\u0301\u0301")).toBe(false);
  });
  it("reserves staff-like names on the confusable skeleton", () => {
    for (const bad of ["admin", "Admin", "ADMINISTRATOR", "Ad­min", "ad​min", "Ａdmin", "ad.min", "Ad Min", "r00t", "Root", "Staff", "NULL", "undefined", "support", "System", "official", "Moderator", "AlgoSprint", "AlgoSprint Team", "algo_sprint", "аdmin", "Аdmin", "Αdmin", "адmin"]) {
      // Names with soft hyphens or zero-width characters fail earlier for being invisible; either way they are refused.
      expect(ok(bad), JSON.stringify(bad)).toBe(false);
    }
    for (const fine of ["Adminton", "Rooted", "Nullable", "Mod Squad"]) expect(ok(fine), fine).toBe(true);
  });
  it("refuses words that mix Latin with Cyrillic or Greek", () => {
    for (const bad of ["Аlice", "Bоb", "Cyrus Αlpha"]) expect(ok(bad), bad).toBe(false);
    expect(ok("Alice Борис")).toBe(true);
  });
  it("gives look-alike names the same skeleton", () => {
    const key = (n: string) => nameSkeleton(normalizeName(n));
    expect(key("Admin")).toBe(key("Аdmin"));
    expect(key("Admin")).toBe(key("ADMIN"));
    expect(key("Bob")).toBe(key("Вob"));
    expect(key("pablo")).toBe(key("раblо"));
    expect(key("José")).toBe(key("Jose"));
    expect(key("Ｊose")).toBe(key("jose"));
    expect(key("Oscar")).toBe(key("Οscar"));
    expect(key("a  b")).toBe(key("a b"));
    expect(key("Ada")).not.toBe(key("Adam"));
    expect(nameSkeleton("x".repeat(40))).toHaveLength(40);
    expect(nameSkeleton("ß".repeat(40)).length).toBeLessThanOrEqual(80);
  });
  it("requires a name only when opting in", () => {
    expect(leaderboardSettingsSchema.safeParse({ optIn: false }).success).toBe(true);
    expect(leaderboardSettingsSchema.safeParse({ optIn: true }).success).toBe(false);
    expect(leaderboardSettingsSchema.safeParse({ optIn: true, displayName: "Ada" }).success).toBe(true);
    expect(leaderboardSettingsSchema.safeParse({ optIn: true, displayName: "Ｂｏｂ" })).toMatchObject({ success: true, data: { displayName: "Bob" } });
  });
});

describe("composeLeaderboard", () => {
  const row = (rank: number, name: string, isViewer = false) => ({ rank, name, solved: 1, easy: 1, medium: 0, hard: 0, week: 0, isViewer });
  it("highlights the viewer inside the shared board without mutating it", () => {
    const top = [row(1, "A"), row(2, "B")];
    const mine = row(2, "B", true);
    const board = composeLeaderboard(top, mine);
    expect(board.entries.map((e) => e.isViewer)).toEqual([false, true]);
    expect(top.every((e) => !e.isViewer)).toBe(true);
    expect(board.viewerEntry).toBe(mine);
  });
  it("keeps a viewer ranked below the board separate, and nobody highlighted for guests", () => {
    expect(composeLeaderboard([row(1, "A")], row(150, "Z", true))).toMatchObject({ entries: [{ isViewer: false }], viewerEntry: { rank: 150 } });
    expect(composeLeaderboard([row(1, "A")], null)).toMatchObject({ entries: [{ isViewer: false }], viewerEntry: null });
  });
});

import { describe, expect, it } from "vitest";
import { leaderboardNameSchema, leaderboardSettingsSchema } from "@/features/leaderboard/validation";

describe("leaderboard display name", () => {
  it("trims and accepts ordinary names", () => {
    expect(leaderboardNameSchema.parse("  Ada Lovelace  ")).toBe("Ada Lovelace");
    expect(leaderboardNameSchema.parse("Zoë_K-9")).toBe("Zoë_K-9");
    expect(leaderboardNameSchema.parse("ab")).toBe("ab");
    expect(leaderboardNameSchema.parse("x".repeat(40))).toHaveLength(40);
  });
  it("rejects short, long, control, invisible, link and email names", () => {
    for (const bad of ["", " a ", "x".repeat(41), "a\u0000b", "tab\there", "zero​width", "flip‮me", "me@example.com", "http://x.y", "https://example.org/a", "www.spam", "buy at spam.com"]) {
      expect(leaderboardNameSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
  it("requires a name only when opting in", () => {
    expect(leaderboardSettingsSchema.safeParse({ optIn: false }).success).toBe(true);
    expect(leaderboardSettingsSchema.safeParse({ optIn: true }).success).toBe(false);
    expect(leaderboardSettingsSchema.safeParse({ optIn: true, displayName: "Ada" }).success).toBe(true);
  });
});

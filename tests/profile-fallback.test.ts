import { describe, expect, it, vi } from "vitest";
import { ensureProfile, isMissingLeaderboardColumn } from "@/features/auth/profile";

const user = { id: "10000000-0000-4000-8000-000000000001" };
// Shape recorded from Prisma 7 when the column does not exist yet (migration not applied).
const missing = Object.assign(new Error("column User.leaderboardOptIn does not exist"), { code: "P2022", meta: { modelName: "User", driverAdapterError: { cause: { column: "leaderboardOptIn" } } } });
const row = { id: user.id, displayName: "Ada", role: "USER", timeZone: "UTC", createdAt: new Date(0) };

describe("profile deploy-order fallback", () => {
  it("recognises only a missing leaderboard column on User", () => {
    expect(isMissingLeaderboardColumn(missing)).toBe(true);
    expect(isMissingLeaderboardColumn({ code: "P2022", meta: { modelName: "User" } })).toBe(true);
    expect(isMissingLeaderboardColumn({ code: "P2022", meta: { modelName: "Problem", driverAdapterError: { cause: { column: "Problem.leaderboardNameKey" } } } })).toBe(true);
    expect(isMissingLeaderboardColumn({ code: "P2022", meta: { modelName: "Problem", driverAdapterError: { cause: { column: "Problem.position" } } } })).toBe(false);
    expect(isMissingLeaderboardColumn({ code: "P2002", meta: { modelName: "User" } })).toBe(false);
    expect(isMissingLeaderboardColumn(new Error("boom"))).toBe(false);
    expect(isMissingLeaderboardColumn(null)).toBe(false);
  });
  it("serves the profile without the leaderboard flag when the column is missing, then stays off", async () => {
    const selects: Record<string, boolean>[] = [];
    const upsert = vi.fn(async ({ select }: { select: Record<string, boolean> }) => { selects.push(select); if (select.leaderboardOptIn) throw missing; return row; });
    const profile = await ensureProfile({ user: { upsert } } as never, user);
    expect(profile).toMatchObject({ id: user.id, displayName: "Ada", role: "USER", leaderboardOptIn: false });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(selects[0]).toHaveProperty("leaderboardOptIn", true);
    expect(selects[1]).not.toHaveProperty("leaderboardOptIn");
  });
  it("returns the stored flag once the migration is applied, and does not mask other errors", async () => {
    const upsert = vi.fn(async () => ({ ...row, leaderboardOptIn: true }));
    expect((await ensureProfile({ user: { upsert } } as never, user)).leaderboardOptIn).toBe(true);
    expect(upsert).toHaveBeenCalledOnce();
    const broken = vi.fn(async () => { throw new Error("database down"); });
    await expect(ensureProfile({ user: { upsert: broken } } as never, user)).rejects.toThrow("database down");
    expect(broken).toHaveBeenCalledOnce();
  });
});

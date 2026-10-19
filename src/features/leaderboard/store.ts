import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { leaderboardSettingsSchema } from "./validation";

export type LeaderboardWrite = { ok: true; optIn: boolean } | { ok: false; reason: "taken" | "missing-user" };

// Owner-scoped: the verified viewer id is the only row this can touch. Opting out keeps the stored name but hides the user.
export async function writeLeaderboardSettings(db: PrismaClient, userId: string, raw: unknown): Promise<LeaderboardWrite> {
  const id = z.uuid().parse(userId);
  const settings = leaderboardSettingsSchema.parse(raw);
  try {
    const data = settings.optIn ? { leaderboardOptIn: true, displayName: settings.displayName } : { leaderboardOptIn: false };
    const result = await db.user.updateMany({ where: { id }, data });
    return result.count === 1 ? { ok: true, optIn: settings.optIn } : { ok: false, reason: "missing-user" };
  } catch (error) {
    // The partial unique index on lower("displayName") for opted-in users makes names unique case-insensitively, race-free.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, reason: "taken" };
    throw error;
  }
}

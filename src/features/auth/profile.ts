import { z } from "zod";
import { Prisma, type PrismaClient, type Role } from "@/generated/prisma/client";
import { displayNameSchema } from "./validation";

const baseSelect = { id: true, displayName: true, role: true, timeZone: true, createdAt: true } as const;
const fullSelect = { ...baseSelect, leaderboardOptIn: true } as const;

// Deploy-order safety: if this code runs before the leaderboard_opt_in migration, selecting User.leaderboardOptIn fails
// with Prisma P2022. Every signed-in request goes through ensureProfile, so fall back to the columns that always exist.
export function isMissingLeaderboardColumn(error: unknown) {
  const failure = error as { code?: unknown; meta?: { modelName?: unknown; driverAdapterError?: { cause?: { column?: unknown } } } } | null;
  if (failure?.code !== "P2022") return false;
  const column = failure.meta?.driverAdapterError?.cause?.column;
  return failure.meta?.modelName === "User" || (typeof column === "string" && /(^|\.)leaderboard(OptIn|NameKey)$/.test(column));
}

type Profile = { id: string; displayName: string | null; role: Role; timeZone: string; createdAt: Date; leaderboardOptIn: boolean };

// Caller must pass a user returned by Supabase getUser(), never form data.
export async function ensureProfile(db: PrismaClient, verifiedUser: { id: string; user_metadata?: Record<string, unknown> }): Promise<Profile> {
  try { return await readProfile(db, verifiedUser, fullSelect); }
  catch (error) {
    if (!isMissingLeaderboardColumn(error)) throw error;
    return { ...(await readProfile(db, verifiedUser, baseSelect)), leaderboardOptIn: false };
  }
}

async function readProfile<S extends typeof baseSelect | typeof fullSelect>(db: PrismaClient, verifiedUser: { id: string; user_metadata?: Record<string, unknown> }, select: S) {
  const id = z.uuid().parse(verifiedUser.id);
  const name = displayNameSchema.safeParse(verifiedUser.user_metadata?.display_name);
  try { return await db.user.upsert({
    where: { id },
    create: { id, displayName: name.success ? name.data : null, role: "USER" },
    update: {},
    select,
  }); } catch (error) {
    // Two first requests may provision the same profile concurrently.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.user.findUniqueOrThrow({ where: { id }, select });
    }
    throw error;
  }
}

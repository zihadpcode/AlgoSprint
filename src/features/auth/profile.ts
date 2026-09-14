import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { displayNameSchema } from "./validation";

// Caller must pass a user returned by Supabase getUser(), never form data.
export async function ensureProfile(db: PrismaClient, verifiedUser: { id: string; user_metadata?: Record<string, unknown> }) {
  const id = z.uuid().parse(verifiedUser.id);
  const name = displayNameSchema.safeParse(verifiedUser.user_metadata?.display_name);
  const select = { id: true, displayName: true, role: true, timeZone: true, createdAt: true } as const;
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

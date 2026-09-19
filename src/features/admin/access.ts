import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export class AdminError extends Error {}
// Recheck database role within each read/write transaction. Role revocation waits
// for an in-flight authorized transaction; future requests then fail closed.
export async function lockAdmin(tx: Prisma.TransactionClient, userId: string) {
  const [user] = await tx.$queryRaw<{ role: string }[]>`SELECT role FROM app."User" WHERE id = ${userId}::uuid FOR SHARE`;
  if (user?.role !== "ADMIN") throw new AdminError("Administrator access is required. Your draft is unchanged.");
}

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { connectionOptions } from "@/lib/db/connection";

// Shared by trusted server code and CLI scripts. Never import into client UI.
export function createDatabaseClient(connectionString: string) {
  const adapter = new PrismaPg({
    ...connectionOptions(connectionString),
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 1_000,
  }, { schema: "app" });
  return new PrismaClient({ adapter });
}

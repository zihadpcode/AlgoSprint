import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Shared by trusted server code and CLI scripts. Never import into client UI.
export function createDatabaseClient(connectionString: string) {
  const url = new URL(connectionString);
  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    throw new Error("Use a PostgreSQL connection URL for the pg adapter.");
  }
  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 1_000,
  }, { schema: "app" });
  return new PrismaClient({ adapter });
}

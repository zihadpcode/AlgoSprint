import "server-only";
import { createDatabaseClient } from "@/lib/db/client";

const globalForPrisma = globalThis as unknown as {
  algosprintPrisma?: ReturnType<typeof createDatabaseClient>;
};

// Lazy construction keeps the landing page and build usable without secrets.
export function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Configure .env.local before using database features.");
  }
  globalForPrisma.algosprintPrisma ??= createDatabaseClient(process.env.DATABASE_URL);
  return globalForPrisma.algosprintPrisma;
}

import { loadEnvConfig } from "@next/env";
import { createDatabaseClient } from "../src/lib/db/client";
import { loadProblems } from "../scripts/lib/load-problems";
import { seedProblems } from "./seed-data";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in .env.local before seeding.");
  const problems = await loadProblems();
  const db = createDatabaseClient(url);
  try { console.log(await seedProblems(db, problems)); }
  finally { await db.$disconnect(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
});

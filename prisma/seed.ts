import { loadEnvConfig } from "@next/env";
import { createDatabaseClient } from "../src/lib/db/client";
import { loadProblems } from "../scripts/lib/load-problems";
import { seedProblems } from "./seed-data";
import { seedRoadmaps } from "./seed-roadmaps";
import { ROADMAPS } from "../src/data/seeds/roadmaps";
import { validateRoadmapReferences } from "../src/lib/validators/roadmap";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL in .env.local before seeding.");
  const problems = await loadProblems();
  validateRoadmapReferences(ROADMAPS, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
  const db = createDatabaseClient(url);
  try {
    console.log("Problems:", await seedProblems(db, problems));
    console.log("Roadmaps:", await seedRoadmaps(db, ROADMAPS));
  }
  finally { await db.$disconnect(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
});

import { loadEnvConfig } from "@next/env";
import { createDatabaseClient } from "../src/lib/db/client";
import { loadPythonStarters, seedLanguageStarters } from "../prisma/seed-language-starters";

// Deliberately separate from `npm run db:seed`: once these rows exist the editor offers Python (with Run disabled until
// PYTHON_RUNNER is set), so run this only when the Python runner is about to be switched on. Insert-only and idempotent.
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Configure a trusted database connection first.");
  const db = createDatabaseClient(url);
  try { console.log("Language starters:", await seedLanguageStarters(db, await loadPythonStarters())); }
  finally { await db.$disconnect(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Python starter seed failed."); process.exitCode = 1; });

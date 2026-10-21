import { loadEnvConfig } from "@next/env";
import { parseArgs } from "node:util";
import { createDatabaseClient } from "../src/lib/db/client";
import { loadPythonSolutions, selectPythonSolutions } from "./lib/python-solutions";
import { seedPythonSolutions } from "../prisma/seed-python-solutions";

// Separate insert-only add-on. Never use a general problem reseed to publish another language.
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Configure a trusted database connection first.");
  const { values } = parseArgs({ options: { slug: { type: "string", multiple: true } }, strict: true });
  const entries = selectPythonSolutions(await loadPythonSolutions(), values.slug ?? []);
  const db = createDatabaseClient(url);
  try { console.log("Python guided solutions:", await seedPythonSolutions(db, entries)); }
  finally { await db.$disconnect(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Python solution seed failed"); process.exitCode = 1; });

import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { createDatabaseClient } from "../src/lib/db/client";

loadEnvConfig(process.cwd());
async function main() {
  const { values } = parseArgs({ options: { "user-id": { type: "string" }, role: { type: "string" } }, strict: true });
  const id = z.uuid().parse(values["user-id"]);
  const role = z.enum(["USER", "ADMIN"]).parse(values.role);
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Configure a trusted database connection first.");
  const db = createDatabaseClient(url);
  try {
    // Only an existing, authenticated profile can be promoted; no account creation.
    await db.user.update({ where: { id }, data: { role } });
    console.log(`Updated role for ${id} to ${role}.`);
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Role update failed. Check the UUID, USER/ADMIN role, and database configuration. The user must sign in once first."); process.exitCode = 1; });

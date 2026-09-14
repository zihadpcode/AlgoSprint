import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Prisma CLI runs outside Next.js; explicitly load the same root .env.local.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "node --import tsx prisma/seed.ts" },
  // An absent URL is valid for generation/build. Database commands require it.
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});

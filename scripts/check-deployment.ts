import { loadEnvConfig } from "@next/env";
import { parseArgs } from "node:util";
import { deploymentIssues } from "./lib/deployment-config";
try {
  const { values } = parseArgs({ options: { migrations: { type: "boolean", default: false } }, strict: true, allowPositionals: false });
  // Suppress dotenv parser diagnostics: the report prints variable names, never values.
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  const issues = deploymentIssues(process.env, values.migrations);
  if (Number(process.versions.node.split(".")[0]) !== 24) issues.push("Use Node.js 24, matching package.json and .nvmrc.");
  if (issues.length) {
    console.error("Deployment configuration needs attention:"); for (const issue of issues) console.error(`- ${issue}`); process.exitCode = 1;
  } else console.log("Configuration format checks passed. This does not verify connections, migrations, account delivery or provider behavior. Complete the deployment guide's live checks.");
} catch { console.error("Deployment check failed. Use npm run deploy:check -- [--migrations]. No configuration values were printed."); process.exitCode = 1; }

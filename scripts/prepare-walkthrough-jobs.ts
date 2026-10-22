import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { loadWalkthroughJobs } from "./lib/walkthrough-jobs";

async function main() {
  const { values } = parseArgs({ options: { output: { type: "string" }, only: { type: "string", multiple: true } }, strict: true });
  if (!values.output) throw new Error("Pass --output with a local job file path");
  const jobs = await loadWalkthroughJobs();
  const selected = new Set(values.only ?? []);
  for (const key of selected) if (!jobs.some((job) => `${job.slug}:${job.language}` === key)) throw new Error(`Unknown walkthrough ${key}`);
  const included = selected.size ? jobs.filter((job) => selected.has(`${job.slug}:${job.language}`)) : jobs;
  await writeFile(values.output, JSON.stringify(included, null, 2) + "\n");
  console.log(`Prepared ${included.length} reviewed walkthrough jobs; no media was rendered.`);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Could not prepare walkthroughs"); process.exitCode = 1; });

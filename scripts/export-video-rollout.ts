import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { VIDEOS } from "../src/data/seeds/videos";
import sources from "../src/data/seeds/video-sources.json";
import { loadProblems } from "./lib/load-problems";
import { validateVideoCatalog } from "./lib/video-coverage";
import { videoRolloutSql } from "./lib/video-rollout";

async function main() {
  const { values } = parseArgs({ options: { baseline: { type: "string" }, output: { type: "string" }, "expected-existing": { type: "string" } }, strict: true });
  if (!values.baseline) throw new Error("Pass --baseline with an independently read production problem fingerprint. This command only exports SQL.");
  const published = new Set((await loadProblems()).filter((problem) => problem.status === "PUBLISHED").map((problem) => problem.slug));
  validateVideoCatalog(sources, VIDEOS, published);
  const pinned = values["expected-existing"] ? JSON.parse(await readFile(values["expected-existing"], "utf8")) as { existing_videos: unknown } : undefined;
  const sql = videoRolloutSql(VIDEOS, values.baseline, published.size, pinned?.existing_videos ?? []);
  if (values.output) { await writeFile(values.output, sql, { flag: "wx" }); console.log(`Reviewable insert-only video SQL saved to ${values.output}. No database connection was opened.`); }
  else process.stdout.write(sql);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Video SQL export failed"); process.exitCode = 1; });

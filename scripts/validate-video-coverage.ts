import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { VIDEOS } from "../src/data/seeds/videos";
import sources from "../src/data/seeds/video-sources.json";
import { loadProblems } from "./lib/load-problems";
import { loadWalkthroughJobs } from "./lib/walkthrough-jobs";
import { assertCompleteVideoCoverage, validateOriginalWalkthroughAssets, validateVideoCatalog, videoCoverageReport } from "./lib/video-coverage";

async function main() {
  const { values } = parseArgs({ options: { "references-only": { type: "boolean", default: false } }, strict: true });
  const publishedSlugs = new Set((await loadProblems()).filter((problem) => problem.status === "PUBLISHED").map((problem) => problem.slug));
  if (publishedSlugs.size !== 125) throw new Error(`Expected 125 published problems, found ${publishedSlugs.size}. Review the coverage contract before expanding it.`);
  const catalog = validateVideoCatalog(sources, VIDEOS, publishedSlugs);
  const manifest = values["references-only"] ? [] : await validateOriginalWalkthroughAssets(
    JSON.parse(await readFile("src/data/seeds/problem-walkthroughs.json", "utf8")), await loadWalkthroughJobs());
  const report = videoCoverageReport({ publishedSlugs, sources: catalog, videos: VIDEOS, walkthroughs: manifest });
  console.log(JSON.stringify(report, null, 2));
  if (!values["references-only"]) assertCompleteVideoCoverage(report);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Video coverage validation failed"); process.exitCode = 1; });

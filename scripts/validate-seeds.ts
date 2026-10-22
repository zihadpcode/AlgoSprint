import { loadProblems } from "./lib/load-problems";
import { ROADMAPS } from "../src/data/seeds/roadmaps";
import { validateRoadmapReferences } from "../src/lib/validators/roadmap";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PYTHON_STARTERS_PATH, validatePythonStarters } from "./lib/python-starters";
import { VIDEOS } from "../src/data/seeds/videos";
import { validateVideoReferences } from "../src/lib/validators/video";
import { CATEGORIES, CATEGORY_GROUPS } from "../src/data/seeds/taxonomy";
import { validateCategoryGroups } from "../src/lib/validators/category-groups";
import videoSources from "../src/data/seeds/video-sources.json";
import { loadWalkthroughJobs } from "./lib/walkthrough-jobs";
import { assertCompleteVideoCoverage, validateOriginalWalkthroughAssets, validateVideoCatalog, videoCoverageReport } from "./lib/video-coverage";
import { loadPythonSolutions } from "./lib/python-solutions";

async function main() {
  const problems = await loadProblems();
  const generated = await loadProblems("src/data/seeds/generated");
  console.log(`Validated ${generated.length} generated draft fixtures separately from the published seed set.`);
  const roadmaps = validateRoadmapReferences(ROADMAPS, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
  console.log(`Validated ${problems.length} original problems, their examples, and all expected outputs.`);
  const starters = validatePythonStarters(JSON.parse(await readFile(join(process.cwd(), PYTHON_STARTERS_PATH), "utf8")), new Set(problems.map((p) => p.slug)));
  console.log(`Validated ${starters.length} Python starter stubs against the runner signatures and existing problems.`);
  const solutions = await loadPythonSolutions();
  console.log(`Validated ${solutions.length} Python guided approaches against the published JavaScript approach coverage.`);
  console.log(`Validated ${roadmaps.length} original roadmaps and their ordered problem references.`);
  const videos = validateVideoReferences(VIDEOS, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
  const groups = validateCategoryGroups(CATEGORY_GROUPS, CATEGORIES);
  console.log(`Validated ${groups.length} category groups: every child is an existing leaf, no leaf is in two groups, and no group collides with a leaf.`);
  console.log(`Validated ${videos.length} video lessons: published problems, YouTube ids, and sorted non-overlapping segments.`);
  const publishedSlugs = new Set(problems.filter((problem) => problem.status === "PUBLISHED").map((problem) => problem.slug));
  if (publishedSlugs.size !== 125) throw new Error("Review the 125-problem video coverage contract before expanding the published set.");
  const catalog = validateVideoCatalog(videoSources, videos, publishedSlugs);
  const walkthroughs = await validateOriginalWalkthroughAssets(JSON.parse(await readFile("src/data/seeds/problem-walkthroughs.json", "utf8")), await loadWalkthroughJobs());
  const coverage = videoCoverageReport({ publishedSlugs, videos, sources: catalog, walkthroughs });
  assertCompleteVideoCoverage(coverage);
  console.log(`Validated ${coverage.covered}/${coverage.required} meaningful language-specific video pairs, including ${walkthroughs.length} source-matched original walkthroughs.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed validation failed.");
  process.exitCode = 1;
});

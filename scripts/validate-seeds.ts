import { loadProblems } from "./lib/load-problems";
import { ROADMAPS } from "../src/data/seeds/roadmaps";
import { validateRoadmapReferences } from "../src/lib/validators/roadmap";

async function main() {
  const problems = await loadProblems();
  const roadmaps = validateRoadmapReferences(ROADMAPS, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
  console.log(`Validated ${problems.length} original problems, their examples, and all expected outputs.`);
  console.log(`Validated ${roadmaps.length} original roadmaps and their ordered problem references.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed validation failed.");
  process.exitCode = 1;
});

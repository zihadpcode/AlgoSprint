import { loadProblems } from "./lib/load-problems";

async function main() {
  const problems = await loadProblems();
  console.log(`Validated ${problems.length} original problems, their examples, and all expected outputs.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed validation failed.");
  process.exitCode = 1;
});

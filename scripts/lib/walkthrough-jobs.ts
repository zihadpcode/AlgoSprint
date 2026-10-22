import { createHash } from "node:crypto";
import { canonicalJson, problemHash } from "../../prisma/seed-data";
import type { ProblemSeed } from "../../src/lib/validators/problem";
import { loadProblems } from "./load-problems";
import { loadPythonSolutions } from "./python-solutions";

export function walkthroughJob(problem: ProblemSeed, language: "JAVASCRIPT" | "PYTHON", solution: ProblemSeed["solutions"][number]) {
  const content = { slug: problem.slug, language, title: problem.title, statement: problem.statement,
    examples: problem.examples, solution, seedHash: problemHash(problem) };
  return { ...content, sourceHash: createHash("sha256").update(canonicalJson(content)).digest("hex") };
}

export async function loadWalkthroughJobs() {
  const problems = await loadProblems();
  const python = new Map((await loadPythonSolutions()).filter((entry) => entry.solution.kind === "OPTIMAL").map((entry) => [entry.slug, entry.solution]));
  return problems.flatMap((problem) => {
    const javascript = problem.solutions.find((solution) => solution.language === "JAVASCRIPT" && solution.kind === "OPTIMAL");
    const py = python.get(problem.slug);
    if (!javascript || !py) throw new Error(`Missing optimal walkthrough source for ${problem.slug}`);
    return [walkthroughJob(problem, "JAVASCRIPT", javascript), walkthroughJob(problem, "PYTHON", py)];
  });
}

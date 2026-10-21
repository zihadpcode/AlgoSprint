import type { PrismaClient } from "../src/generated/prisma/client";
import { canonicalJson } from "./seed-data";
import { pythonSolutionEntriesSchema } from "../scripts/lib/python-solutions";
import { SIGNATURES } from "../src/features/submissions/signatures";
import { pythonEntryPoint } from "../src/features/submissions/python-names";

export async function seedPythonSolutions(db: PrismaClient, input: unknown) {
  const entries = pythonSolutionEntriesSchema.parse(input);
  return db.$transaction(async (tx) => {
    // Prevent concurrent edits or first-insert races while comparing and adding editorial rows.
    await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
    await tx.$executeRaw`LOCK TABLE app."Problem" IN SHARE MODE`;
    await tx.$executeRaw`LOCK TABLE app."StarterCode" IN SHARE MODE`;
    await tx.$executeRaw`LOCK TABLE app."ProblemSolution", app."SolutionStep" IN SHARE ROW EXCLUSIVE MODE`;
    const problems = await tx.problem.findMany({ where: { slug: { in: [...new Set(entries.map((entry) => entry.slug))] } },
      select: { id: true, slug: true, seedHash: true, status: true, kind: true,
        starterCode: { where: { language: "PYTHON" }, select: { entryPoint: true } },
        solutions: { where: { language: "PYTHON" }, select: { kind: true, language: true, title: true,
          intuition: true, approach: true, pseudocode: true, code: true, timeComplexity: true, spaceComplexity: true,
          commonMistakes: true, interviewExplanation: true,
          steps: { select: { position: true, title: true, content: true }, orderBy: { position: "asc" } } } } } });
    const bySlug = new Map(problems.map((problem) => [problem.slug, problem]));
    const missing: typeof entries = [];
    for (const entry of entries) {
      const problem = bySlug.get(entry.slug);
      if (!problem || problem.status !== "PUBLISHED" || problem.kind !== "CODING" || problem.seedHash !== entry.seedHash) throw new Error(`Python solution problem conflict for ${entry.slug}`);
      if (problem.starterCode[0]?.entryPoint !== pythonEntryPoint(SIGNATURES[entry.slug].entryPoint)) throw new Error(`Python starter missing or mismatched for ${entry.slug}`);
      const existing = problem.solutions.find((solution) => solution.kind === entry.solution.kind);
      if (!existing) missing.push(entry);
      else if (canonicalJson(existing) !== canonicalJson(entry.solution)) throw new Error(`Python solution conflict for ${entry.slug}:${entry.solution.kind}`);
    }
    for (const entry of missing) {
      const { steps, ...solution } = entry.solution;
      await tx.problemSolution.create({ data: { ...solution, problemId: bySlug.get(entry.slug)!.id, steps: { create: steps } } });
    }
    return { created: missing.length, skipped: entries.length - missing.length };
  }, { timeout: 60_000 });
}

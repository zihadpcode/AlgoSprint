import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { problemSchema, type ProblemSeed } from "../../src/lib/validators/problem";
import { pythonEntryPoint } from "../../src/features/submissions/python-names";
import { SIGNATURES } from "../../src/features/submissions/signatures";
import { problemHash } from "../../prisma/seed-data";
import { loadProblems } from "./load-problems";

const solutionSchema = problemSchema.shape.solutions.element;
const translationSchema = solutionSchema.omit({ language: true }).partial().required({ kind: true, code: true });
export const pythonSolutionTranslationsSchema = z.array(z.strictObject({
  slug: problemSchema.shape.slug,
  solutions: z.array(translationSchema).min(1).max(4),
})).min(1).max(1000);
export const pythonSolutionEntrySchema = z.strictObject({
  slug: problemSchema.shape.slug,
  seedHash: z.string().regex(/^[a-f0-9]{64}$/),
  solution: solutionSchema.extend({ language: z.literal("PYTHON") }),
});
export const pythonSolutionEntriesSchema = z.array(pythonSolutionEntrySchema).min(1).max(4000).superRefine((entries, ctx) => {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    const key = `${entry.slug}:${entry.solution.kind}`;
    if (seen.has(key)) ctx.addIssue({ code: "custom", path: [index], message: `Duplicate Python solution ${key}` });
    seen.add(key);
    const signature = Object.hasOwn(SIGNATURES, entry.slug) ? SIGNATURES[entry.slug] : undefined;
    if (!signature || !entry.solution.code.includes(`def ${pythonEntryPoint(signature.entryPoint)}(`)) {
      ctx.addIssue({ code: "custom", path: [index, "solution", "code"], message: "Missing reviewed Python entry point" });
    }
    const positions = entry.solution.steps.map((step) => step.position);
    if (positions.some((position, i) => position !== i + 1)) ctx.addIssue({ code: "custom", path: [index, "solution", "steps"], message: "Step positions must be consecutive" });
  });
});
export type PythonSolutionEntry = z.infer<typeof pythonSolutionEntrySchema>;
export const PYTHON_SOLUTION_FILES = ["python-solutions-a.json", "python-solutions-b.json", "python-solutions-c.json"] as const;

// Add-on content: original published JSON and its content hash remain byte-for-byte unchanged.
// Shared explanations describe the same algorithm; translations override Python-specific implementation details.
export function buildPythonSolutions(problems: ProblemSeed[], input: unknown): PythonSolutionEntry[] {
  const groups = pythonSolutionTranslationsSchema.parse(input);
  const bySlug = new Map(groups.map((entry) => [entry.slug, entry]));
  if (bySlug.size !== groups.length) throw new Error("Duplicate Python solution problem");
  const published = problems.filter((problem) => problem.status === "PUBLISHED");
  const known = new Set(published.map((problem) => problem.slug));
  for (const slug of bySlug.keys()) if (!known.has(slug)) throw new Error(`Unknown published Python solution problem ${slug}`);
  const entries: PythonSolutionEntry[] = [];
  for (const problem of published) {
    const signature = SIGNATURES[problem.slug];
    if (!signature) throw new Error(`No Python signature for ${problem.slug}`);
    const group = bySlug.get(problem.slug);
    if (!group) throw new Error(`Missing Python solutions for ${problem.slug}`);
    const originals = problem.solutions.filter((solution) => solution.language === "JAVASCRIPT");
    const kinds = new Set(group.solutions.map((solution) => solution.kind));
    if (kinds.size !== group.solutions.length || originals.length !== group.solutions.length
      || originals.some((solution) => !kinds.has(solution.kind))) throw new Error(`Python approach coverage differs for ${problem.slug}`);
    for (const original of originals) {
      const translated = group.solutions.find((solution) => solution.kind === original.kind)!;
      const name = pythonEntryPoint(signature.entryPoint);
      if (!translated.code.includes(`def ${name}(`)) throw new Error(`Missing Python entry point for ${problem.slug}:${original.kind}`);
      entries.push({ slug: problem.slug, seedHash: problemHash(problem),
        solution: { ...structuredClone(original), ...translated, language: "PYTHON" } });
    }
  }
  return pythonSolutionEntriesSchema.parse(entries);
}

export async function loadPythonSolutions() {
  const groups = await Promise.all(PYTHON_SOLUTION_FILES.map(async (file) =>
    pythonSolutionTranslationsSchema.parse(JSON.parse(await readFile(join(process.cwd(), "src/data/seeds/languages", file), "utf8")))));
  return buildPythonSolutions(await loadProblems(), groups.flat());
}

export function selectPythonSolutions(entries: PythonSolutionEntry[], slugs: readonly string[]) {
  if (!slugs.length) return entries;
  const known = new Set(entries.map((entry) => entry.slug));
  for (const slug of slugs) if (!known.has(slug)) throw new Error(`No Python solutions for ${slug}`);
  const selected = new Set(slugs);
  return entries.filter((entry) => selected.has(entry.slug));
}

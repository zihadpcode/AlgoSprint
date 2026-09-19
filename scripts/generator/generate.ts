import { z } from "zod";
import { problemBatchSchema, problemSchema, type ProblemSeed } from "../../src/lib/validators/problem";
import { createRandom, seedSchema } from "./random";
import { findTemplate, GENERATOR_VERSION, TEMPLATES } from "./registry";

export const generationSchema = z.strictObject({
  seed: seedSchema,
  count: z.int().min(1).max(10).default(1),
  template: z.string().refine((id) => id === "all" || TEMPLATES.some((t) => t.id === id), "Unknown template").default("all"),
}).refine((o) => o.seed + o.count - 1 <= 0xffffffff, "Seed range exceeds uint32");
export type GenerationOptions = z.input<typeof generationSchema>;

export function checkedOutput(template: ReturnType<typeof findTemplate>, input: unknown) {
  const optimal = template.evaluate(structuredClone(input), "optimal");
  const brute = template.evaluate(structuredClone(input), "brute");
  if (JSON.stringify(optimal) !== JSON.stringify(brute)) throw new Error(`${template.id}: reference/brute-force disagreement.`);
  return optimal;
}

export function generateProblem(templateId: string, seed: number): ProblemSeed {
  seedSchema.parse(seed);
  const template = findTemplate(templateId);
  const random = createRandom(seed);
  // Fixed examples remain pedagogical; four additional cases vary reproducibly by seed.
  const inputs: unknown[] = [...template.edges, ...Array.from({ length: 4 }, () => template.random(random))];
  const testCases = inputs.map((input, index) => ({
    position: index + 1, visibility: index < 2 ? "VISIBLE" as const : "HIDDEN" as const,
    input: z.json().parse(input), output: checkedOutput(template, input),
    explanation: `For ${JSON.stringify(input)}, the result is ${JSON.stringify(checkedOutput(template, input))}. ${index < 2 ? template.optimalApproach : "Checked by independent enumeration and the optimized reference."}`,
  }));
  // More differential checks than stored fixtures; these checks never evaluate code strings.
  for (let n = 0; n < 64; n++) checkedOutput(template, template.random(random));
  const entryPoint = template.optimal.name;
  const solution = (kind: "BRUTE_FORCE" | "OPTIMAL"): ProblemSeed["solutions"][number] => {
    const brute = kind === "BRUTE_FORCE";
    const approach = brute ? template.bruteApproach : template.optimalApproach;
    // Authored static listings are stable across tsx/Vitest compiler formatting.
    const code = (brute ? template.bruteCode : template.optimalCode).replace(/^function\s+[^(]+/, `function ${entryPoint}`);
    return {
      kind, language: "JAVASCRIPT", title: brute ? "Enumerate the candidates" : "Reuse the structure",
      intuition: brute ? "Enumerating all allowed choices gives a small-input correctness oracle." : template.invariant,
      approach, pseudocode: approach, code,
      timeComplexity: brute ? template.bruteTime : template.optimalTime,
      spaceComplexity: brute ? (template.id === "reservoir-spans" ? "O(q) output, O(1) auxiliary" : "O(1)") : template.optimalSpace,
      commonMistakes: template.mistakes,
      interviewExplanation: `${approach} ${brute ? "Use this bounded baseline to check the optimized strategy." : template.invariant}`,
      steps: [
        { position: 1, title: "Define the candidates", content: template.statement },
        { position: 2, title: "Compute the result", content: approach },
        { position: 3, title: "Check the argument", content: brute ? "Each permitted candidate is inspected, so taking the requested count, total or optimum is complete." : template.invariant },
      ],
    };
  };
  return problemSchema.parse({
    schemaVersion: 1, slug: `gen-v${GENERATOR_VERSION}-${template.id}-${seed}`, title: `${template.title} — Set ${seed}`,
    difficulty: "EASY", kind: "CODING", status: "DRAFT", pattern: template.pattern,
    statement: template.statement, constraints: template.constraints, estimatedMinutes: 20,
    timeLimitMs: 2000, memoryLimitKb: 262144, categories: template.categories, tags: template.tags,
    interviewStyles: ["general-software"], relatedSlugs: [],
    examples: testCases.slice(0, 2).map(({ position, input, output, explanation }) => ({ position, input, output, explanation })),
    hints: template.hints.map((content, n) => ({ position: n + 1, content })),
    starterCode: [{ language: "JAVASCRIPT", entryPoint, code: `function ${entryPoint}(input) {\n  // input is the object described in the statement.\n  throw new Error("Not implemented");\n}` }],
    testCases, solutions: [solution("BRUTE_FORCE"), solution("OPTIMAL")],
  });
}

export function generateProblems(input: GenerationOptions): ProblemSeed[] {
  const options = generationSchema.parse(input);
  const templates = options.template === "all" ? TEMPLATES : [findTemplate(options.template)];
  return problemBatchSchema.parse(templates.flatMap((t) => Array.from({ length: options.count }, (_, n) => generateProblem(t.id, options.seed + n))));
}

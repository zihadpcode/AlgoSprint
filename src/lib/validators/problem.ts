import { z } from "zod";
import { CATEGORIES, TAGS, INTERVIEW_STYLES, PATTERNS } from "@/data/seeds/taxonomy";

const text = z.string().trim().min(1).max(30_000);
const slug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const language = z.enum(["JAVASCRIPT", "TYPESCRIPT", "PYTHON", "JAVA", "CPP", "SQL"]);
const ordered = z.int().positive();
const uniqueList = (values: readonly (readonly [string, string])[]) =>
  z.array(slug.refine((value) => values.some(([key]) => key === value), "Unknown taxonomy slug"))
    .min(1).max(20).refine((items) => new Set(items).size === items.length, "Duplicate taxonomy slug");

export const problemSchema = z.strictObject({
  schemaVersion: z.literal(1),
  slug,
  title: z.string().trim().min(3).max(160),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  kind: z.literal("CODING"),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  pattern: z.enum(PATTERNS),
  statement: text,
  constraints: z.array(text).min(1).max(20),
  estimatedMinutes: z.int().min(1).max(240),
  timeLimitMs: z.int().min(100).max(30_000),
  memoryLimitKb: z.int().min(1024).max(1_048_576),
  categories: uniqueList(CATEGORIES),
  tags: uniqueList(TAGS),
  interviewStyles: uniqueList(INTERVIEW_STYLES),
  relatedSlugs: z.array(slug).max(20),
  examples: z.array(z.strictObject({ position: ordered, input: z.json(), output: z.json(), explanation: text })).min(2).max(20),
  hints: z.array(z.strictObject({ position: z.int().min(1).max(5), content: text })).length(5),
  starterCode: z.array(z.strictObject({ language, entryPoint: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), code: text })).min(1).max(6),
  testCases: z.array(z.strictObject({
    position: ordered, visibility: z.enum(["VISIBLE", "HIDDEN"]), input: z.json(), output: z.json(), explanation: text,
  })).min(4).max(200),
  solutions: z.array(z.strictObject({
    kind: z.enum(["BRUTE_FORCE", "BETTER", "OPTIMAL", "ALTERNATIVE"]), language,
    title: z.string().min(1).max(160), intuition: text, approach: text,
    pseudocode: text, code: text, timeComplexity: z.string().min(1).max(200), spaceComplexity: z.string().min(1).max(200),
    commonMistakes: z.array(text).min(1), interviewExplanation: text,
    steps: z.array(z.strictObject({ position: ordered, title: z.string().min(1).max(160), content: text })).min(2),
  })).min(2).max(12),
}).superRefine((p, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  for (const key of ["examples", "hints", "testCases"] as const) {
    const orderedPositions = p[key].map((item) => item.position).sort((a, b) => a - b);
    if (orderedPositions.some((position, i) => position !== i + 1)) issue([key], "Positions must be unique and consecutive from 1");
  }
  if (new Set(p.starterCode.map((s) => s.language)).size !== p.starterCode.length) issue(["starterCode"], "Duplicate language");
  if (new Set(p.solutions.map((s) => `${s.kind}:${s.language}`)).size !== p.solutions.length) issue(["solutions"], "Duplicate solution kind/language");
  for (const visibility of ["VISIBLE", "HIDDEN"] as const) {
    if (!p.testCases.some((t) => t.visibility === visibility)) issue(["testCases"], `At least one ${visibility} test is required`);
  }
  for (const kind of ["BRUTE_FORCE", "OPTIMAL"] as const) {
    if (!p.solutions.some((s) => s.kind === kind)) issue(["solutions"], `${kind} solution required`);
  }
  p.solutions.forEach((solution, i) => {
    const positions = solution.steps.map((s) => s.position).sort((a, b) => a - b);
    if (positions.some((position, index) => position !== index + 1)) issue(["solutions", i, "steps"], "Positions must be consecutive from 1");
    if (!p.starterCode.some((s) => s.language === solution.language)) issue(["solutions", i, "language"], "Solution language needs starter code");
  });
  if (new Set(p.relatedSlugs).size !== p.relatedSlugs.length || p.relatedSlugs.includes(p.slug)) issue(["relatedSlugs"], "Related problems must be unique and cannot reference self");
});

export const problemBatchSchema = z.array(problemSchema).min(1).max(1000).superRefine((problems, ctx) => {
  const seen = new Set<string>();
  for (const [index, problem] of problems.entries()) {
    if (seen.has(problem.slug)) ctx.addIssue({ code: "custom", path: [index, "slug"], message: "Duplicate problem slug" });
    seen.add(problem.slug);
  }
});

export type ProblemSeed = z.infer<typeof problemSchema>;

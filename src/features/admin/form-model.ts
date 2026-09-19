import { CATEGORIES, TAGS, INTERVIEW_STYLES, PATTERNS } from "@/data/seeds/taxonomy";

export type Field = { key: string; label: string; kind: "text" | "long" | "number" | "select" | "lines" | "choices" | "json" | "array"; options?: readonly (readonly [string, string])[]; fields?: Field[]; initial?: Record<string, unknown>; max?: number; fixed?: boolean };
const languages = ["JAVASCRIPT", "TYPESCRIPT", "PYTHON", "JAVA", "CPP", "SQL"].map((v) => [v, v] as const);
const options = (values: readonly string[]) => values.map((v) => [v, v] as const);
const example = { input: "{}", output: "null", explanation: "" };
const step = { title: "", content: "" };
const solution = { kind: "BRUTE_FORCE", language: "JAVASCRIPT", title: "", intuition: "", approach: "", pseudocode: "", code: "", timeComplexity: "", spaceComplexity: "", commonMistakes: "", interviewExplanation: "", steps: [{ ...step }, { ...step }] };
export const problemFields: Field[] = [
  { key: "slug", label: "Slug (permanent after creation)", kind: "text" }, { key: "title", label: "Title", kind: "text" },
  { key: "status", label: "Publication status", kind: "select", options: options(["DRAFT", "PUBLISHED", "ARCHIVED"]) },
  { key: "difficulty", label: "Difficulty", kind: "select", options: options(["EASY", "MEDIUM", "HARD"]) },
  { key: "pattern", label: "Pattern", kind: "select", options: options(PATTERNS) },
  { key: "statement", label: "Problem statement", kind: "long" }, { key: "constraints", label: "Constraints (one per line)", kind: "lines" },
  { key: "estimatedMinutes", label: "Estimated minutes", kind: "number" }, { key: "timeLimitMs", label: "Time limit (milliseconds)", kind: "number" }, { key: "memoryLimitKb", label: "Memory limit (KB)", kind: "number" },
  { key: "categories", label: "Categories", kind: "choices", options: CATEGORIES }, { key: "tags", label: "Tags", kind: "choices", options: TAGS },
  { key: "interviewStyles", label: "Interview styles", kind: "choices", options: INTERVIEW_STYLES }, { key: "relatedSlugs", label: "Related problem slugs (one per line)", kind: "lines" },
  { key: "examples", label: "Examples (at least two)", kind: "array", initial: example, max: 20, fields: [{ key: "input", label: "Input JSON", kind: "json" }, { key: "output", label: "Expected output JSON", kind: "json" }, { key: "explanation", label: "Explanation", kind: "long" }] },
  { key: "hints", label: "Progressive hints (exactly five)", kind: "array", initial: { content: "" }, max: 5, fixed: true, fields: [{ key: "content", label: "Hint", kind: "long" }] },
  { key: "starterCode", label: "Starter code", kind: "array", initial: { language: "JAVASCRIPT", entryPoint: "solve", code: "" }, max: 6, fields: [{ key: "language", label: "Language", kind: "select", options: languages }, { key: "entryPoint", label: "Entry function", kind: "text" }, { key: "code", label: "Starter code", kind: "long" }] },
  { key: "testCases", label: "Test cases (at least four, visible and hidden)", kind: "array", initial: { ...example, visibility: "HIDDEN" }, max: 200, fields: [{ key: "visibility", label: "Visibility", kind: "select", options: options(["VISIBLE", "HIDDEN"]) }, { key: "input", label: "Input JSON", kind: "json" }, { key: "output", label: "Expected output JSON", kind: "json" }, { key: "explanation", label: "Explanation", kind: "long" }] },
  { key: "solutions", label: "Solutions (brute force and optimal required)", kind: "array", initial: solution, max: 12, fields: [
    { key: "kind", label: "Approach kind", kind: "select", options: options(["BRUTE_FORCE", "BETTER", "OPTIMAL", "ALTERNATIVE"]) }, { key: "language", label: "Language", kind: "select", options: languages },
    ...["title", "intuition", "approach", "pseudocode", "code", "timeComplexity", "spaceComplexity", "interviewExplanation"].map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1"), kind: "long" as const })),
    { key: "commonMistakes", label: "Common mistakes (one per line)", kind: "lines" },
    { key: "steps", label: "Solution steps (at least two)", kind: "array", initial: step, max: 100, fields: [{ key: "title", label: "Step title", kind: "text" }, { key: "content", label: "Step explanation", kind: "long" }] },
  ] },
];
export const roadmapFields: Field[] = [
  { key: "slug", label: "Slug (permanent)", kind: "text" }, { key: "title", label: "Title", kind: "text" }, { key: "description", label: "Description", kind: "long" },
  { key: "difficulty", label: "Difficulty", kind: "select", options: options(["EASY", "MEDIUM", "HARD"]) }, { key: "estimatedMinutes", label: "Estimated minutes", kind: "number" },
  { key: "steps", label: "Ordered roadmap steps", kind: "array", initial: { problemSlug: "", title: "", description: "" }, max: 100, fields: [{ key: "problemSlug", label: "Existing problem slug", kind: "text" }, { key: "title", label: "Step title", kind: "text" }, { key: "description", label: "Step description", kind: "long" }] },
];
export function blankProblem() {
  return { schemaVersion: 1, kind: "CODING", slug: "", title: "", status: "DRAFT", difficulty: "EASY", pattern: PATTERNS[0], statement: "", constraints: "",
    estimatedMinutes: 20, timeLimitMs: 2000, memoryLimitKb: 262144, categories: [], tags: [], interviewStyles: ["general-software"], relatedSlugs: "",
    examples: [{ ...example }, { ...example }], hints: Array.from({ length: 5 }, () => ({ content: "" })),
    starterCode: [{ language: "JAVASCRIPT", entryPoint: "solve", code: "function solve(input) {\n  // Write your solution.\n}" }],
    testCases: Array.from({ length: 4 }, (_, i) => ({ ...example, visibility: i < 2 ? "VISIBLE" : "HIDDEN" })),
    solutions: [structuredClone(solution), { ...structuredClone(solution), kind: "OPTIMAL" }],
  };
}

export function toForm(content: Record<string, unknown>, fields: Field[]): Record<string, unknown> {
  const result = { ...content };
  for (const f of fields) {
    if (f.kind === "json") result[f.key] = JSON.stringify(content[f.key], null, 2);
    if (f.kind === "lines") result[f.key] = (content[f.key] as string[]).join("\n");
    if (f.kind === "array") result[f.key] = (content[f.key] as Record<string, unknown>[]).map((row) => toForm(row, f.fields!));
  }
  return result;
}
export function fromForm(content: Record<string, unknown>, fields: Field[], path = ""): Record<string, unknown> {
  const result = { ...content };
  for (const f of fields) {
    if (f.kind === "json") {
      try { result[f.key] = JSON.parse(String(content[f.key])); } catch { throw new Error(`Invalid JSON at ${path}${f.key}.`); }
    }
    if (f.kind === "lines") result[f.key] = String(content[f.key]).split("\n").map((x) => x.trim()).filter(Boolean);
    if (f.kind === "array") result[f.key] = (content[f.key] as Record<string, unknown>[]).map((row, i) => {
      const value = fromForm(row, f.fields!, `${path}${f.key}.${i + 1}.`);
      if (["examples", "hints", "testCases", "steps"].includes(f.key) && !Object.hasOwn(value, "problemSlug")) value.position = i + 1;
      return value;
    });
  }
  return result;
}

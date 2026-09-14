import { beforeAll, describe, expect, it } from "vitest";
import { Script } from "node:vm";
import { loadProblems } from "../scripts/lib/load-problems";
import { validateProblemSemantics } from "../scripts/lib/reference-problems";
import { problemBatchSchema, problemSchema, type ProblemSeed } from "@/lib/validators/problem";
import { canonicalJson, problemHash } from "../prisma/seed-data";

let problems: ProblemSeed[];
beforeAll(async () => { problems = await loadProblems(); });

describe("original seed contract", () => {
  it("has five fully validated problems and complete executable-language listings", () => {
    expect(problems).toHaveLength(5);
    for (const p of problems) {
      validateProblemSemantics(p);
      const entryPoint = p.starterCode[0].entryPoint;
      for (const item of [...p.starterCode, ...p.solutions]) {
        // Compile only to detect syntax errors. Never run strings from seed JSON.
        expect(() => new Script(item.code)).not.toThrow();
        expect(item.code).toContain(`function ${entryPoint}(`);
      }
    }
  });
  it("rejects a duplicate slug across files", () => {
    expect(() => problemBatchSchema.parse([problems[0], problems[0]])).toThrow(/Duplicate problem slug/);
  });
  it("rejects misspelled fields instead of silently dropping them", () => {
    expect(problemSchema.safeParse({ ...problems[0], difficultyLevel: "EASY" }).success).toBe(false);
  });
  it("rejects invalid taxonomy references and repeated tags", () => {
    expect(problemSchema.safeParse({ ...problems[0], categories: ["not-a-category"] }).success).toBe(false);
    expect(problemSchema.safeParse({ ...problems[0], tags: ["prefix-sum", "prefix-sum"] }).success).toBe(false);
  });
  it("requires both visibility groups and a full progressive hint sequence", () => {
    expect(problemSchema.safeParse({ ...problems[0], testCases: problems[0].testCases.map((t) => ({ ...t, visibility: "VISIBLE" })) }).success).toBe(false);
    expect(problemSchema.safeParse({ ...problems[0], hints: problems[0].hints.slice(1) }).success).toBe(false);
    expect(problemSchema.safeParse({ ...problems[0], hints: problems[0].hints.map((h) => ({ ...h, position: 1 })) }).success).toBe(false);
  });
  it("rejects self-related problems and duplicate solution variants", () => {
    expect(problemSchema.safeParse({ ...problems[0], relatedSlugs: [problems[0].slug] }).success).toBe(false);
    expect(problemSchema.safeParse({ ...problems[0], solutions: [...problems[0].solutions, problems[0].solutions[0]] }).success).toBe(false);
  });
  it("rejects incorrect expected outputs and malformed algorithm inputs", () => {
    const corrupted = structuredClone(problems.find((p) => p.slug === "relay-window")!);
    corrupted.testCases[0].output = 999;
    expect(() => validateProblemSemantics(corrupted)).toThrow(/incorrect expected output/);
    corrupted.testCases[0].input = { loads: [1], width: 2 };
    expect(() => validateProblemSemantics(corrupted)).toThrow(/Window must fit/);
  });
  it("hashes JSON consistently despite object key order, while detecting content changes", () => {
    expect(canonicalJson({ z: [3, 1], a: { d: 2, c: 1 } })).toBe(canonicalJson({ a: { c: 1, d: 2 }, z: [3, 1] }));
    expect(problemHash(problems[0])).not.toBe(problemHash({ ...problems[0], title: "A revised title" }));
  });
});

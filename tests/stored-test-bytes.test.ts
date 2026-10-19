import { beforeAll, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { problemSchema, problemBatchSchema, type ProblemSeed } from "@/lib/validators/problem";
import { parseAdminProblems } from "@/features/admin/contracts";
import { makeStdin, utf8ByteLength } from "@/features/submissions/serialization";
import { RUNNER_LIMITS } from "@/features/submissions/limits";
import { loadProblems } from "../scripts/lib/load-problems";
import { problemHash, seedProblems } from "../prisma/seed-data";

let problems: ProblemSeed[];
beforeAll(async () => { problems = await loadProblems(); });
const fixture = () => structuredClone(problems.find((problem) => problem.slug === "quiet-badge")!);
function sizedString(bytes: number, character = "a") {
  const width = utf8ByteLength(character);
  return character.repeat(Math.floor(bytes / width)) + "a".repeat(bytes % width);
}
function issues(problem: ProblemSeed) {
  const result = problemSchema.safeParse(problem);
  return result.success ? [] : result.error.issues;
}

it("accepts exactly 64000 positional-input UTF-8 bytes and rejects the next byte", () => {
  for (const character of ["a", "é", "😀"]) {
    const problem = fixture();
    // A one-argument string has four JSON wrapper bytes: ["..."]
    const badges = sizedString(RUNNER_LIMITS.maxInputBytes - 4, character);
    problem.testCases[0].input = { badges };
    expect(utf8ByteLength(makeStdin(problem.slug, problem.testCases[0].input))).toBe(RUNNER_LIMITS.maxInputBytes);
    expect(problemSchema.safeParse(problem).success).toBe(true);
    problem.testCases[0].input = { badges: badges + "a" };
    expect(issues(problem)).toEqual(expect.arrayContaining([expect.objectContaining({ path: ["testCases", 0, "input"], message: expect.stringContaining("64000 UTF-8 bytes") })]));
  }
});

it("measures positional JSON, including escaping, rather than the raw object's size or key order", () => {
  const problem = fixture();
  const badges = "a".repeat(RUNNER_LIMITS.maxInputBytes - 4);
  problem.testCases[0].input = { unused: "x".repeat(80_000), badges };
  expect(utf8ByteLength(JSON.stringify(problem.testCases[0].input))).toBeGreaterThan(RUNNER_LIMITS.maxInputBytes);
  expect(problemSchema.safeParse(problem).success).toBe(true);
  problem.testCases[0].input = { badges: "\n".repeat((RUNNER_LIMITS.maxInputBytes - 4) / 2) };
  expect(problemSchema.safeParse(problem).success).toBe(true);
  problem.testCases[0].input = { badges: "\n".repeat((RUNNER_LIMITS.maxInputBytes - 4) / 2) + "a" };
  expect(issues(problem).some((issue) => issue.path.join(".") === "testCases.0.input")).toBe(true);
  problem.testCases[0].input = { unused: badges };
  expect(issues(problem).some((issue) => issue.path.join(".") === "testCases.0.input")).toBe(true);
});

it("bounds compact expected JSON by UTF-8 bytes, inclusively, for visible and hidden tests", () => {
  for (const character of ["a", "é", "😀"]) {
    const problem = fixture();
    const expected = sizedString(RUNNER_LIMITS.maxOutputBytes - 2, character);
    expect(utf8ByteLength(JSON.stringify(expected))).toBe(RUNNER_LIMITS.maxOutputBytes);
    const hidden = problem.testCases.findIndex((test) => test.visibility === "HIDDEN");
    for (const index of [0, hidden]) {
      problem.testCases[index].output = expected;
      expect(problemSchema.safeParse(problem).success).toBe(true);
      problem.testCases[index].output = expected + "a";
      expect(issues(problem)).toEqual(expect.arrayContaining([expect.objectContaining({ path: ["testCases", index, "output"], message: expect.stringContaining("262144 UTF-8 bytes") })]));
      problem.testCases[index].output = 0;
    }
  }
});

it("counts JSON wrappers and escaped controls in expected objects and arrays", () => {
  const problem = fixture();
  problem.testCases[0].output = { value: ["\n".repeat(RUNNER_LIMITS.maxOutputBytes / 2)] };
  expect(issues(problem).some((issue) => issue.path.join(".") === "testCases.0.output")).toBe(true);
  for (const output of [null, false, 0, [], {}]) {
    problem.testCases[0].output = output;
    expect(problemSchema.safeParse(problem).success).toBe(true);
  }
});

it("also protects browser examples, while leaving custom study-only schemas flexible", () => {
  const problem = fixture();
  problem.examples[1].input = { badges: "😀".repeat(16_000) };
  problem.examples[1].output = "a".repeat(RUNNER_LIMITS.maxOutputBytes);
  expect(issues(problem).map((issue) => issue.path)).toEqual(expect.arrayContaining([["examples", 1, "input"], ["examples", 1, "output"]]));
  problem.slug = "custom-study-only";
  expect(problemSchema.safeParse(problem).success).toBe(true);
});

it("rejects oversized executable content in admin create/edit/import parsing for every publication state", () => {
  for (const status of ["DRAFT", "PUBLISHED", "ARCHIVED"] as const) {
    for (const field of ["input", "output"] as const) {
      const problem = fixture(); problem.status = status;
      if (field === "input") problem.testCases[0].input = { badges: "😀".repeat(16_000) };
      else problem.testCases[0].output = "a".repeat(RUNNER_LIMITS.maxOutputBytes - 1);
      const error = field === "input" ? /64000 UTF-8 bytes/ : /262144 UTF-8 bytes/;
      expect(() => parseAdminProblems(JSON.stringify(problem), false)).toThrow(error);
      expect(() => parseAdminProblems(JSON.stringify([fixture(), problem]), true)).toThrow(error);
    }
  }
});

it("rejects a direct seed batch before any database query or transaction", async () => {
  const problem = fixture();
  problem.testCases[0].output = "a".repeat(RUNNER_LIMITS.maxOutputBytes - 1);
  const query = vi.fn(); const transaction = vi.fn();
  const db = { problem: { findMany: query }, $transaction: transaction } as unknown as PrismaClient;
  await expect(seedProblems(db, [problems[0], problem])).rejects.toThrow(/262144 UTF-8 bytes/);
  expect(query).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled();
});

it("keeps all 100 current fixtures and their content hashes unchanged", () => {
  expect(problems).toHaveLength(100);
  const before = problems.map(problemHash);
  const parsed = problemBatchSchema.parse(problems);
  expect(parsed).toEqual(problems);
  expect(parsed.map(problemHash)).toEqual(before);
  for (const problem of parsed) {
    for (const test of [...problem.examples, ...problem.testCases]) {
      expect(utf8ByteLength(makeStdin(problem.slug, test.input))).toBeLessThanOrEqual(RUNNER_LIMITS.maxInputBytes);
      expect(utf8ByteLength(JSON.stringify(test.output))).toBeLessThanOrEqual(RUNNER_LIMITS.maxOutputBytes);
    }
  }
});

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { loadProblems } from "../scripts/lib/load-problems";
import { buildPythonSolutions, loadPythonSolutions, PYTHON_SOLUTION_FILES, pythonSolutionEntriesSchema, selectPythonSolutions } from "../scripts/lib/python-solutions";
import { SIGNATURES } from "../src/features/submissions/signatures";
import { pythonEntryPoint, toSnakeCase } from "../src/features/submissions/python-names";
import { pythonSolutionRolloutSql } from "../scripts/lib/python-solution-rollout";

const translations = async () => (await Promise.all(PYTHON_SOLUTION_FILES.map(async (file) =>
  JSON.parse(await readFile(`src/data/seeds/languages/${file}`, "utf8")) as unknown[]))).flat();

it("provides Python parity for every published JavaScript approach without changing the original seed content", async () => {
  const problems = await loadProblems();
  const before = JSON.stringify(problems);
  const entries = buildPythonSolutions(problems, await translations());
  expect(new Set(entries.map((entry) => entry.slug)).size).toBe(problems.length);
  expect(entries).toHaveLength(problems.reduce((n, problem) => n + problem.solutions.filter((s) => s.language === "JAVASCRIPT").length, 0));
  expect(entries.every((entry) => entry.solution.language === "PYTHON")).toBe(true);
  expect(JSON.stringify(problems)).toBe(before);
  expect(selectPythonSolutions(entries, ["relay-window"])).toHaveLength(2);
  expect(() => selectPythonSolutions(entries, ["missing-problem"])).toThrow("No Python solutions");
});

it("rejects missing problems, missing approaches, duplicates, bad signatures and unknown editorial fields", async () => {
  const problems = await loadProblems();
  const groups = await translations() as { slug: string; solutions: { kind: string; code: string }[] }[];
  expect(() => buildPythonSolutions(problems, groups.slice(1))).toThrow("Missing Python solutions");
  expect(() => buildPythonSolutions(problems, [...groups, groups[0]])).toThrow("Duplicate Python solution problem");
  const changed = structuredClone(groups);
  changed[0].solutions.pop();
  expect(() => buildPythonSolutions(problems, changed)).toThrow("approach coverage");
  const wrong = structuredClone(groups);
  wrong[0].solutions[0].code = "def wrong():\n    return 0";
  expect(() => buildPythonSolutions(problems, wrong)).toThrow("entry point");
  expect(() => buildPythonSolutions(problems, [{ ...groups[0], unsafe: true }, ...groups.slice(1)])).toThrow();
});

it("rejects unsafe rollout delimiters and invalid baseline values before producing SQL", async () => {
  const [entry] = await loadPythonSolutions();
  for (const delimiter of ["$python_solutions$", "$rollout$"]) {
    expect(() => pythonSolutionRolloutSql([{ ...entry, solution: { ...entry.solution, code: entry.solution.code + "\n# " + delimiter } }], "a".repeat(32))).toThrow("delimiter collision");
  }
  expect(() => pythonSolutionRolloutSql([entry], "not-a-fingerprint")).toThrow("baseline");
  expect(() => pythonSolutionEntriesSchema.parse([{ ...entry, solution: { ...entry.solution, steps: [...entry.solution.steps].reverse() } }])).toThrow("Step positions");
});

it("compiles every Python editorial and checks its real signature and stored-case results", async () => {
  const problems = await loadProblems();
  const bySlug = new Map(problems.map((problem) => [problem.slug, problem]));
  const entries = await loadPythonSolutions();
  const jobs = entries.map(({ slug, solution }) => {
    const signature = SIGNATURES[slug];
    const problem = bySlug.get(slug)!;
    return { slug, kind: solution.kind, code: solution.code,
      entryPoint: pythonEntryPoint(signature.entryPoint), parameters: signature.keys.map(toSnakeCase),
      cases: [...problem.examples, ...problem.testCases].map((test) => ({
        args: signature.keys.map((key) => (test.input as Record<string, unknown>)[key]), expected: test.output,
      })) };
  });
  // Fixed checked-in reference code only. The application never runs learner code on the host.
  const result = spawnSync("python3", ["-I", "scripts/lib/check-python-solutions.py"], {
    input: JSON.stringify(jobs), encoding: "utf8", timeout: 180_000, maxBuffer: 2_000_000,
  });
  expect(result.error, result.stderr).toBeUndefined();
  const report = JSON.parse(result.stdout) as { solutions: number; checkedCases: number; failures: unknown[] };
  expect(report.failures, JSON.stringify(report.failures)).toEqual([]);
  expect(result.status, result.stderr).toBe(0);
  expect(report.solutions).toBe(entries.length);
  expect(report.checkedCases).toBeGreaterThan(entries.length * 2);
  console.info(`Python editorials: ${report.solutions} approaches, ${report.checkedCases} passing stored-case checks.`);
}, 200_000);

import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { executeSandbox } from "@/features/submissions/sandbox";
import { makeProgram, makeStdin } from "@/features/submissions/harness";
import type { ProblemSeed } from "@/lib/validators/problem";

// Publication gate: every authored solution of every published seed runs on all of its tests in the same QuickJS
// sandbox and harness that verified submissions use. Optimal, better and alternative solutions must be ACCEPTED
// everywhere; a brute-force solution may exceed the time limit on large cases (that is its lesson) but must never
// produce a wrong answer or crash. The untouched starter code must not be accepted.
const root = join(process.cwd(), "src/data/seeds/problems");
const problems = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".json")).sort()
  .map((file) => JSON.parse(readFileSync(join(root, file), "utf8")) as ProblemSeed);

describe("authored solutions pass the QuickJS sandbox", () => {
  for (const problem of problems) {
    it(problem.slug, async () => {
      const starter = problem.starterCode.find((s) => s.language === "JAVASCRIPT")!;
      const cases = problem.testCases.map((t) => ({ stdin: makeStdin(problem.slug, t.input), expected: t.output }));
      const limits = { timeMs: problem.timeLimitMs, memoryKb: problem.memoryLimitKb };
      for (const solution of problem.solutions.filter((s) => s.language === "JAVASCRIPT")) {
        const outcomes = await executeSandbox(makeProgram(problem.slug, starter.entryPoint, solution.code), cases, limits);
        const allowed = solution.kind === "BRUTE_FORCE" ? ["ACCEPTED", "TIME_LIMIT"] : ["ACCEPTED"];
        const statuses = outcomes.map((o) => (allowed.includes(o.status) ? "ok" : o.status));
        expect(statuses, `${solution.kind}: ${outcomes.map((o) => o.diagnostic).join(" ").slice(0, 400)}`).toEqual(cases.map(() => "ok"));
        expect(outcomes.some((o) => o.status === "ACCEPTED"), `${solution.kind} accepts no case`).toBe(true);
      }
      const unsolved = await executeSandbox(makeProgram(problem.slug, starter.entryPoint, starter.code), cases.slice(0, 1), limits);
      expect(unsolved[0].status).not.toBe("ACCEPTED");
    }, 60_000);
  }
});

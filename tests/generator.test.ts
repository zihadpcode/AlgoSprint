import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "node:vm";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { checkedOutput, generateProblem, generateProblems } from "../scripts/generator/generate";
import { generatedFiles, writeGeneratedFiles } from "../scripts/generator/files";
import { createRandom } from "../scripts/generator/random";
import { TEMPLATES, templateForSlug } from "../scripts/generator/registry";
import { referenceResult, validateProblemSemantics } from "../scripts/lib/reference-problems";
import { loadProblems } from "../scripts/lib/load-problems";
import { parseAdminProblems } from "@/features/admin/contracts";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function temporary() { const root = await mkdtemp(join(tmpdir(), "algosprint-generator-")); roots.push(root); return root; }

describe("original deterministic problem generation", () => {
  it("reproduces the checked-in fixtures exactly and keeps them outside default seeds", async () => {
    expect(await writeGeneratedFiles("src/data/seeds/generated", { seed: 1401 }, true)).toBe(5);
    expect((await loadProblems()).map((p) => p.slug).some((slug) => slug.startsWith("gen-"))).toBe(false);
    expect(await loadProblems("src/data/seeds/generated")).toHaveLength(5);
  });
  it("produces valid draft objects that can pass the existing administrator import boundary", () => {
    const problems = generateProblems({ seed: 1401 });
    expect(new Set(problems.map((p) => p.pattern)).size).toBe(5);
    expect(parseAdminProblems(JSON.stringify(problems), true)).toEqual(problems);
    for (const p of problems) {
      expect(p.status).toBe("DRAFT"); expect(p.hints).toHaveLength(5);
      validateProblemSemantics(p);
      for (const item of [...p.starterCode, ...p.solutions]) {
        expect(() => new Script(item.code)).not.toThrow();
        expect(item.code).toContain(`function ${p.starterCode[0].entryPoint}(`);
        expect(item.code).not.toMatch(/__name|\[native code\]/);
      }
    }
  });
  it("authored static solution listings agree with their trusted functions", () => {
    // Execute only checked-in template literals here, never imported/generated JSON code.
    for (const template of TEMPLATES) {
      const random = createRandom(17);
      const inputs = [...template.edges, ...Array.from({ length: 12 }, () => template.random(random))];
      for (const strategy of ["brute", "optimal"] as const) {
        const code = strategy === "brute" ? template.bruteCode : template.optimalCode;
        const name = /^function ([^(]+)/.exec(code)![1];
        const script = new Script(`${code}; ${name}(input)`);
        for (const input of inputs) {
          const actual = script.runInNewContext({ input: structuredClone(input) }, { timeout: 1000 });
          expect(JSON.stringify(actual)).toBe(JSON.stringify(template.evaluate(input, strategy)));
        }
      }
    }
  });
  it("uses isolated repeatable streams and varies stored cases across seeds", () => {
    const a = createRandom(0), b = createRandom(0);
    expect(Array.from({ length: 20 }, () => a.int(-20, 20))).toEqual(Array.from({ length: 20 }, () => b.int(-20, 20)));
    const before = generatedFiles({ seed: 42 });
    generateProblems({ seed: 9 });
    expect(generatedFiles({ seed: 42 })).toEqual(before);
    for (const t of TEMPLATES) expect(generateProblem(t.id, 42).testCases).not.toEqual(generateProblem(t.id, 43).testCases);
  });
  it("differentially checks all five patterns for boundary seeds and randomized inputs", () => {
    for (const seed of [0, 1, 1401, 0xffffffff]) {
      for (const p of generateProblems({ seed })) validateProblemSemantics(p);
    }
  });
  it("has independently known answers for equality, empty inputs, duplicates and greedy traps", () => {
    const cases: [string, unknown, number | number[]][] = [
      ["supply-pairs", { weights: [2, 2, 2], budget: 4 }, 3],
      ["supply-pairs", { weights: [], budget: 0 }, 0],
      ["signal-burst", { readings: [4, -1, 6, 5], width: 2, threshold: 4 }, 2],
      ["signal-burst", { readings: [2, 2, 1], width: 3, threshold: 2 }, 2],
      ["reservoir-spans", { changes: [5, -3, 2], spans: [[0, 3], [1, 2], [2, 2]] }, [4, -3, 0]],
      ["reservoir-spans", { changes: [], spans: [] }, []],
      ["tide-marker", { marks: [1, 3, 3, 7], level: 3 }, 3],
      ["tide-marker", { marks: [2, 2], level: 2 }, -1],
      ["workshop-credits", { credits: [5, 9, 5] }, 10],
      ["workshop-credits", { credits: [] }, 0],
    ];
    for (const [id, input, output] of cases) {
      const t = TEMPLATES.find((t) => t.id === id)!;
      expect(t.evaluate(input, "brute")).toEqual(output);
      expect(t.evaluate(input, "optimal")).toEqual(output);
    }
  });
  it("rejects invalid options and prevents seed overflow or unknown versions", () => {
    for (const options of [{ seed: -1 }, { seed: 1.5 }, { seed: 0, count: 11 }, { seed: 0, count: 0 }, { seed: 0xffffffff, count: 2 }, { seed: 0, template: "missing" }]) {
      expect(() => generateProblems(options)).toThrow();
    }
    expect(() => generateProblem("supply-pairs", 0x100000000)).toThrow();
    expect(templateForSlug("gen-v2-supply-pairs-1")).toBeUndefined();
    expect(templateForSlug("gen-v1-supply-pairs-4294967296")).toBeUndefined();
    expect(templateForSlug("gen-v1-supply-pairs-01")).toBeUndefined();
    expect(() => referenceResult("gen-v1-untrusted-1", {})).toThrow(/No trusted/);
    expect(() => createRandom(1).int(9, 2)).toThrow();
  });
  it("bounds brute-force work and rejects malformed algorithm inputs", () => {
    for (const [id, input] of [
      ["workshop-credits", { credits: Array(15).fill(1) }],
      ["supply-pairs", { weights: [2, 1], budget: 4 }],
      ["signal-burst", { readings: [1], width: 2, threshold: 0 }],
      ["reservoir-spans", { changes: [1], spans: [[0, 2]] }],
      ["tide-marker", { marks: [2, 1], level: 0 }],
    ] as const) expect(() => referenceResult(`gen-v1-${id}-1`, input)).toThrow();
  });
  it("rejects corrupted expected values and aborts reference disagreements", () => {
    const p = generateProblem("workshop-credits", 1); p.testCases[0].output = 9;
    expect(() => validateProblemSemantics(p)).toThrow(/incorrect expected/);
    const t = { ...TEMPLATES[0], evaluate: (_input: unknown, strategy: "brute" | "optimal") => strategy === "brute" ? 1 : 2 };
    expect(() => checkedOutput(t, {})).toThrow(/disagreement/);
  });
  it("supports selected templates and consecutive seeds without duplicate slugs", () => {
    const problems = generateProblems({ seed: 12, count: 3, template: "tide-marker" });
    expect(problems.map((p) => p.slug)).toEqual([12, 13, 14].map((n) => `gen-v1-tide-marker-${n}`));
  });
  it("writes complete batches, refuses overwrite, detects drift and preserves edited files", async () => {
    const root = await temporary(), directory = join(root, "output");
    expect(await writeGeneratedFiles(directory, { seed: 1 })).toBe(5);
    expect(await writeGeneratedFiles(directory, { seed: 1 }, true)).toBe(5);
    const name = "gen-v1-supply-pairs-1.json";
    await writeFile(join(directory, name), "editor changes\n");
    await expect(writeGeneratedFiles(directory, { seed: 1 }, true)).rejects.toThrow(/differs/);
    await expect(writeGeneratedFiles(directory, { seed: 2 })).rejects.toThrow(/already exists/);
    expect(await readFile(join(directory, name), "utf8")).toBe("editor changes\n");
    await writeFile(join(directory, "extra.json"), "{}");
    await expect(writeGeneratedFiles(directory, { seed: 1 }, true)).rejects.toThrow(/file set differs/);
    expect(await readdir(root)).toEqual(["output"]);
  });
  it("leaves no output for invalid batches and only one concurrent writer succeeds", async () => {
    const root = await temporary(), directory = join(root, "output");
    await expect(writeGeneratedFiles(directory, { seed: -1 })).rejects.toThrow();
    expect(await readdir(root)).toEqual([]);
    const results = await Promise.allSettled([writeGeneratedFiles(directory, { seed: 2 }), writeGeneratedFiles(directory, { seed: 2 })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await writeGeneratedFiles(directory, { seed: 2 }, true)).toBe(5);
    expect(await readdir(root)).toEqual(["output"]);
  });
  it("the CLI rejects unexpected flags, fractional seeds and invalid counts without files", async () => {
    const root = await temporary();
    for (const args of [["--seed", "1.5"], ["--count", "0"], ["--publish"], ["--seed", ""], ["--template", "unknown"]]) {
      expect(() => execFileSync(process.execPath, ["--import", "tsx", "scripts/generate-problems.ts", "--out", join(root, "new"), ...args], { stdio: "pipe" })).toThrow();
    }
    expect(await readdir(root)).toEqual([]);
  });
});

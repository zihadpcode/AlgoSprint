import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { executeSandbox, SANDBOX_LIMITS } from "@/features/submissions/sandbox";
import { makeProgram } from "@/features/submissions/harness";
import type { ProblemSeed } from "@/lib/validators/problem";
import { BATCH6 } from "../scripts/lib/reference-batch6";
import { seededRng } from "../scripts/lib/reference-expansion";
import { libraryResult } from "../scripts/lib/reference-library";
import { SIGNATURES } from "@/features/submissions/signatures";

// Library batch 6: every reference must agree with its independent brute-force baseline on seeded random inputs, and the
// strict input schemas must reject malformed or adversarial input before any reference runs.
const TRIALS = 600;

describe("library batch 6 references", () => {
  it("covers exactly the thirteen batch 6 slugs, each with a runner signature", () => {
    expect(Object.keys(BATCH6)).toHaveLength(13);
    for (const slug of Object.keys(BATCH6)) expect(SIGNATURES[slug], slug).toBeDefined();
  });
  for (const [slug, item] of Object.entries(BATCH6)) {
    it(`${slug}: optimal reference matches the brute-force baseline on ${TRIALS} seeded inputs`, () => {
      const rng = seededRng(slug.length * 104_729 + 31);
      const signature = SIGNATURES[slug];
      for (let trial = 0; trial < TRIALS; trial++) {
        const input = item.input.parse(item.sample(rng)) as Record<string, unknown>;
        const args = signature.keys.map((key) => input[key]) as never[];
        expect(item.solve(...args), JSON.stringify(input)).toEqual(item.brute(...args));
        expect(libraryResult(slug, input)).toEqual(item.solve(...args));
      }
    });
    it(`${slug}: the sampler is deterministic for a seed`, () => {
      const first = Array.from({ length: 20 }, ((rng) => () => item.sample(rng))(seededRng(7)));
      const second = Array.from({ length: 20 }, ((rng) => () => item.sample(rng))(seededRng(7)));
      expect(second).toEqual(first);
    });
  }

  it("samplers exercise every kind of answer, not just the easy ones", () => {
    const seen = (slug: string, pick: (output: unknown) => string) => {
      const rng = seededRng(99), item = BATCH6[slug], kinds = new Set<string>();
      for (let i = 0; i < TRIALS; i++) {
        const input = item.sample(rng);
        kinds.add(pick(item.solve(...(SIGNATURES[slug].keys.map((k) => input[k]) as never[]))));
      }
      return kinds;
    };
    expect(seen("rival-teams", String)).toEqual(new Set(["true", "false"]));
    expect(seen("merge-point", (v) => ((v as number) === -1 ? "none" : "joined"))).toEqual(new Set(["none", "joined"]));
    expect(seen("elevation-ledger", (v) => [...new Set(v as string[])].sort().join("|")).has("conflict|known|new")).toBe(true);
    expect(seen("parallel-stages", (v) => ((v as number) === -1 ? "cycle" : "ok"))).toEqual(new Set(["cycle", "ok"]));
    expect(seen("crew-cover", (v) => ((v as number) === -1 ? "impossible" : "covered"))).toEqual(new Set(["impossible", "covered"]));
    expect(seen("grove-harvest", (v) => ((v as number) === 0 ? "zero" : "positive")).has("positive")).toBe(true);
    expect(seen("suffix-alarm", (v) => ((v as boolean[]).some(Boolean) ? "alarm" : "quiet"))).toEqual(new Set(["alarm", "quiet"]));
  });
});

describe("exhaustive and edge checks", () => {
  it("switch-gap agrees with its baseline on every mask below 8192 and the 31-bit endpoints", () => {
    const item = BATCH6["switch-gap"];
    for (let mask = 0; mask < 8192; mask++) expect(item.solve(mask as never), String(mask)).toBe(item.brute(mask as never));
    for (const mask of [2 ** 31 - 1, 2 ** 30, 2 ** 30 + 1, 2 ** 30 + 2 ** 15]) expect(item.solve(mask as never)).toBe(item.brute(mask as never));
    expect(libraryResult("switch-gap", { mask: 2 ** 30 + 1 })).toBe(30);
  });
  it("digit-power handles a 2000-digit exponent exactly", () => {
    // 7^e mod 1000: the powers of 7 repeat with period 20 modulo 1000, and the exponent below is divisible by 20.
    expect(libraryResult("digit-power", { base: 7, digits: [1, ...Array<number>(1999).fill(0)], modulus: 1000 })).toBe(1);
    expect(libraryResult("digit-power", { base: 10, digits: [1, 0], modulus: 1_000_000 })).toBe(0);
    expect(libraryResult("digit-power", { base: 1_000_000_000, digits: [9], modulus: 999_983 })).toBe(Number((BigInt(1_000_000_000) ** BigInt(9)) % BigInt(999_983)));
  });
  it("grove-harvest survives a 5000-node degenerate tree without recursion", () => {
    const chain: (number | null)[] = [];
    for (let i = 1; i <= 4999; i++) { chain.push(i); if (i < 4999) chain.push(null); }
    expect(chain.length).toBeLessThanOrEqual(10_000);
    expect(libraryResult("grove-harvest", { tree: chain })).toBe((4999 * 5000) / 2);
  });
  it("elevation-ledger keeps long chains consistent", () => {
    const statements: [number, number, number][] = Array.from({ length: 4999 }, (_, i) => [i, i + 1, 1]);
    statements.push([0, 4999, 4999], [4999, 0, -4999], [0, 4999, 1]);
    const result = libraryResult("elevation-ledger", { benchmarks: 5000, statements }) as string[];
    expect(result.slice(0, 4999).every((r) => r === "new")).toBe(true);
    expect(result.slice(4999)).toEqual(["known", "known", "conflict"]);
  });
});

// The sandbox returns at most SANDBOX_LIMITS.outputBytes of stdout, and the harness writes JSON.stringify(result). A
// constraint-valid input must never make a correct solution fail with "Output exceeds the sandbox limit".
describe("batch 6 worst-case output stays under the sandbox output cap", () => {
  const cap = SANDBOX_LIMITS.outputBytes;
  const ascending = (n: number) => Array.from({ length: n }, (_, i) => i);
  const chainTree = (n: number) => { const t: (number | null)[] = []; for (let i = 1; i <= n; i++) { t.push(i); if (i < n) t.push(null); } return t; };
  const worst: Record<string, Record<string, unknown>> = {
    "switch-gap": { mask: 2 ** 31 - 1 },
    "merge-point": { next: ascending(10_000).map((i) => i - 1), headA: 9_999, headB: 9_999 },
    // One write, then 9,999 reads of the newest reading at its widest ("-1000000" is 8 characters).
    "sensor-ring": { capacity: 1000, operations: [["write", -1_000_000], ...Array.from({ length: 9_999 }, () => ["newest"])] },
    "rival-teams": { campers: 10_000, rivalries: [] },
    "parallel-stages": { tasks: 5000, prerequisites: ascending(4999).map((i) => [i, i + 1]) },
    "laser-shots": { panels: Array.from({ length: 10_000 }, (_, i) => [i, i]) },
    "exact-flags": { readings: new Array(10_000).fill(1), k: 5000 },
    "digit-power": { base: 999_999, digits: new Array(2000).fill(9), modulus: 999_983 },
    // One 10-letter server, then routes: every answer is a 10-letter name (13 bytes with quotes and comma).
    "ring-router": { operations: [["add", "abcdefghij", 5], ...Array.from({ length: 5_999 }, () => ["route", 1_000_000_000])] },
    // One accepted statement, then 6,999 conflicts: "conflict" is the longest answer (11 bytes with quotes and comma).
    "elevation-ledger": { benchmarks: 2, statements: [[0, 1, 0], ...Array.from({ length: 6_999 }, () => [0, 1, 1])] },
    "suffix-alarm": { words: new Array(1000).fill("a".repeat(20)), stream: "b".repeat(10_000) },
    "grove-harvest": { tree: chainTree(5000) },
    "crew-cover": { skills: 16, volunteers: new Array(60).fill(43_690) },
  };
  const outputSize = (slug: string) => {
    const input = BATCH6[slug].input.parse(worst[slug]) as Record<string, unknown>;
    return JSON.stringify(libraryResult(slug, input)).length;
  };
  it("has a worst-case input for every batch 6 slug", () => {
    expect(Object.keys(worst).sort()).toEqual(Object.keys(BATCH6).sort());
  });
  for (const slug of Object.keys(BATCH6)) {
    it(`${slug}: the worst-case result fits in the ${cap}-byte cap`, () => {
      expect(outputSize(slug)).toBeLessThan(cap);
    });
  }
  it("keeps a real margin for the two problems whose caps were lowered", () => {
    expect(outputSize("elevation-ledger")).toBeLessThan(cap * 0.9);
    expect(outputSize("ring-router")).toBeLessThan(cap * 0.9);
  });
  it("the previous authoring caps exceeded the former 90,000-byte budget", () => {
    const formerOutputBudget = 90_000;
    const ledger = JSON.stringify(Array.from({ length: 12_000 }, () => "conflict")).length;
    const router = 300 * 5 + 9_700 * 13;
    expect(ledger).toBeGreaterThan(formerOutputBudget);
    expect(router).toBeGreaterThan(formerOutputBudget);
    expect(ledger).toBeLessThanOrEqual(cap);
    expect(router).toBeLessThanOrEqual(cap);
  });
  // Synthetic output-only probes use the real QuickJS harness directly. Some exceed the stdin budget; they are not stored
  // fixtures and are not reachable through a learner custom-input mode. Shared seed validation checks stored fixtures.
  for (const slug of ["elevation-ledger", "ring-router", "sensor-ring", "suffix-alarm"]) {
    it(`${slug}: the optimal solution returns the worst case through the real sandbox`, async () => {
      const seed = JSON.parse(readFileSync(join(process.cwd(), "src/data/seeds/problems/library", `${slug}.json`), "utf8")) as ProblemSeed;
      const optimal = seed.solutions.find((solution) => solution.kind === "OPTIMAL" && solution.language === "JAVASCRIPT")!;
      const starter = seed.starterCode.find((code) => code.language === "JAVASCRIPT")!;
      const input = BATCH6[slug].input.parse(worst[slug]) as Record<string, unknown>;
      const stdin = JSON.stringify(SIGNATURES[slug].keys.map((key) => input[key]));
      const expected = libraryResult(slug, input);
      const [outcome] = await executeSandbox(makeProgram(slug, starter.entryPoint, optimal.code), [{ stdin, expected }], { timeMs: seed.timeLimitMs, memoryKb: seed.memoryLimitKb });
      expect(outcome.status, outcome.diagnostic ?? "").toBe("ACCEPTED");
    }, 60_000);
  }
});

describe("batch 6 input boundaries", () => {
  const rejects = (slug: string, input: unknown, message?: RegExp) => expect(() => libraryResult(slug, input), `${slug} ${JSON.stringify(input).slice(0, 80)}`).toThrow(message);
  const chain = (n: number) => { const t: (number | null)[] = []; for (let i = 1; i <= n; i++) { t.push(i); if (i < n) t.push(null); } return t; };

  it("switch-gap rejects out-of-range, fractional, string and extra-key input", () => {
    for (const mask of [-1, 2 ** 31, 1.5, "7", null]) rejects("switch-gap", { mask });
    rejects("switch-gap", { mask: 1, extra: true });
    rejects("switch-gap", {});
  });
  it("merge-point rejects loops, bad indexes and bad heads", () => {
    rejects("merge-point", { next: [1, 0], headA: 0, headB: 1 }, /loop/);
    rejects("merge-point", { next: [0], headA: 0, headB: 0 }, /loop/);
    rejects("merge-point", { next: [1, 2, 1], headA: 0, headB: 0 }, /loop/);
    rejects("merge-point", { next: [5, -1], headA: 0, headB: 1 }, /valid stop/);
    rejects("merge-point", { next: [-2, -1], headA: 0, headB: 1 });
    rejects("merge-point", { next: [-1, -1], headA: 2, headB: 0 }, /valid stop/);
    rejects("merge-point", { next: [], headA: 0, headB: 0 });
    rejects("merge-point", { next: [-1], headA: 0, headB: -1 });
  });
  it("sensor-ring rejects bad capacities and malformed operations", () => {
    rejects("sensor-ring", { capacity: 0, operations: [] });
    rejects("sensor-ring", { capacity: 1001, operations: [] });
    rejects("sensor-ring", { capacity: 2, operations: [["write"]] });
    rejects("sensor-ring", { capacity: 2, operations: [["read", 1]] });
    rejects("sensor-ring", { capacity: 2, operations: [["peek"]] });
    rejects("sensor-ring", { capacity: 2, operations: [["write", 1_000_001]] });
    rejects("sensor-ring", { capacity: 2, operations: [["write", 1.5]] });
    rejects("sensor-ring", { capacity: 2, operations: new Array(10_001).fill(["size"]) });
  });
  it("rival-teams rejects self rivalries, unknown campers and empty camps", () => {
    rejects("rival-teams", { campers: 3, rivalries: [[1, 1]] }, /different existing/);
    rejects("rival-teams", { campers: 3, rivalries: [[0, 3]] }, /different existing/);
    rejects("rival-teams", { campers: 0, rivalries: [] });
    rejects("rival-teams", { campers: 3, rivalries: [[0, 1, 2]] });
    rejects("rival-teams", { campers: 3, rivalries: [[-1, 1]] });
  });
  it("parallel-stages rejects self prerequisites and unknown tasks", () => {
    rejects("parallel-stages", { tasks: 3, prerequisites: [[2, 2]] }, /different existing/);
    rejects("parallel-stages", { tasks: 3, prerequisites: [[0, 3]] }, /different existing/);
    rejects("parallel-stages", { tasks: 0, prerequisites: [] });
    rejects("parallel-stages", { tasks: 5001, prerequisites: [] });
  });
  it("laser-shots rejects reversed, out-of-range and malformed panels", () => {
    rejects("laser-shots", { panels: [[3, 2]] }, /not end before/);
    rejects("laser-shots", { panels: [[0, 1_000_001]] });
    rejects("laser-shots", { panels: [[1, 2, 3]] });
    rejects("laser-shots", { panels: [[1.5, 2]] });
  });
  it("exact-flags rejects a negative k, empty readings and non-integers", () => {
    rejects("exact-flags", { readings: [1], k: -1 });
    rejects("exact-flags", { readings: [], k: 0 });
    rejects("exact-flags", { readings: [1.5], k: 0 });
    rejects("exact-flags", { readings: [1_000_001], k: 0 });
  });
  it("digit-power rejects leading zeros, bad digits and out-of-range moduli", () => {
    rejects("digit-power", { base: 2, digits: [0, 5], modulus: 7 }, /leading zeros/);
    rejects("digit-power", { base: 2, digits: [0], modulus: 7 }, /leading zeros/);
    rejects("digit-power", { base: 2, digits: [1, 10], modulus: 7 });
    rejects("digit-power", { base: 2, digits: [], modulus: 7 });
    rejects("digit-power", { base: 2, digits: [1], modulus: 0 });
    rejects("digit-power", { base: 2, digits: [1], modulus: 1_000_001 });
    rejects("digit-power", { base: -1, digits: [1], modulus: 7 });
    rejects("digit-power", { base: 2, digits: new Array(2001).fill(1), modulus: 7 });
  });
  it("ring-router rejects bad names, positions and operations", () => {
    rejects("ring-router", { operations: [["add", "Alpha", 1]] });
    rejects("ring-router", { operations: [["add", "abcdefghijk", 1]] });
    rejects("ring-router", { operations: [["add", "a", -1]] });
    rejects("ring-router", { operations: [["add", "a", 1_000_000_001]] });
    rejects("ring-router", { operations: [["add", "a"]] });
    rejects("ring-router", { operations: [["route", 1, 2]] });
    rejects("ring-router", { operations: [["move", "a", 1]] });
    rejects("ring-router", { operations: new Array(6_001).fill(["route", 1]) });
    expect(libraryResult("ring-router", { operations: new Array(6_000).fill(["route", 1]) })).toHaveLength(6_000);
  });
  it("elevation-ledger rejects self comparisons, unknown benchmarks and huge differences", () => {
    rejects("elevation-ledger", { benchmarks: 3, statements: [[1, 1, 0]] }, /different existing/);
    rejects("elevation-ledger", { benchmarks: 3, statements: [[0, 3, 0]] }, /different existing/);
    rejects("elevation-ledger", { benchmarks: 1, statements: [] });
    rejects("elevation-ledger", { benchmarks: 3, statements: [[0, 1, 1_000_001]] });
    rejects("elevation-ledger", { benchmarks: 3, statements: [[0, 1]] });
    rejects("elevation-ledger", { benchmarks: 3, statements: new Array(7_001).fill([0, 1, 0]) });
    expect(libraryResult("elevation-ledger", { benchmarks: 3, statements: new Array(7_000).fill([0, 1, 0]) })).toHaveLength(7_000);
  });
  it("suffix-alarm rejects uppercase, digits, long words and empty word lists", () => {
    rejects("suffix-alarm", { words: ["ab"], stream: "aB" });
    rejects("suffix-alarm", { words: ["a1"], stream: "a" });
    rejects("suffix-alarm", { words: ["a".repeat(21)], stream: "a" });
    rejects("suffix-alarm", { words: [""], stream: "a" });
    rejects("suffix-alarm", { words: [], stream: "a" });
    rejects("suffix-alarm", { words: ["a"], stream: "a".repeat(10_001) });
  });
  it("grove-harvest rejects non-canonical, orphaned and oversized trees", () => {
    rejects("grove-harvest", { tree: [] });
    rejects("grove-harvest", { tree: [null] }, /root/);
    rejects("grove-harvest", { tree: [1, 2, null] }, /last entry/);
    rejects("grove-harvest", { tree: [1, null, null, 5] }, /missing parent/);
    rejects("grove-harvest", { tree: [1, 2, 3, null, null, null, null, 7] }, /missing parent/);
    rejects("grove-harvest", { tree: [100_001] });
    rejects("grove-harvest", { tree: [1.5] });
    rejects("grove-harvest", { tree: chain(5001) });
    expect(libraryResult("grove-harvest", { tree: chain(5000) })).toBe((5000 * 5001) / 2);
  });
  it("crew-cover rejects masks beyond the skills and bad sizes", () => {
    rejects("crew-cover", { skills: 3, volunteers: [8] }, /below skills/);
    rejects("crew-cover", { skills: 17, volunteers: [1] });
    rejects("crew-cover", { skills: 0, volunteers: [1] });
    rejects("crew-cover", { skills: 3, volunteers: [] });
    rejects("crew-cover", { skills: 3, volunteers: [-1] });
    rejects("crew-cover", { skills: 3, volunteers: new Array(61).fill(1) });
    expect(libraryResult("crew-cover", { skills: 16, volunteers: [43690, 21845] })).toBe(2);
  });
});

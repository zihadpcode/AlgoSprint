import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { executeSandbox, SANDBOX_LIMITS } from "@/features/submissions/sandbox";
import { makeProgram } from "@/features/submissions/harness";
import type { ProblemSeed } from "@/lib/validators/problem";
import { BATCH7, dialDistance, scaleSplits, tilePop } from "../scripts/lib/reference-batch7";
import { seededRng } from "../scripts/lib/reference-expansion";
import { libraryResult } from "../scripts/lib/reference-library";
import { SIGNATURES } from "@/features/submissions/signatures";

// Library batch 7: every reference must agree with its independent brute-force baseline on seeded random inputs, and the
// strict input schemas must reject malformed or adversarial input before any reference runs.
const TRIALS = 600;
const SLUGS = Object.keys(BATCH7);

describe("library batch 7 references", () => {
  it("covers exactly the twelve batch 7 slugs, each with a runner signature", () => {
    expect(SLUGS).toHaveLength(12);
    for (const slug of SLUGS) expect(SIGNATURES[slug], slug).toBeDefined();
  });
  for (const [slug, item] of Object.entries(BATCH7)) {
    it(`${slug}: optimal reference matches the brute-force baseline on ${TRIALS} seeded inputs`, () => {
      const rng = seededRng(slug.length * 104_729 + 77);
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
    const seen = (slug: string, pick: (output: unknown, input: Record<string, unknown>) => string) => {
      const rng = seededRng(99), item = BATCH7[slug], kinds = new Set<string>();
      for (let i = 0; i < TRIALS; i++) {
        const input = item.sample(rng);
        kinds.add(pick(item.solve(...(SIGNATURES[slug].keys.map((k) => input[k]) as never[])), input));
      }
      return kinds;
    };
    expect(seen("worn-tiles", (v) => ((v as number) === 0 ? "none" : "some"))).toEqual(new Set(["none", "some"]));
    expect(seen("close-calls", (v) => ((v as number) === 0 ? "none" : "some"))).toEqual(new Set(["none", "some"]));
    expect(seen("dial-distance", (v, i) => {
      const bits = i.bits as number;
      return (v as number[]).map((d) => (d === 0 ? "same" : d * 2 === 2 ** bits ? "opposite" : "other")).sort().join("|");
    }).size).toBeGreaterThan(3);
    expect(seen("zero-tail", (v) => ((v as number) === 0 ? "none" : "some"))).toEqual(new Set(["none", "some"]));
    expect(seen("toll-slide", (v, i) => {
      const grid = i.grid as number[][];
      // Plain right/down minimum without any slide.
      const rows = grid.length, cols = grid[0].length, best = grid.map((row) => row.map(() => Infinity));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) best[r][c] = grid[r][c] + (r === 0 && c === 0 ? 0 : Math.min(r ? best[r - 1][c] : Infinity, c ? best[r][c - 1] : Infinity));
      return (v as number) < best[rows - 1][cols - 1] ? "slide-helps" : "slide-useless";
    })).toEqual(new Set(["slide-helps", "slide-useless"]));
    expect(seen("bay-ledger", (v) => [...new Set((v as number[]).map((x) => (x === -1 ? "missing" : x === 0 ? "zero" : "positive")))].sort().join("|")).has("missing|positive")).toBe(true);
    expect(seen("booth-bookings", (v) => [...new Set((v as (number | boolean)[]).map((x) => (x === true ? "cancelled" : x === false ? "refused-cancel" : x === -1 ? "none-or-rejected" : "id-or-start")))].sort().join("|")).size).toBeGreaterThan(4);
    expect(seen("pulse-gates", (v) => ((v as number) === -1 ? "blocked" : (v as number) === 0 ? "zero" : "reached"))).toEqual(new Set(["blocked", "reached"]));
    expect(seen("profit-block", (v) => ((v as number) < 0 ? "negative" : "non-negative"))).toEqual(new Set(["negative", "non-negative"]));
    expect(seen("tile-pop", (v) => ((v as number) === 0 ? "none" : "some"))).toEqual(new Set(["none", "some"]));
    expect(seen("prefix-echoes", (v) => ((v as number[]).some((x) => x > 1) ? "repeated" : "unique")).has("repeated")).toBe(true);
    expect(seen("scale-splits", (v, i) => ((v as number) === 0 ? "none" : (v as number) === 2 ** (i.weights as number[]).length ? "all" : "some"))).toEqual(new Set(["none", "some", "all"]));
  });
});

describe("exhaustive and edge checks", () => {
  it("dial-distance matches an explicit walk around every 6-bit dial and handles the 30-bit endpoints", () => {
    const bits = 6, n = 2 ** bits, code = (k: number) => k ^ (k >> 1);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const d = Math.abs(a - b);
      expect(dialDistance(bits, [[code(a), code(b)]])).toEqual([Math.min(d, n - d)]);
    }
    // Consecutive settings differ in one bit, including the wrap from the last click to the first.
    for (let k = 0; k < n; k++) { const x = code(k) ^ code((k + 1) % n); expect(x & (x - 1)).toBe(0); }
    expect(dialDistance(30, [[0, 0], [0, 805_306_368], [(2 ** 30 - 1) ^ (2 ** 29 - 1), 0]])).toEqual([0, 2 ** 29, 1]);
  });
  it("zero-tail agrees with a direct BigInt count on structured inputs and handles prime and composite bases", () => {
    expect(libraryResult("zero-tail", { numbers: [1], base: 2 })).toBe(0);
    expect(libraryResult("zero-tail", { numbers: [1000, 1000], base: 10 })).toBe(6);
    expect(libraryResult("zero-tail", { numbers: [2 ** 29, 2 ** 29], base: 2 ** 29 })).toBe(2);
    expect(libraryResult("zero-tail", { numbers: [999_999_937], base: 999_999_937 })).toBe(1);
    expect(libraryResult("zero-tail", { numbers: [6, 6, 6], base: 36 })).toBe(1);
    expect(libraryResult("zero-tail", { numbers: [12, 18, 50], base: 60 })).toBe(BATCH7["zero-tail"].brute([12, 18, 50] as never, 60 as never));
  });
  it("tile-pop clears nested and sibling pairs but never pairs tiles that were not adjacent", () => {
    expect(tilePop([5, 9, 9, 5], 0)).toBe(28);
    expect(tilePop([5, 9, 6, 5], 0)).toBe(0);
    expect(tilePop([5, 9, 6, 5], 1)).toBe(11); // only the 6 and 5 are within 1; afterwards 5 and 9 are too far apart
    expect(tilePop([1], 1000)).toBe(0);
  });
  it("scale-splits counts mirrored assignments separately and survives n = 1", () => {
    expect(scaleSplits([7], 7)).toBe(2);
    expect(scaleSplits([7], 6)).toBe(0);
    expect(scaleSplits([4, 4], 0)).toBe(2);
    expect(scaleSplits(new Array(36).fill(1_000_000_000), 36_000_000_000)).toBe(2 ** 36);
  });
  it("pulse-gates passes a gate only on its own beat", () => {
    // S . 1 E with period 2: the gate is open at odd times. Walking straight arrives at the gate at t=2 (closed), so wait once.
    expect(libraryResult("pulse-gates", { grid: ["S.1E"], period: 2 })).toBe(4);
    expect(libraryResult("pulse-gates", { grid: ["S0E"], period: 1 })).toBe(2);
    expect(libraryResult("pulse-gates", { grid: ["S#E"], period: 1 })).toBe(-1);
  });
  it("prefix-echoes counts overlapping occurrences", () => {
    expect(libraryResult("prefix-echoes", { text: "aaaa", lengths: [1, 2, 3, 4] })).toEqual([4, 3, 2, 1]);
  });
});

// A correct solution must neither be rejected for a stored input above the runner's 64,000-byte stdin limit nor fail with
// "Output exceeds the sandbox limit" (90,000 bytes). Every worst case below is at the schema cap; outputs are held to 70%.
describe("batch 7 worst-case input and output sizes", () => {
  const cap = SANDBOX_LIMITS.outputBytes;
  const INPUT_CAP = 64_000;
  const serpentine = (rows: number, cols: number, period: number) => {
    // A one-cell-wide corridor snaking through the grid: even rows are corridors, odd rows are walls with one
    // connecting cell at alternating ends. Rows must be odd so the last row is a corridor.
    const grid: string[] = [];
    for (let r = 0; r < rows; r++) {
      if (r % 2 === 0) grid.push(".".repeat(cols));
      else grid.push((r >> 1) % 2 === 0 ? "#".repeat(cols - 1) + "." : "." + "#".repeat(cols - 1));
    }
    grid[0] = "S" + grid[0].slice(1);
    const lastIsRight = ((rows - 1) / 2) % 2 === 0;
    grid[rows - 1] = lastIsRight ? grid[rows - 1].slice(0, cols - 1) + "E" : "E" + grid[rows - 1].slice(1);
    return { grid, period };
  };
  const gateCorridor = () => {
    const base = serpentine(239, 250, 6);
    // Put a beat gate into the corridor every seventh column of every corridor row except the first.
    base.grid = base.grid.map((row, r) => (r % 2 === 0 && r > 0 ? [...row].map((ch, c) => (c % 7 === 3 ? String((r + c) % 6) : ch)).join("") : row));
    return base;
  };
  const worst: Record<string, Record<string, unknown>[]> = {
    "worn-tiles": [{ length: 100_000, passes: new Array(3_500).fill([99_999, 99_999]), limit: 3_500 }, { length: 100_000, passes: new Array(3_500).fill([0, 99_999]), limit: 3_500 }],
    "close-calls": [{ readings: new Array(15_000).fill(999), tolerance: 999 }],
    "dial-distance": [
      { bits: 30, pairs: new Array(2_500).fill([1_073_741_823, 1_073_741_823]) },
      { bits: 30, pairs: new Array(2_500).fill([0, 805_306_368]) },
    ],
    "zero-tail": [{ numbers: new Array(5_000).fill(1_000_000_000), base: 223_092_870 }, { numbers: new Array(5_000).fill(2 ** 29), base: 2 ** 29 }],
    "toll-slide": [{ grid: Array.from({ length: 150 }, () => new Array(133).fill(99)) }, { grid: Array.from({ length: 133 }, () => new Array(150).fill(99)) }],
    "bay-ledger": [
      { bays: 100_000, operations: new Array(3_000).fill(["set", 100_000, 1_000]) },
      { bays: 100_000, operations: [...Array.from({ length: 1_500 }, (_, i) => ["set", 100_000 - i, 1_000]), ...Array.from({ length: 1_500 }, () => ["total", 100_000])] },
    ],
    // Alternate a tiny booking far away with probes: next() answers 7-digit starts and the rest answer -1.
    "booth-bookings": [
      { gap: 1_000, operations: new Array(2_500).fill(["book", 999_999, 1_000_000]) },
      { gap: 0, operations: [["book", 999_000, 999_001], ...Array.from({ length: 2_499 }, () => ["next", 0])] },
    ],
    "pulse-gates": [serpentine(239, 250, 1), gateCorridor()],
    "profit-block": [{ profits: new Array(20_000).fill(-9), minLen: 1, maxLen: 20_000 }, { profits: new Array(20_000).fill(9), minLen: 10_000, maxLen: 20_000 }],
    "tile-pop": [{ weights: new Array(200).fill(1_000), tolerance: 1_000 }],
    "prefix-echoes": [{ text: "a".repeat(40_000), lengths: Array.from({ length: 3_000 }, (_, i) => 40_000 - i) }, { text: "a".repeat(40_000), lengths: new Array(3_000).fill(10_000) }],
    "scale-splits": [{ weights: new Array(36).fill(1_000_000_000), tolerance: 36_000_000_000 }],
  };
  const stdin = (slug: string, input: Record<string, unknown>) => JSON.stringify(SIGNATURES[slug].keys.map((key) => input[key]));
  it("has a worst-case input for every batch 7 slug", () => {
    expect(Object.keys(worst).sort()).toEqual(SLUGS.sort());
  });
  for (const slug of SLUGS) {
    it(`${slug}: every worst case fits the 64,000-byte input cap and the output stays under 70% of the ${cap}-byte cap`, () => {
      for (const candidate of worst[slug]) {
        const input = BATCH7[slug].input.parse(candidate) as Record<string, unknown>;
        const inputBytes = Buffer.byteLength(stdin(slug, input)), outputBytes = Buffer.byteLength(JSON.stringify(libraryResult(slug, input)));
        if (process.env.B7_SIZES) console.info(`SIZE ${slug} input ${inputBytes} output ${outputBytes}`);
        expect(inputBytes).toBeLessThanOrEqual(INPUT_CAP);
        expect(outputBytes).toBeLessThan(cap * 0.7);
      }
    });
  }
  it("the largest worst-case inputs sit close to the cap, so the statement caps are tight rather than loose", () => {
    const bytes = (slug: string) => Math.max(...worst[slug].map((c) => Buffer.byteLength(stdin(slug, BATCH7[slug].input.parse(c) as Record<string, unknown>))));
    for (const slug of ["worn-tiles", "dial-distance", "toll-slide", "bay-ledger", "booth-bookings", "pulse-gates", "profit-block", "prefix-echoes"]) {
      expect(bytes(slug), slug).toBeGreaterThan(48_000);
    }
  });
  it("one schema-valid input above each cap is rejected, so the statement caps equal the schema", () => {
    expect(() => libraryResult("worn-tiles", { length: 100_000, passes: new Array(3_501).fill([0, 0]), limit: 1 })).toThrow();
    expect(() => libraryResult("close-calls", { readings: new Array(15_001).fill(0), tolerance: 0 })).toThrow();
    expect(() => libraryResult("dial-distance", { bits: 30, pairs: new Array(2_501).fill([0, 0]) })).toThrow();
    expect(() => libraryResult("zero-tail", { numbers: new Array(5_001).fill(1), base: 2 })).toThrow();
    expect(() => libraryResult("toll-slide", { grid: Array.from({ length: 151 }, () => [0]) })).toThrow();
    expect(() => libraryResult("toll-slide", { grid: Array.from({ length: 150 }, () => new Array(134).fill(0)) })).toThrow(/20,000/);
    expect(() => libraryResult("bay-ledger", { bays: 100_000, operations: new Array(3_001).fill(["total", 1]) })).toThrow();
    expect(() => libraryResult("booth-bookings", { gap: 0, operations: new Array(2_501).fill(["next", 0]) })).toThrow();
    expect(() => libraryResult("pulse-gates", { grid: [`S${".".repeat(250)}`, `${".".repeat(250)}E`], period: 1 })).toThrow();
    expect(() => libraryResult("profit-block", { profits: new Array(20_001).fill(0), minLen: 1, maxLen: 1 })).toThrow();
    expect(() => libraryResult("tile-pop", { weights: new Array(201).fill(1), tolerance: 0 })).toThrow();
    expect(() => libraryResult("prefix-echoes", { text: "a".repeat(40_001), lengths: [1] })).toThrow();
    expect(() => libraryResult("scale-splits", { weights: new Array(37).fill(1), tolerance: 0 })).toThrow();
  });
  // The same QuickJS sandbox and harness that verified submissions use, on every full-size worst case.
  for (const slug of SLUGS) {
    it(`${slug}: the optimal solution returns every worst case through the real sandbox`, async () => {
      const seed = JSON.parse(readFileSync(join(process.cwd(), "src/data/seeds/problems/library", `${slug}.json`), "utf8")) as ProblemSeed;
      const optimal = seed.solutions.find((solution) => solution.kind === "OPTIMAL" && solution.language === "JAVASCRIPT")!;
      const starter = seed.starterCode.find((code) => code.language === "JAVASCRIPT")!;
      const cases = worst[slug].map((candidate) => {
        const input = BATCH7[slug].input.parse(candidate) as Record<string, unknown>;
        return { stdin: stdin(slug, input), expected: libraryResult(slug, input) };
      });
      const outcomes = await executeSandbox(makeProgram(slug, starter.entryPoint, optimal.code), cases, { timeMs: seed.timeLimitMs, memoryKb: seed.memoryLimitKb });
      expect(outcomes.map((o) => o.status), outcomes.map((o) => o.diagnostic ?? "").join(" ")).toEqual(cases.map(() => "ACCEPTED"));
    }, 60_000);
  }
});

describe("batch 7 input boundaries", () => {
  const rejects = (slug: string, input: unknown, message?: RegExp) => expect(() => libraryResult(slug, input), `${slug} ${JSON.stringify(input).slice(0, 80)}`).toThrow(message);

  it("worn-tiles rejects reversed, out-of-range and malformed passes", () => {
    rejects("worn-tiles", { length: 5, passes: [[3, 2]], limit: 1 }, /from <= to/);
    rejects("worn-tiles", { length: 5, passes: [[0, 5]], limit: 1 }, /from <= to/);
    rejects("worn-tiles", { length: 5, passes: [[0, 1, 2]], limit: 1 });
    rejects("worn-tiles", { length: 5, passes: [[0.5, 1]], limit: 1 });
    rejects("worn-tiles", { length: 0, passes: [], limit: 1 });
    rejects("worn-tiles", { length: 5, passes: [], limit: 0 });
    rejects("worn-tiles", { length: 5, passes: [], limit: 1, extra: 1 });
  });
  it("close-calls rejects empty, out-of-range and fractional readings", () => {
    rejects("close-calls", { readings: [], tolerance: 0 });
    rejects("close-calls", { readings: [1000], tolerance: 0 });
    rejects("close-calls", { readings: [-1], tolerance: 0 });
    rejects("close-calls", { readings: [1.5], tolerance: 0 });
    rejects("close-calls", { readings: [1], tolerance: 1000 });
    rejects("close-calls", { readings: ["1"], tolerance: 0 });
  });
  it("dial-distance rejects settings that need more bits than the dial has", () => {
    rejects("dial-distance", { bits: 3, pairs: [[8, 0]] }, /below 2\^bits/);
    rejects("dial-distance", { bits: 0, pairs: [[0, 0]] });
    rejects("dial-distance", { bits: 31, pairs: [[0, 0]] });
    rejects("dial-distance", { bits: 3, pairs: [] });
    rejects("dial-distance", { bits: 3, pairs: [[1]] });
    rejects("dial-distance", { bits: 3, pairs: [[-1, 0]] });
  });
  it("zero-tail rejects zeros, tiny bases and oversized values", () => {
    rejects("zero-tail", { numbers: [0], base: 10 });
    rejects("zero-tail", { numbers: [5], base: 1 });
    rejects("zero-tail", { numbers: [1_000_000_001], base: 10 });
    rejects("zero-tail", { numbers: [5], base: 1_000_000_001 });
    rejects("zero-tail", { numbers: [], base: 10 });
    rejects("zero-tail", { numbers: [2.5], base: 10 });
  });
  it("toll-slide rejects ragged, empty, negative and oversized grids", () => {
    rejects("toll-slide", { grid: [[1, 2], [3]] }, /same length/);
    rejects("toll-slide", { grid: [] });
    rejects("toll-slide", { grid: [[]] });
    rejects("toll-slide", { grid: [[-1]] });
    rejects("toll-slide", { grid: [[100]] });
    rejects("toll-slide", { grid: [["1"]] });
  });
  it("bay-ledger rejects bays beyond the row, zero targets and malformed operations", () => {
    rejects("bay-ledger", { bays: 3, operations: [["set", 4, 1]] }, /between 1 and bays/);
    rejects("bay-ledger", { bays: 3, operations: [["total", 0]] });
    rejects("bay-ledger", { bays: 3, operations: [["locate", 0]] });
    rejects("bay-ledger", { bays: 3, operations: [["set", 1, 1001]] });
    rejects("bay-ledger", { bays: 3, operations: [["set", 1, -1]] });
    rejects("bay-ledger", { bays: 3, operations: [["set", 1]] });
    rejects("bay-ledger", { bays: 3, operations: [["add", 1, 1]] });
    rejects("bay-ledger", { bays: 3, operations: [["locate", 1, 2]] });
  });
  it("booth-bookings rejects empty bookings, bad ids and unknown operations", () => {
    rejects("booth-bookings", { gap: 0, operations: [["book", 5, 5]] }, /end after it starts/);
    rejects("booth-bookings", { gap: 0, operations: [["book", 6, 5]] }, /end after it starts/);
    rejects("booth-bookings", { gap: 0, operations: [["book", 0, 1_000_001]] });
    rejects("booth-bookings", { gap: 0, operations: [["cancel", 0]] });
    rejects("booth-bookings", { gap: 1001, operations: [] });
    rejects("booth-bookings", { gap: 0, operations: [["move", 1]] });
    rejects("booth-bookings", { gap: 0, operations: [["next", -1]] });
  });
  it("pulse-gates rejects missing or repeated endpoints, gate digits past the period and ragged rows", () => {
    rejects("pulse-gates", { grid: ["S.."], period: 1 }, /exactly one S and one E/);
    rejects("pulse-gates", { grid: ["SSE"], period: 1 }, /exactly one S and one E/);
    rejects("pulse-gates", { grid: ["S1E"], period: 1 }, /below period/);
    rejects("pulse-gates", { grid: ["S.E", "."], period: 1 }, /same length/);
    rejects("pulse-gates", { grid: ["S?E"], period: 1 });
    rejects("pulse-gates", { grid: ["S6E"], period: 6 });
    rejects("pulse-gates", { grid: ["SE"], period: 7 });
    rejects("pulse-gates", { grid: [], period: 1 });
  });
  it("profit-block rejects bad lengths and out-of-range profits", () => {
    rejects("profit-block", { profits: [1, 2], minLen: 2, maxLen: 1 }, /minLen <= maxLen/);
    rejects("profit-block", { profits: [1, 2], minLen: 1, maxLen: 3 }, /maxLen <= profits.length/);
    rejects("profit-block", { profits: [1, 2], minLen: 0, maxLen: 1 });
    rejects("profit-block", { profits: [10], minLen: 1, maxLen: 1 });
    rejects("profit-block", { profits: [], minLen: 1, maxLen: 1 });
  });
  it("tile-pop rejects empty rails and out-of-range weights", () => {
    rejects("tile-pop", { weights: [], tolerance: 0 });
    rejects("tile-pop", { weights: [0], tolerance: 0 });
    rejects("tile-pop", { weights: [1001], tolerance: 0 });
    rejects("tile-pop", { weights: [1], tolerance: -1 });
    rejects("tile-pop", { weights: [1.5], tolerance: 0 });
  });
  it("prefix-echoes rejects uppercase, empty text and lengths past the text", () => {
    rejects("prefix-echoes", { text: "abC", lengths: [1] });
    rejects("prefix-echoes", { text: "", lengths: [1] });
    rejects("prefix-echoes", { text: "ab", lengths: [3] }, /at most text.length/);
    rejects("prefix-echoes", { text: "ab", lengths: [0] });
    rejects("prefix-echoes", { text: "ab", lengths: [] });
    rejects("prefix-echoes", { text: "ab1", lengths: [1] });
  });
  it("scale-splits rejects too many weights, zero weights and oversized tolerances", () => {
    rejects("scale-splits", { weights: [], tolerance: 0 });
    rejects("scale-splits", { weights: [0], tolerance: 0 });
    rejects("scale-splits", { weights: [1_000_000_001], tolerance: 0 });
    rejects("scale-splits", { weights: [1], tolerance: 36_000_000_001 });
    rejects("scale-splits", { weights: [1], tolerance: -1 });
    rejects("scale-splits", { weights: [1.5], tolerance: 0 });
  });
});

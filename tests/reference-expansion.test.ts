import { describe, expect, it } from "vitest";
import { EXPANSION, seededRng } from "../scripts/lib/reference-expansion";
import { libraryResult } from "../scripts/lib/reference-library";
import { SIGNATURES } from "@/features/submissions/signatures";

// Every expansion reference must agree with its independent brute-force baseline on seeded random inputs, and its
// input schema must accept exactly what the sampler produces.
describe("library expansion references", () => {
  for (const [slug, item] of Object.entries(EXPANSION)) {
    it(`${slug}: optimal reference matches the brute-force baseline`, () => {
      const signature = SIGNATURES[slug];
      expect(signature).toBeDefined();
      const rng = seededRng(slug.length * 7919 + 17);
      for (let trial = 0; trial < 400; trial++) {
        const input = item.input.parse(item.sample(rng)) as Record<string, unknown>;
        const args = signature.keys.map((key) => input[key]) as never[];
        expect(item.solve(...args), JSON.stringify(input)).toEqual(item.brute(...args));
        expect(libraryResult(slug, input)).toEqual(item.solve(...args));
      }
    });
  }
});

describe("library expansion input boundaries", () => {
  it("accepts both signed 32-bit endpoints in postfix-ledger and rejects values past them", () => {
    expect(libraryResult("postfix-ledger", { tokens: ["-32768", "65536", "*"] })).toBe(-(2 ** 31));
    expect(libraryResult("postfix-ledger", { tokens: ["65535", "32768", "*", "32767", "+"] })).toBe(2 ** 31 - 1);
    expect(() => libraryResult("postfix-ledger", { tokens: ["32768", "65536", "*"] })).toThrow(/32-bit/);
    expect(() => libraryResult("postfix-ledger", { tokens: ["-32768", "65536", "*", "1", "-"] })).toThrow(/32-bit/);
    expect(() => libraryResult("postfix-ledger", { tokens: ["4", "0", "/"] })).toThrow(/zero/);
    expect(() => libraryResult("postfix-ledger", { tokens: ["4", "+"] })).toThrow(/two operands/);
  });
  it("rejects malformed structural inputs", () => {
    expect(() => libraryResult("slot-insert", { slots: [[1, 4], [3, 6]], newSlot: [0, 0] })).toThrow(/disjoint/);
    expect(() => libraryResult("kth-badge", { tree: [5, 6, 4], k: 1 })).toThrow(/BST/);
    expect(() => libraryResult("dial-lookup", { dial: [3, 1, 2, 0], target: 1 })).toThrow(/rotation/);
    expect(() => libraryResult("floor-tracker", { operations: [["pop"]] })).toThrow(/non-empty/);
    expect(() => libraryResult("module-plan", { modules: 2, prerequisites: [[1, 1]] })).toThrow(/different/);
    expect(() => libraryResult("studio-bookings", { bookings: [[4, 4]] })).toThrow(/end after/);
  });
});

describe("tile-shuffle reference", () => {
  const permutations = (items: number[]): number[][] => (items.length === 0 ? [[]] : items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p])));
  it("agrees with the independent coordinate-based baseline on all 720 boards", () => {
    const item = EXPANSION["tile-shuffle"];
    const boards = permutations([0, 1, 2, 3, 4, 5]);
    expect(boards).toHaveLength(720);
    let reachable = 0, longest = 0;
    for (const cells of boards) {
      const board = [cells.slice(0, 3), cells.slice(3)];
      const solved = item.solve(board as never) as number, baseline = item.brute(board as never) as number;
      expect(solved, JSON.stringify(board)).toBe(baseline);
      if (solved >= 0) { reachable++; longest = Math.max(longest, solved); }
    }
    // Exactly half of all arrangements are reachable (permutation parity), and the farthest takes 21 moves.
    expect(reachable).toBe(360);
    expect(longest).toBe(21);
  });
});

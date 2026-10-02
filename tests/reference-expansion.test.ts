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


import { describe, expect, it } from "vitest";
import {
  LIBRARY, libraryResult, ridgeCount, ticketPair, mirrorCallsign, longestCleanStreak, balancedBlueprint, warmerWait, ticketTurns,
  chainLoopStart, balancedCanopy, ledgerTreeCheck, spliceCables, gridRescueHops, orchardPlots, cheapestRoute, crateCombinations,
  watchtowerPlacements, fewestTokens, sharedMelody, risingMarks, chargingHops, bakeBatches, mergeShifts, rankTags,
  firstRedundantLink, taskOrder, prefixCounts, loneSensor, primeTally, lruResults, gutterCapacity,
} from "../scripts/lib/reference-library";
import { SIGNATURES } from "@/features/submissions/signatures";

function arrays(values: number[], maxLength: number): number[][] {
  const result: number[][] = [[]];
  let current: number[][] = [[]];
  for (let length = 1; length <= maxLength; length++) {
    current = current.flatMap((prefix) => values.map((n) => [...prefix, n]));
    result.push(...current);
  }
  return result;
}

function subsets<T>(items: T[]): T[][] {
  return items.reduce<T[][]>((acc, item) => [...acc, ...acc.map((s) => [...s, item])], [[]]);
}

describe("library registry", () => {
  it("registers exactly the signatures that are not foundation problems and rejects malformed input", () => {
    const foundation = ["relay-window", "quiet-badge", "parcel-checkpoints", "dock-threshold", "lantern-steps"];
    expect(Object.keys(LIBRARY).sort()).toEqual(Object.keys(SIGNATURES).filter((slug) => !foundation.includes(slug)).sort());
    expect(libraryResult("relay-window", {})).toBeUndefined();
    expect(() => libraryResult("ridge-count", { heights: ["x"] })).toThrow();
    expect(() => libraryResult("ticket-turns", { tickets: [1], position: 1 })).toThrow(/index the queue/);
    expect(() => libraryResult("lone-sensor", { readings: [1, 1] })).toThrow(/single/);
    expect(libraryResult("ticket-pair", { budget: 6, prices: [3, 3] })).toEqual([0, 1]);
  });
});

describe("linear scans and hashing agree with exhaustive baselines", () => {
  it("counts ridges as strict prefix maxima", () => {
    for (const heights of arrays([-1, 0, 2], 6)) {
      const expected = heights.filter((h, i) => heights.slice(0, i).every((earlier) => earlier < h)).length;
      expect(ridgeCount(heights)).toBe(expected);
    }
  });
  it("returns the pair with the smallest second index, then smallest first index", () => {
    for (const prices of arrays([-1, 1, 2], 6)) for (let budget = -2; budget <= 4; budget++) {
      let expected = [-1, -1];
      outer: for (let j = 1; j < prices.length; j++) for (let i = 0; i < j; i++) if (prices[i] + prices[j] === budget) { expected = [i, j]; break outer; }
      expect(ticketPair(prices, budget)).toEqual(expected);
    }
  });
  it("ignores punctuation and case when mirroring", () => {
    for (const text of ["", "!", "Aa", "a-b", "ab", "A man, a plan", "1 2 1", "No lemon, no melon"]) {
      const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, "");
      expect(mirrorCallsign(text)).toBe(cleaned === [...cleaned].reverse().join(""));
    }
  });
  it("finds the longest distinct-letter substring", () => {
    for (const letters of arrays([0, 1, 2], 7)) {
      const log = letters.map((n) => "abc"[n]).join("");
      let expected = 0;
      for (let s = 0; s < log.length; s++) for (let e = s; e < log.length; e++) if (new Set(log.slice(s, e + 1)).size === e - s + 1) expected = Math.max(expected, e - s + 1);
      expect(longestCleanStreak(log)).toBe(expected);
    }
  });
  it("ranks tags by count then text and finds the lone reading", () => {
    expect(rankTags(["b", "a", "b", "c", "a", "b"])).toEqual(["b", "a", "c"]);
    expect(rankTags([])).toEqual([]);
    expect(loneSensor([7, 3, 7, -2, 3])).toBe(-2);
  });
});

describe("stack, queue and pointer structures", () => {
  it("accepts exactly the balanced bracket strings", () => {
    const balanced = (plan: string) => { let s = plan; let previous = ""; while (s !== previous) { previous = s; s = s.replace(/\(\)|\[\]|\{\}/g, ""); } return s === ""; };
    for (const picks of arrays([0, 1, 2, 3, 4, 5], 4)) {
      const plan = picks.map((n) => "()[]{}"[n]).join("");
      expect(balancedBlueprint(plan)).toBe(balanced(plan));
    }
  });
  it("reports the wait until a strictly warmer day", () => {
    for (const temps of arrays([1, 2, 3], 6)) {
      const expected = temps.map((t, i) => { const later = temps.findIndex((u, j) => j > i && u > t); return later === -1 ? 0 : later - i; });
      expect(warmerWait(temps)).toEqual(expected);
    }
  });
  it("matches a queue simulation for ticket turns", () => {
    for (const tickets of arrays([1, 2, 3], 4).filter((t) => t.length)) for (let position = 0; position < tickets.length; position++) {
      const line = tickets.map((needed, who) => ({ who, needed }));
      let seconds = 0, expected = 0;
      while (line.length) { const p = line.shift()!; seconds++; p.needed--; if (p.needed === 0) { if (p.who === position) { expected = seconds; break; } } else line.push(p); }
      expect(ticketTurns(tickets, position)).toBe(expected);
    }
  });
  it("finds the loop entry of every small pointer chain", () => {
    for (const next of arrays([-1, 0, 1, 2], 4)) for (let head = -1; head < next.length; head++) {
      if (next.some((n) => n >= next.length)) continue;
      const seen = new Set<number>();
      let station = head, expected = -1;
      while (station !== -1) { if (seen.has(station)) { expected = station; break; } seen.add(station); station = next[station]; }
      expect(chainLoopStart(next, head)).toBe(expected);
    }
  });
  it("computes trapped water against the prefix-maximum formula", () => {
    for (const heights of arrays([0, 1, 3], 7)) {
      const expected = heights.reduce((sum, h, i) => sum + Math.min(Math.max(...heights.slice(0, i + 1)), Math.max(...heights.slice(i))) - h, 0);
      expect(gutterCapacity(heights)).toBe(expected);
    }
  });
});

describe("trees, heaps and graphs", () => {
  it("evaluates balance and the search property on hand-checked trees", () => {
    expect(balancedCanopy([])).toBe(true);
    expect(balancedCanopy([1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);
    expect(balancedCanopy([1, 2, null, 3, null, 4])).toBe(false);
    expect(ledgerTreeCheck([8, 3, 10, 1, 6, null, 14])).toBe(true);
    expect(ledgerTreeCheck([5, 1, 7, null, null, 4, 9])).toBe(false);
    expect(ledgerTreeCheck([2, 2])).toBe(false);
  });
  it("splices cables at the optimal-merge cost", () => {
    expect(spliceCables([])).toBe(0);
    expect(spliceCables([4, 3, 2, 6])).toBe(29);
    expect(spliceCables([1, 100, 1, 100])).toBe(306);
  });
  it("finds shortest grid paths, plot counts, cheapest routes and redundant links", () => {
    expect(gridRescueHops(["S.#", ".##", "..T"])).toBe(4);
    expect(gridRescueHops(["S#T"])).toBe(-1);
    expect(orchardPlots(["TT.", "..T", "T.T"])).toBe(3);
    expect(orchardPlots([])).toBe(0);
    expect(cheapestRoute(4, [[0, 1, 5], [0, 2, 1], [2, 1, 1], [1, 3, 2]], 0, 3)).toBe(4);
    expect(cheapestRoute(3, [[0, 1, 4]], 0, 2)).toBe(-1);
    expect(firstRedundantLink(4, [[0, 1], [1, 2], [2, 0], [2, 3]])).toEqual([2, 0]);
    expect(firstRedundantLink(3, [[0, 1], [1, 2]])).toEqual([]);
  });
  it("orders tasks lexicographically and detects cycles", () => {
    expect(taskOrder(4, [[1, 0], [2, 0], [3, 1]])).toEqual([2, 3, 1, 0]);
    expect(taskOrder(3, [[0, 1], [1, 2], [2, 0]])).toEqual([]);
    const order = taskOrder(6, [[5, 2], [5, 0], [4, 0], [4, 1], [2, 3], [3, 1]]);
    for (const [before, after] of [[5, 2], [5, 0], [4, 0], [4, 1], [2, 3], [3, 1]]) expect(order.indexOf(before)).toBeLessThan(order.indexOf(after));
  });
  it("counts prefixes like a direct scan", () => {
    const words = ["a", "ab", "abc", "b", "", "ab"];
    const queries = ["", "a", "ab", "abc", "abcd", "b", "c"];
    expect(prefixCounts(words, queries)).toEqual(queries.map((q) => words.filter((w) => w.startsWith(q)).length));
  });
});

describe("search, dynamic programming and greedy answers", () => {
  it("matches subset enumeration for crate combinations", () => {
    for (const weights of subsets([1, 2, 3, 5]).slice(1)) for (let target = 0; target <= 8; target++) {
      const expected = subsets(weights).filter((s) => s.reduce((a, b) => a + b, 0) === target).map((s) => [...s].sort((a, b) => a - b))
        .sort((a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; });
      expect(crateCombinations(weights, target)).toEqual(expected);
    }
  });
  it("reproduces the known watchtower counts", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(watchtowerPlacements)).toEqual([1, 0, 0, 2, 10, 4, 40, 92]);
  });
  it("finds the fewest tokens by exhaustive recursion on small amounts", () => {
    const fewest = (tokens: number[], amount: number): number => { if (amount === 0) return 0; let best = Infinity; for (const t of tokens) if (t <= amount) best = Math.min(best, 1 + fewest(tokens, amount - t)); return best; };
    for (const tokens of [[1, 5, 12], [4, 6], [7, 3], [2]]) for (let amount = 0; amount <= 16; amount++) {
      const expected = fewest(tokens, amount);
      expect(fewestTokens(tokens, amount)).toBe(expected === Infinity ? -1 : expected);
    }
  });
  it("computes shared melodies and rising runs against exhaustive search", () => {
    const lcs = (a: string, b: string): number => !a || !b ? 0 : a[a.length - 1] === b[b.length - 1] ? 1 + lcs(a.slice(0, -1), b.slice(0, -1)) : Math.max(lcs(a.slice(0, -1), b), lcs(a, b.slice(0, -1)));
    for (const x of arrays([0, 1], 4)) for (const y of arrays([0, 1], 4)) {
      const a = x.map((n) => "ab"[n]).join(""), b = y.map((n) => "ab"[n]).join("");
      expect(sharedMelody(a, b)).toBe(lcs(a, b));
    }
    for (const marks of arrays([1, 2, 3], 6)) {
      const expected = Math.max(0, ...subsets(marks.map((m, i) => i)).filter((idx) => idx.every((k, p) => p === 0 || marks[idx[p - 1]] < marks[k])).map((idx) => idx.length));
      expect(risingMarks(marks)).toBe(expected);
    }
  });
  it("decides reachability, minimal capacity and merged shifts consistently", () => {
    for (const ranges of arrays([0, 1, 2], 6).filter((r) => r.length)) {
      const reach = new Set([0]);
      for (let i = 0; i < ranges.length; i++) if (reach.has(i)) for (let hop = 1; hop <= ranges[i]; hop++) reach.add(i + hop);
      expect(chargingHops(ranges)).toBe(reach.has(ranges.length - 1));
    }
    expect(bakeBatches([3, 5, 2, 7, 4], 3)).toBe(9);
    expect(bakeBatches([6, 6, 6], 1)).toBe(18);
    expect(bakeBatches([1, 2, 3, 4], 4)).toBe(4);
    expect(mergeShifts([[1, 3], [8, 10], [2, 6], [15, 18]])).toEqual([[1, 6], [8, 10], [15, 18]]);
    expect(mergeShifts([[1, 4], [4, 5]])).toEqual([[1, 5]]);
    expect(mergeShifts([])).toEqual([]);
  });
  it("tallies primes and replays cache operations", () => {
    expect([0, 2, 3, 12, 30, 100].map(primeTally)).toEqual([0, 0, 1, 5, 10, 25]);
    expect(lruResults(2, [["put", 1, 10], ["put", 2, 20], ["get", 1], ["put", 3, 30], ["get", 2], ["get", 3]])).toEqual([10, -1, 30]);
    expect(lruResults(1, [["get", 5], ["put", 5, 50], ["put", 6, 60], ["get", 5]])).toEqual([-1, -1]);
  });
});

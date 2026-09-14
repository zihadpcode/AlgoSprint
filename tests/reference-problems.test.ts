import { describe, expect, it } from "vitest";
import { relayWindow, relayWindowBrute, quietBadge, quietBadgeBrute, parcelCheckpoints, parcelCheckpointsBrute, dockThreshold, dockThresholdBrute, lanternSteps, lanternStepsBrute } from "../scripts/lib/reference-problems";

function arrays(values: number[], maxLength: number): number[][] {
  const result: number[][] = [[]];
  let current: number[][] = [[]];
  for (let length = 1; length <= maxLength; length++) {
    current = current.flatMap((prefix) => values.map((n) => [...prefix, n]));
    result.push(...current);
  }
  return result;
}

describe("optimized algorithms agree with independently structured brute-force baselines", () => {
  it("checks every valid window over small signed arrays", () => {
    for (const input of arrays([-2, 0, 3], 6)) {
      for (let width = 1; width <= input.length; width++) expect(relayWindow(input, width)).toBe(relayWindowBrute(input, width));
    }
  });
  it("preserves earliest uniqueness for all short badge records", () => {
    for (const input of arrays([0, 1, 2], 7)) {
      const badges = input.map((n) => "abc"[n]).join("");
      expect(quietBadge(badges)).toBe(quietBadgeBrute(badges));
    }
  });
  it("checks all half-open ranges including empty ones", () => {
    for (const input of arrays([-2, 0, 3], 5)) {
      const ranges: [number, number][] = [];
      for (let start = 0; start <= input.length; start++) for (let end = start; end <= input.length; end++) ranges.push([start, end]);
      expect(parcelCheckpoints(input, ranges)).toEqual(parcelCheckpointsBrute(input, ranges));
    }
  });
  it("finds the first qualifying dock even across duplicates", () => {
    for (const input of arrays([-2, 0, 3], 5)) {
      const sorted = [...input].sort((a, b) => a - b);
      for (let load = -3; load <= 4; load++) expect(dockThreshold(sorted, load)).toBe(dockThresholdBrute(sorted, load));
    }
  });
  it("checks rolling dynamic programming against complete route search", () => {
    for (const input of arrays([0, 1, 4], 7).filter((a) => a.length >= 2)) expect(lanternSteps(input)).toBe(lanternStepsBrute(input));
  });
});

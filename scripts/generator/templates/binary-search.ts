import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ marks: z.array(z.int().min(-20).max(20)).max(14), level: z.int().min(-20).max(20) })
  .refine((i) => i.marks.every((m, n) => n === 0 || m >= i.marks[n - 1]), "Marks must be sorted");
type Input = z.infer<typeof input>;
export function tideMarkerBrute({ marks, level }: Input) {
  for (let j = 0; j < marks.length; j++) if (marks[j] > level) return j;
  return -1;
}
export function tideMarker({ marks, level }: Input) {
  let left = 0, right = marks.length;
  while (left < right) {
    const middle = left + Math.floor((right - left) / 2);
    if (marks[middle] > level) right = middle;
    else left = middle + 1;
  }
  return left === marks.length ? -1 : left;
}
export const binarySearch = defineTemplate({
  id: "tide-marker", title: "First Dry Tide Marker", pattern: "upper-bound",
  categories: ["arrays", "binary-search"], tags: ["monotone-search"], input,
  statement: "A harbor's marker heights are listed in nondecreasing order as marks. A marker is dry only when its height is strictly greater than the current water level. Return the zero-based index of the first dry marker. If every marker is submerged or the list is empty, return -1. A marker exactly at the water level is not dry. The input is one object { marks, level }.",
  constraints: ["0 <= marks.length <= 14; marks are sorted in nondecreasing order.", "Marker heights and level are integers from -20 through 20."],
  edges: [{ marks: [1, 3, 3, 7], level: 3 }, { marks: [2, 2], level: 2 }, { marks: [], level: 0 }, { marks: [-4], level: -5 }, { marks: [-20, 0, 20], level: 20 }, { marks: [0, 0, 0, 1], level: 0 }],
  random(r) { return { marks: Array.from({ length: r.int(0, 14) }, () => r.int(-20, 20)).sort((a, b) => a - b), level: r.int(-20, 20) }; },
  brute: tideMarkerBrute, optimal: tideMarker,
  bruteCode: "function tideMarkerBrute({ marks, level }) {\n    for (let j = 0; j < marks.length; j++)\n        if (marks[j] > level)\n            return j;\n    return -1;\n}",
  optimalCode: "function tideMarker({ marks, level }) {\n    let left = 0, right = marks.length;\n    while (left < right) {\n        const middle = left + Math.floor((right - left) / 2);\n        if (marks[middle] > level)\n            right = middle;\n        else\n            left = middle + 1;\n    }\n    return left === marks.length ? -1 : left;\n}",
  hints: ["Dry markers form a suffix in the sorted list.", "Equality belongs to the submerged side.", "Search the half-open interval [left, right).", "A dry midpoint may be the first dry marker, so retain it as the right boundary.", "A submerged midpoint moves left to middle+1; translate an endpoint equal to length into -1."],
  bruteApproach: "Scan from the beginning and return the first index whose height is strictly greater than level.",
  optimalApproach: "Binary search the first true value of marks[i] > level with right initially equal to length.",
  invariant: "Every index before left is submerged, and every index at or after right is dry. The unknown interval shrinks each iteration.",
  bruteTime: "O(n)", optimalTime: "O(log(n + 1))", optimalSpace: "O(1)",
  mistakes: ["Using >= and accepting markers at water level.", "Returning any dry marker instead of the first.", "Returning length instead of -1 when no marker is dry."],
});

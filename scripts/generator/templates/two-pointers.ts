import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ weights: z.array(z.int().min(0).max(40)).max(14), budget: z.int().min(0).max(80) })
  .refine((i) => i.weights.every((w, n) => n === 0 || w >= i.weights[n - 1]), "Weights must be sorted");
type Input = z.infer<typeof input>;

export function supplyPairsBrute({ weights, budget }: Input) {
  let count = 0;
  for (let left = 0; left < weights.length; left++) {
    for (let right = left + 1; right < weights.length; right++) {
      if (weights[left] + weights[right] <= budget) count++;
    }
  }
  return count;
}
export function supplyPairs({ weights, budget }: Input) {
  let left = 0, right = weights.length - 1, count = 0;
  while (left < right) {
    if (weights[left] + weights[right] <= budget) {
      count += right - left;
      left++;
    } else right--;
  }
  return count;
}
export const twoPointers = defineTemplate({
  id: "supply-pairs", title: "Pairwise Supply Packs", pattern: "two-pointers",
  categories: ["arrays", "two-pointers"], tags: ["linear-scan"], input,
  statement: "A relief depot lists pack weights in nondecreasing order. A courier takes exactly two distinct packs whose combined weight is at most budget. Return the number of index pairs (i, j) with i < j that fit. Equal weights at different indices are different packs. Zero or one pack gives zero pairs. The input is one object { weights, budget }.",
  constraints: ["0 <= weights.length <= 14; weights are sorted in nondecreasing order.", "Every weight is an integer from 0 through 40; budget is an integer from 0 through 80."],
  edges: [{ weights: [1, 2, 3, 4], budget: 5 }, { weights: [2, 2, 2], budget: 4 }, { weights: [], budget: 0 }, { weights: [0], budget: 0 }, { weights: [0, 0], budget: 0 }, { weights: [8, 9], budget: 1 }],
  random(r) { return { weights: Array.from({ length: r.int(0, 14) }, () => r.int(0, 40)).sort((a, b) => a - b), budget: r.int(0, 80) }; },
  brute: supplyPairsBrute, optimal: supplyPairs,
  bruteCode: "function supplyPairsBrute({ weights, budget }) {\n    let count = 0;\n    for (let left = 0; left < weights.length; left++) {\n        for (let right = left + 1; right < weights.length; right++) {\n            if (weights[left] + weights[right] <= budget)\n                count++;\n        }\n    }\n    return count;\n}",
  optimalCode: "function supplyPairs({ weights, budget }) {\n    let left = 0, right = weights.length - 1, count = 0;\n    while (left < right) {\n        if (weights[left] + weights[right] <= budget) {\n            count += right - left;\n            left++;\n        }\n        else\n            right--;\n    }\n    return count;\n}",
  hints: ["Packs are distinguished by index, including duplicate weights.", "The sorted order lets you rule out several pairs together.", "Place one pointer at each end.", "If the endpoints fit, all pairs from left to every index up to right fit.", "Add right-left and advance left when they fit; otherwise decrease right. Stop when pointers meet."],
  bruteApproach: "Enumerate each pair of distinct indices once and count pairs within the budget.",
  optimalApproach: "Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint.",
  invariant: "Every pair outside the remaining interval has been counted or ruled out exactly once. Sorted weights justify counting or excluding an entire endpoint.",
  bruteTime: "O(n²)", optimalTime: "O(n)", optimalSpace: "O(1)",
  mistakes: ["Counting distinct weight values instead of index pairs.", "Using < instead of <= for the budget.", "Using the same pack twice."],
});

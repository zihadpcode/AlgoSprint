import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ readings: z.array(z.int().min(-20).max(20)).min(1).max(14), width: z.int().min(1).max(14), threshold: z.int().min(-20).max(20) })
  .refine((i) => i.width <= i.readings.length, "Window must fit readings");
type Input = z.infer<typeof input>;
export function signalBurstBrute({ readings, width, threshold }: Input) {
  let best = 0;
  for (let start = 0; start + width <= readings.length; start++) {
    let count = 0;
    for (let j = start; j < start + width; j++) if (readings[j] >= threshold) count++;
    best = Math.max(best, count);
  }
  return best;
}
export function signalBurst({ readings, width, threshold }: Input) {
  let count = 0;
  for (let j = 0; j < width; j++) if (readings[j] >= threshold) count++;
  let best = count;
  for (let j = width; j < readings.length; j++) {
    if (readings[j - width] >= threshold) count--;
    if (readings[j] >= threshold) count++;
    best = Math.max(best, count);
  }
  return best;
}
export const slidingWindow = defineTemplate({
  id: "signal-burst", title: "Beacon Signal Burst", pattern: "fixed-window",
  categories: ["arrays", "sliding-window"], tags: ["fixed-window"], input,
  statement: "A field beacon records integer signal readings in time order. A reading is clear when it is at least threshold. Among all contiguous blocks of exactly width readings, return the largest number of clear readings. Return a count, not a sum or the block position. The input is one object { readings, width, threshold }.",
  constraints: ["1 <= width <= readings.length <= 14.", "Readings and threshold are integers from -20 through 20."],
  edges: [{ readings: [4, -1, 6, 5], width: 2, threshold: 4 }, { readings: [2, 2, 1], width: 3, threshold: 2 }, { readings: [-20], width: 1, threshold: -20 }, { readings: [0, 0], width: 1, threshold: 1 }, { readings: [1, 0, 1], width: 2, threshold: 1 }],
  random(r) { const readings = Array.from({ length: r.int(1, 14) }, () => r.int(-20, 20)); return { readings, width: r.int(1, readings.length), threshold: r.int(-20, 20) }; },
  brute: signalBurstBrute, optimal: signalBurst,
  bruteCode: "function signalBurstBrute({ readings, width, threshold }) {\n    let best = 0;\n    for (let start = 0; start + width <= readings.length; start++) {\n        let count = 0;\n        for (let j = start; j < start + width; j++)\n            if (readings[j] >= threshold)\n                count++;\n        best = Math.max(best, count);\n    }\n    return best;\n}",
  optimalCode: "function signalBurst({ readings, width, threshold }) {\n    let count = 0;\n    for (let j = 0; j < width; j++)\n        if (readings[j] >= threshold)\n            count++;\n    let best = count;\n    for (let j = width; j < readings.length; j++) {\n        if (readings[j - width] >= threshold)\n            count--;\n        if (readings[j] >= threshold)\n            count++;\n        best = Math.max(best, count);\n    }\n    return best;\n}",
  hints: ["Convert each reading mentally to clear or not clear.", "Consecutive candidate blocks overlap in all but two positions.", "Count clear readings in the first complete block.", "Remove the departing reading's contribution and add the arriving reading's contribution.", "Record the maximum after each shift, including the initial block."],
  bruteApproach: "For every complete block, inspect its width readings and count those at least the threshold.",
  optimalApproach: "Count the first block, then update its count using the one departing and one arriving reading. Track the largest count.",
  invariant: "Before updating the best count, count equals the number of clear readings in the current complete block.",
  bruteTime: "O(n × width)", optimalTime: "O(n)", optimalSpace: "O(1)",
  mistakes: ["Summing readings instead of counting qualifying readings.", "Forgetting the first block.", "Excluding readings equal to threshold."],
});

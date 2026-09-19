import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ credits: z.array(z.int().min(0).max(40)).max(14) });
type Input = z.infer<typeof input>;
export function workshopCreditsBrute({ credits }: Input) {
  let best = 0;
  for (let mask = 0; mask < 2 ** credits.length; mask++) {
    if ((mask & (mask << 1)) !== 0) continue;
    let total = 0;
    for (let j = 0; j < credits.length; j++) if ((mask & (1 << j)) !== 0) total += credits[j];
    best = Math.max(best, total);
  }
  return best;
}
export function workshopCredits({ credits }: Input) {
  let twoBack = 0, oneBack = 0;
  for (const credit of credits) {
    const current = Math.max(oneBack, twoBack + credit);
    twoBack = oneBack;
    oneBack = current;
  }
  return oneBack;
}
export const dynamicProgramming = defineTemplate({
  id: "workshop-credits", title: "Rest-Day Workshop Credits", pattern: "one-dimensional-dp",
  categories: ["arrays", "dynamic-programming"], tags: ["state-transition"], input,
  statement: "A community studio offers one workshop per day with the listed credits. Attending a workshop requires resting the following day, so no two selected day indices may be adjacent. Return the largest total credits you can earn. You may skip every workshop; an empty schedule earns zero. The input is one object { credits }.",
  constraints: ["0 <= credits.length <= 14.", "Each credit value is an integer from 0 through 40."],
  edges: [{ credits: [5, 9, 5] }, { credits: [0, 0] }, { credits: [] }, { credits: [7] }, { credits: [4, 4, 4, 4] }, { credits: [1, 10, 1, 10, 1] }],
  random(r) { return { credits: Array.from({ length: r.int(0, 14) }, () => r.int(0, 40)) }; },
  brute: workshopCreditsBrute, optimal: workshopCredits,
  bruteCode: "function workshopCreditsBrute({ credits }) {\n    let best = 0;\n    for (let mask = 0; mask < 2 ** credits.length; mask++) {\n        if ((mask & (mask << 1)) !== 0)\n            continue;\n        let total = 0;\n        for (let j = 0; j < credits.length; j++)\n            if ((mask & (1 << j)) !== 0)\n                total += credits[j];\n        best = Math.max(best, total);\n    }\n    return best;\n}",
  optimalCode: "function workshopCredits({ credits }) {\n    let twoBack = 0, oneBack = 0;\n    for (const credit of credits) {\n        const current = Math.max(oneBack, twoBack + credit);\n        twoBack = oneBack;\n        oneBack = current;\n    }\n    return oneBack;\n}",
  hints: ["Taking the largest single workshop first may block a better pair.", "At each day, compare attending with skipping.", "Attending uses the best total ending before the preceding day.", "Skipping retains the best total for all previous days.", "Use current = max(oneBack, twoBack + credit), then shift the two stored totals."],
  bruteApproach: "Enumerate every subset with a bit mask, reject adjacent selected bits, and maximize the selected credit sum. The fourteen-day bound keeps exhaustive validation small.",
  optimalApproach: "For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima.",
  invariant: "Before each day, oneBack is the optimum for all preceding days and twoBack excludes the immediately preceding day. The two choices cover every valid schedule.",
  bruteTime: "O(n × 2^n)", optimalTime: "O(n)", optimalSpace: "O(1)",
  mistakes: ["Greedily choosing the largest credit value.", "Updating twoBack before computing the current value.", "Forcing a workshop on an empty schedule."],
});

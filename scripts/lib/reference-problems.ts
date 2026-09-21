import { z } from "zod";
import { templateForSlug } from "../generator/registry";
import { libraryResult, LIBRARY } from "./reference-library";
import type { ProblemSeed } from "../../src/lib/validators/problem";

const ints = z.array(z.int().min(-1_000_000).max(1_000_000)).max(100_000);
const relayInput = z.strictObject({ loads: ints.min(1), width: z.int().positive() })
  .refine((i) => i.width <= i.loads.length, "Window must fit the input");
const badgeInput = z.strictObject({ badges: z.string().max(100_000).regex(/^[a-z]*$/) });
const parcelInput = z.strictObject({ parcels: ints, ranges: z.array(z.tuple([z.int().nonnegative(), z.int().nonnegative()])).max(100_000) })
  .refine((i) => i.ranges.every(([a, b]) => a <= b && b <= i.parcels.length), "Invalid half-open range");
const dockInput = z.strictObject({ capacities: ints, load: z.int().min(-1_000_000).max(1_000_000) })
  .refine((i) => i.capacities.every((n, k) => k === 0 || n >= i.capacities[k - 1]), "Capacities must be sorted");
const lanternInput = z.strictObject({ costs: z.array(z.int().min(0).max(1000)).min(2).max(100_000) });

export function relayWindow(loads: number[], width: number) {
  let total = 0;
  for (let i = 0; i < width; i++) total += loads[i];
  let best = total;
  for (let i = width; i < loads.length; i++) {
    total += loads[i] - loads[i - width];
    best = Math.max(best, total);
  }
  return best;
}

export function relayWindowBrute(loads: number[], width: number) {
  let best = -Infinity;
  for (let start = 0; start + width <= loads.length; start++) {
    let total = 0;
    for (let i = start; i < start + width; i++) total += loads[i];
    best = Math.max(best, total);
  }
  return best;
}

export function quietBadge(badges: string) {
  const counts = new Map<string, number>();
  for (const badge of badges) counts.set(badge, (counts.get(badge) ?? 0) + 1);
  for (let i = 0; i < badges.length; i++) if (counts.get(badges[i]) === 1) return i;
  return -1;
}

export function quietBadgeBrute(badges: string) {
  for (let i = 0; i < badges.length; i++) {
    let count = 0;
    for (const badge of badges) if (badge === badges[i]) count++;
    if (count === 1) return i;
  }
  return -1;
}

export function parcelCheckpoints(parcels: number[], ranges: [number, number][]) {
  const prefix = [0];
  for (const count of parcels) prefix.push(prefix[prefix.length - 1] + count);
  return ranges.map(([start, end]) => prefix[end] - prefix[start]);
}

export function parcelCheckpointsBrute(parcels: number[], ranges: [number, number][]) {
  return ranges.map(([start, end]) => {
    let sum = 0;
    for (let i = start; i < end; i++) sum += parcels[i];
    return sum;
  });
}

export function dockThreshold(capacities: number[], load: number) {
  let left = 0;
  let right = capacities.length;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (capacities[mid] >= load) right = mid;
    else left = mid + 1;
  }
  return left === capacities.length ? -1 : left;
}

export function dockThresholdBrute(capacities: number[], load: number) {
  for (let i = 0; i < capacities.length; i++) if (capacities[i] >= load) return i;
  return -1;
}

export function lanternSteps(costs: number[]) {
  let twoBack = 0;
  let oneBack = 0;
  for (let step = 2; step <= costs.length; step++) {
    const current = Math.min(oneBack + costs[step - 1], twoBack + costs[step - 2]);
    twoBack = oneBack;
    oneBack = current;
  }
  return oneBack;
}

// Used only for bounded differential tests, never large imported fixtures.
export function lanternStepsBrute(costs: number[]) {
  function visit(step: number): number {
    if (step >= costs.length) return 0;
    return costs[step] + Math.min(visit(step + 1), visit(step + 2));
  }
  return Math.min(visit(0), visit(1));
}

// Allowlisted, authored reference code. JSON code strings are NEVER evaluated.
export function referenceResult(slug: string, input: unknown): unknown {
  if (Object.hasOwn(LIBRARY, slug)) return libraryResult(slug, input);
  switch (slug) {
    case "relay-window": { const i = relayInput.parse(input); return relayWindow(i.loads, i.width); }
    case "quiet-badge": { const i = badgeInput.parse(input); return quietBadge(i.badges); }
    case "parcel-checkpoints": { const i = parcelInput.parse(input); return parcelCheckpoints(i.parcels, i.ranges); }
    case "dock-threshold": { const i = dockInput.parse(input); return dockThreshold(i.capacities, i.load); }
    case "lantern-steps": { const i = lanternInput.parse(input); return lanternSteps(i.costs); }
    default: {
      const template = templateForSlug(slug);
      if (template) return template.evaluate(input, "optimal");
      throw new Error(`No trusted reference validator for ${slug}. Add one before seeding.`);
    }
  }
}

export function validateProblemSemantics(problem: ProblemSeed) {
  for (const [kind, cases] of [["example", problem.examples], ["test", problem.testCases]] as const) {
    for (const item of cases) {
      const expected = referenceResult(problem.slug, item.input);
      if (JSON.stringify(expected) !== JSON.stringify(item.output)) {
        throw new Error(`${problem.slug}: ${kind} ${item.position} has an incorrect expected output.`);
      }
    }
  }
}

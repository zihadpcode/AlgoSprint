import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ changes: z.array(z.int().min(-20).max(20)).max(14), spans: z.array(z.tuple([z.int().min(0).max(14), z.int().min(0).max(14)])).max(14) })
  .refine((i) => i.spans.every(([a, b]) => a <= b && b <= i.changes.length), "Invalid half-open span");
type Input = z.infer<typeof input>;
export function reservoirSpansBrute({ changes, spans }: Input) {
  const result = [];
  for (const [start, end] of spans) {
    let sum = 0;
    for (let j = start; j < end; j++) sum += changes[j];
    result.push(sum);
  }
  return result;
}
export function reservoirSpans({ changes, spans }: Input) {
  const prefix = [0];
  for (const value of changes) prefix.push(prefix[prefix.length - 1] + value);
  return spans.map(([start, end]) => prefix[end] - prefix[start]);
}
export const prefixSum = defineTemplate({
  id: "reservoir-spans", title: "Reservoir Ledger Spans", pattern: "prefix-sum",
  categories: ["arrays"], tags: ["prefix-sum"], input,
  statement: "A reservoir ledger records signed changes: inflow is positive and outflow is negative. For each requested span [start, end), return the net change from start inclusive to end exclusive. Keep answers in request order. An empty span has net change zero; no spans produces an empty answer array. The input is one object { changes, spans }.",
  constraints: ["0 <= changes.length <= 14; each change is an integer from -20 through 20.", "There are at most 14 spans; each has integer endpoints 0 <= start <= end <= changes.length."],
  edges: [{ changes: [5, -3, 2], spans: [[0, 3], [1, 2]] }, { changes: [4, -4], spans: [[0, 2], [1, 1]] }, { changes: [], spans: [[0, 0]] }, { changes: [-2], spans: [] }, { changes: [-20, -20], spans: [[0, 1], [0, 2], [0, 1]] }],
  random(r) { const changes = Array.from({ length: r.int(0, 14) }, () => r.int(-20, 20)); const spans: [number, number][] = Array.from({ length: r.int(0, 14) }, () => { const a = r.int(0, changes.length); return [a, r.int(a, changes.length)]; }); return { changes, spans }; },
  brute: reservoirSpansBrute, optimal: reservoirSpans,
  bruteCode: "function reservoirSpansBrute({ changes, spans }) {\n    const result = [];\n    for (const [start, end] of spans) {\n        let sum = 0;\n        for (let j = start; j < end; j++)\n            sum += changes[j];\n        result.push(sum);\n    }\n    return result;\n}",
  optimalCode: "function reservoirSpans({ changes, spans }) {\n    const prefix = [0];\n    for (const value of changes)\n        prefix.push(prefix[prefix.length - 1] + value);\n    return spans.map(([start, end]) => prefix[end] - prefix[start]);\n}",
  hints: ["Different requests may repeat many of the same ledger entries.", "Store the sum before each ledger position.", "Start with a zero prefix for the empty beginning.", "The net change before end includes the net change before start.", "Subtract prefix[start] from prefix[end] for each request in its original order."],
  bruteApproach: "Sum the entries from start up to but excluding end independently for each span.",
  optimalApproach: "Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals.",
  invariant: "prefix[k] equals the sum of the first k entries. Subtraction cancels exactly the entries before start.",
  bruteTime: "O(n × q)", optimalTime: "O(n + q)", optimalSpace: "O(n) auxiliary, O(q) output",
  mistakes: ["Treating end as inclusive.", "Dropping negative changes.", "Sorting requests and losing their original order."],
});

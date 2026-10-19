import { z } from "zod";
import type { ExpansionEntry, Rng } from "./reference-expansion";

// Trusted references for library batch 6. Same contract as reference-expansion.ts: a strict input schema, the typed
// reference that computes expected outputs, an independent brute-force baseline and a seeded sampler. JSON code strings
// from seed files are NEVER evaluated here.

type Solver = (...args: never[]) => unknown;
const entry = <S extends z.ZodType>(input: S, solve: Solver, brute: Solver, sample: (rng: Rng) => Record<string, unknown>): ExpansionEntry =>
  ({ input, solve, brute, sample });

const ints = (rng: Rng, length: number, min: number, max: number) => Array.from({ length }, () => rng.int(min, max));
const randomWord = (rng: Rng, length: number, alphabet = "abc") => Array.from({ length }, () => rng.pick([...alphabet])).join("");
// Seeded Fisher-Yates. Never shuffle with a random sort comparator.
function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// ---------- Switch Gap: largest distance between neighbouring set bits ----------

const U31 = 2 ** 31 - 1;
export const switchGapInput = z.strictObject({ mask: z.int().min(0).max(U31) });
export function switchGap(mask: number) {
  let remaining = mask, previous = -1, best = 0;
  while (remaining > 0) {
    // The lowest set bit is isolated, its position read from the leading-zero count, then cleared.
    const position = 31 - Math.clz32(remaining & -remaining);
    if (previous >= 0) best = Math.max(best, position - previous);
    previous = position;
    remaining &= remaining - 1;
  }
  return best;
}
function switchGapBrute(mask: number) {
  const bit = (i: number) => Math.floor(mask / 2 ** i) % 2 === 1;
  let best = 0;
  for (let i = 0; i < 31; i++) for (let j = i + 1; j < 31; j++) {
    if (!bit(i) || !bit(j)) continue;
    let neighbours = true;
    for (let k = i + 1; k < j; k++) if (bit(k)) neighbours = false;
    if (neighbours) best = Math.max(best, j - i);
  }
  return best;
}

// ---------- Merge Point: first shared stop of two routes in a pooled next[] array ----------

export const mergePointInput = z.strictObject({
  next: z.array(z.int().min(-1).max(9_999)).min(1).max(10_000),
  headA: z.int().min(0).max(9_999),
  headB: z.int().min(0).max(9_999),
}).superRefine((input, ctx) => {
  const n = input.next.length;
  if (input.next.some((target) => target >= n)) ctx.addIssue({ code: "custom", message: "Every next entry must be -1 or a valid stop index" });
  if (input.headA >= n || input.headB >= n) ctx.addIssue({ code: "custom", message: "Route heads must be valid stop indexes" });
  if (ctx.issues.length) return;
  // The whole pool must be acyclic: 0 = unseen, 1 = on the current walk, 2 = known to end.
  const state = new Uint8Array(n);
  for (let start = 0; start < n; start++) {
    const walk: number[] = [];
    let at = start;
    while (at !== -1 && state[at] === 0) { state[at] = 1; walk.push(at); at = input.next[at]; }
    if (at !== -1 && state[at] === 1) { ctx.addIssue({ code: "custom", message: "Routes must not loop back on themselves" }); return; }
    for (const stop of walk) state[stop] = 2;
  }
});
export function mergePoint(next: number[], headA: number, headB: number) {
  // Each pointer walks its own route, then continues along the other one. Both cover lenA + lenB steps, so they meet at
  // the first shared stop, or both reach -1 on the same step when the routes never join.
  let a = headA, b = headB;
  while (a !== b) {
    a = a === -1 ? headB : next[a];
    b = b === -1 ? headA : next[b];
  }
  return a;
}
function mergePointBrute(next: number[], headA: number, headB: number) {
  for (let a = headA; a !== -1; a = next[a]) for (let b = headB; b !== -1; b = next[b]) if (a === b) return a;
  return -1;
}

// ---------- Sensor Ring: fixed-size overwrite buffer ----------

const readingValue = z.int().min(-1_000_000).max(1_000_000);
const ringOp = z.union([
  z.tuple([z.literal("write"), readingValue]), z.tuple([z.literal("read")]), z.tuple([z.literal("newest")]), z.tuple([z.literal("size")]),
]);
type RingOp = z.infer<typeof ringOp>;
export const sensorRingInput = z.strictObject({ capacity: z.int().min(1).max(1000), operations: z.array(ringOp).max(10_000) });
export function sensorRing(capacity: number, operations: RingOp[]) {
  const slots = new Array<number>(capacity).fill(0);
  let head = 0, count = 0;
  const out: (number | null)[] = [];
  for (const op of operations) {
    if (op[0] === "write") {
      if (count === capacity) { slots[head] = op[1]; head = (head + 1) % capacity; }
      else { slots[(head + count) % capacity] = op[1]; count++; }
    } else if (op[0] === "read") {
      if (count === 0) out.push(null);
      else { out.push(slots[head]); head = (head + 1) % capacity; count--; }
    } else if (op[0] === "newest") out.push(count === 0 ? null : slots[(head + count - 1) % capacity]);
    else out.push(count);
  }
  return out;
}
function sensorRingBrute(capacity: number, operations: RingOp[]) {
  const kept: number[] = [];
  const out: (number | null)[] = [];
  for (const op of operations) {
    if (op[0] === "write") { kept.push(op[1]); if (kept.length > capacity) kept.shift(); }
    else if (op[0] === "read") out.push(kept.length ? kept.shift()! : null);
    else if (op[0] === "newest") out.push(kept.length ? kept[kept.length - 1] : null);
    else out.push(kept.length);
  }
  return out;
}

// ---------- Rival Teams: can the rivalries be split across two cabins? ----------

export const rivalTeamsInput = z.strictObject({
  campers: z.int().min(1).max(10_000),
  rivalries: z.array(z.tuple([z.int().min(0).max(9_999), z.int().min(0).max(9_999)])).max(20_000),
}).refine((i) => i.rivalries.every(([a, b]) => a < i.campers && b < i.campers && a !== b), "Rivalries must name two different existing campers");
export function rivalTeams(campers: number, rivalries: [number, number][]) {
  const adjacent: number[][] = Array.from({ length: campers }, () => []);
  for (const [a, b] of rivalries) { adjacent[a].push(b); adjacent[b].push(a); }
  const cabin = new Int8Array(campers).fill(-1);
  const queue = new Int32Array(campers);
  for (let start = 0; start < campers; start++) {
    if (cabin[start] !== -1) continue;
    cabin[start] = 0;
    let head = 0, tail = 0;
    queue[tail++] = start;
    while (head < tail) {
      const at = queue[head++];
      for (const other of adjacent[at]) {
        if (cabin[other] === -1) { cabin[other] = 1 - cabin[at]; queue[tail++] = other; }
        else if (cabin[other] === cabin[at]) return false;
      }
    }
  }
  return true;
}
function rivalTeamsBrute(campers: number, rivalries: [number, number][]) {
  if (campers > 22) throw new Error("The exhaustive baseline only supports small groups");
  for (let split = 0; split < 2 ** campers; split++) {
    if (rivalries.every(([a, b]) => ((split >> a) & 1) !== ((split >> b) & 1))) return true;
  }
  return false;
}

// ---------- Parallel Stages: fewest rounds respecting prerequisites ----------

export const parallelStagesInput = z.strictObject({
  tasks: z.int().min(1).max(5000),
  prerequisites: z.array(z.tuple([z.int().min(0).max(4999), z.int().min(0).max(4999)])).max(20_000),
}).refine((i) => i.prerequisites.every(([a, b]) => a < i.tasks && b < i.tasks && a !== b), "Prerequisites must name two different existing tasks");
export function parallelStages(tasks: number, prerequisites: [number, number][]) {
  const unlocks: number[][] = Array.from({ length: tasks }, () => []);
  const waiting = new Array<number>(tasks).fill(0);
  for (const [before, after] of prerequisites) { unlocks[before].push(after); waiting[after]++; }
  let ready: number[] = [];
  for (let task = 0; task < tasks; task++) if (waiting[task] === 0) ready.push(task);
  let stages = 0, finished = 0;
  while (ready.length) {
    stages++;
    finished += ready.length;
    const nextReady: number[] = [];
    for (const task of ready) for (const after of unlocks[task]) if (--waiting[after] === 0) nextReady.push(after);
    ready = nextReady;
  }
  return finished === tasks ? stages : -1;
}
function parallelStagesBrute(tasks: number, prerequisites: [number, number][]) {
  // Bellman-Ford style relaxation of "earliest stage" values; a value still changing after `tasks` rounds means a loop.
  const stage = new Array<number>(tasks).fill(1);
  for (let round = 0; round <= tasks; round++) {
    let changed = false;
    for (const [before, after] of prerequisites) if (stage[after] < stage[before] + 1) { stage[after] = stage[before] + 1; changed = true; }
    if (!changed) return Math.max(...stage);
  }
  return -1;
}

// ---------- Laser Shots: fewest vertical shots to hit every closed span ----------

export const laserShotsInput = z.strictObject({
  panels: z.array(z.tuple([z.int().min(-1_000_000).max(1_000_000), z.int().min(-1_000_000).max(1_000_000)])
    .refine(([left, right]) => left <= right, "A panel must not end before it starts")).max(10_000),
});
export function laserShots(panels: [number, number][]) {
  const byRightEdge = panels.map(([l, r]) => [l, r] as [number, number]).sort((a, b) => a[1] - b[1]);
  let shots = 0, lastShot = -Infinity;
  for (const [left, right] of byRightEdge) {
    if (left > lastShot) { shots++; lastShot = right; }
  }
  return shots;
}
function laserShotsBrute(panels: [number, number][]) {
  const candidates = [...new Set(panels.flatMap(([l, r]) => [l, r]))];
  if (candidates.length > 20) throw new Error("The exhaustive baseline only supports small walls");
  let best = Infinity;
  for (let chosen = 0; chosen < 2 ** candidates.length; chosen++) {
    const positions = candidates.filter((_, i) => (chosen >> i) & 1);
    if (positions.length < best && panels.every(([l, r]) => positions.some((x) => l <= x && x <= r))) best = positions.length;
  }
  return best;
}

// ---------- Exact Flags: stretches with exactly k odd readings ----------

export const exactFlagsInput = z.strictObject({
  readings: z.array(z.int().min(-1_000_000).max(1_000_000)).min(1).max(10_000),
  k: z.int().min(0).max(10_000),
});
const isOdd = (value: number) => Math.abs(value) % 2 === 1;
export function exactFlags(readings: number[], k: number) {
  const atMost = (limit: number) => {
    if (limit < 0) return 0;
    let left = 0, odd = 0, stretches = 0;
    for (let right = 0; right < readings.length; right++) {
      if (isOdd(readings[right])) odd++;
      while (odd > limit) { if (isOdd(readings[left])) odd--; left++; }
      stretches += right - left + 1;
    }
    return stretches;
  };
  return atMost(k) - atMost(k - 1);
}
function exactFlagsBrute(readings: number[], k: number) {
  let total = 0;
  for (let start = 0; start < readings.length; start++) {
    let odd = 0;
    for (let end = start; end < readings.length; end++) {
      if (isOdd(readings[end])) odd++;
      if (odd === k) total++;
    }
  }
  return total;
}

// ---------- Digit Power: base^e mod m for an enormous e given as decimal digits ----------

export const digitPowerInput = z.strictObject({
  base: z.int().min(0).max(1_000_000_000),
  digits: z.array(z.int().min(0).max(9)).min(1).max(2000),
  modulus: z.int().min(1).max(1_000_000),
}).refine((i) => i.digits[0] !== 0, "The exponent must be positive and written without leading zeros");
export function digitPower(base: number, digits: number[], modulus: number) {
  // Operands stay below 1,000,000, so every product is below 1e12 and exact in a double.
  const smallPower = (value: number, exponent: number) => {
    let result = 1 % modulus, factor = value % modulus;
    while (exponent > 0) {
      if (exponent & 1) result = (result * factor) % modulus;
      factor = (factor * factor) % modulus;
      exponent >>= 1;
    }
    return result;
  };
  // Appending digit d turns exponent x into 10x + d, and a^(10x + d) = (a^x)^10 * a^d.
  let result = 1 % modulus;
  for (const digit of digits) result = (smallPower(result, 10) * smallPower(base, digit)) % modulus;
  return result;
}
function digitPowerBrute(base: number, digits: number[], modulus: number) {
  return Number((BigInt(base) ** BigInt(digits.join(""))) % BigInt(modulus));
}

// ---------- Ring Router: consistent-hash style routing with servers joining and leaving ----------

const serverName = z.string().regex(/^[a-z]{1,10}$/);
const ringPosition = z.int().min(0).max(1_000_000_000);
const routerOp = z.union([
  z.tuple([z.literal("add"), serverName, ringPosition]), z.tuple([z.literal("remove"), serverName]), z.tuple([z.literal("route"), ringPosition]),
]);
type RouterOp = z.infer<typeof routerOp>;
// These authoring caps were chosen for the former 90,000-byte output budget. Every route may answer a 10-letter name
// (13 bytes with quotes and comma), so 6,000 operations keep output near 78,000 bytes, below the current shared budget.
// tests/reference-batch6.test.ts checks output separately from the stored-test stdin budget.
export const ringRouterInput = z.strictObject({ operations: z.array(routerOp).max(6_000) });
export function ringRouter(operations: RouterOp[]) {
  const positions: number[] = [];   // sorted ascending
  const names: string[] = [];       // names[i] sits at positions[i]
  const where = new Map<string, number>();
  const lowerBound = (target: number) => {
    let low = 0, high = positions.length;
    while (low < high) {
      const mid = low + ((high - low) >> 1);
      if (positions[mid] >= target) high = mid; else low = mid + 1;
    }
    return low;
  };
  const out: (boolean | string | null)[] = [];
  for (const op of operations) {
    if (op[0] === "add") {
      const at = lowerBound(op[2]);
      if (where.has(op[1]) || positions[at] === op[2]) { out.push(false); continue; }
      positions.splice(at, 0, op[2]); names.splice(at, 0, op[1]); where.set(op[1], op[2]);
      out.push(true);
    } else if (op[0] === "remove") {
      const position = where.get(op[1]);
      if (position === undefined) { out.push(false); continue; }
      const at = lowerBound(position);
      positions.splice(at, 1); names.splice(at, 1); where.delete(op[1]);
      out.push(true);
    } else {
      if (positions.length === 0) out.push(null);
      else { const at = lowerBound(op[1]); out.push(names[at === positions.length ? 0 : at]); }
    }
  }
  return out;
}
function ringRouterBrute(operations: RouterOp[]) {
  let servers: { name: string; position: number }[] = [];
  const out: (boolean | string | null)[] = [];
  for (const op of operations) {
    if (op[0] === "add") {
      if (servers.some((s) => s.name === op[1] || s.position === op[2])) out.push(false);
      else { servers.push({ name: op[1], position: op[2] }); out.push(true); }
    } else if (op[0] === "remove") {
      const before = servers.length;
      servers = servers.filter((s) => s.name !== op[1]);
      out.push(servers.length !== before);
    } else {
      const key = op[1];
      const atOrAfter = servers.filter((s) => s.position >= key);
      const pool = atOrAfter.length ? atOrAfter : servers;
      out.push(pool.length ? pool.reduce((best, s) => (s.position < best.position ? s : best)).name : null);
    }
  }
  return out;
}

// ---------- Elevation Ledger: weighted union-find over height differences ----------

// Every statement may answer "conflict" (10 bytes with quotes, 11 with the comma). The 7,000-statement authoring cap was
// chosen for the former 90,000-byte output budget and keeps output near 77,000 bytes, below the current shared budget.
export const elevationLedgerInput = z.strictObject({
  benchmarks: z.int().min(2).max(10_000),
  statements: z.array(z.tuple([z.int().min(0).max(9_999), z.int().min(0).max(9_999), z.int().min(-1_000_000).max(1_000_000)])).max(7_000),
}).refine((i) => i.statements.every(([a, b]) => a < i.benchmarks && b < i.benchmarks && a !== b), "Statements must compare two different existing benchmarks");
export function elevationLedger(benchmarks: number, statements: [number, number, number][]) {
  const parent = Array.from({ length: benchmarks }, (_, i) => i);
  const size = new Array<number>(benchmarks).fill(1);
  const offset = new Array<number>(benchmarks).fill(0); // height[x] - height[parent[x]]
  // Iterative find with full path compression; returns the root and sets rise to height[x] - height[root].
  let rise = 0;
  const find = (x: number) => {
    const path: number[] = [];
    let root = x;
    while (parent[root] !== root) { path.push(root); root = parent[root]; }
    // Walk back from the node nearest the root so each offset can be rewritten relative to the root.
    let accumulated = 0;
    for (let i = path.length - 1; i >= 0; i--) {
      accumulated += offset[path[i]];
      offset[path[i]] = accumulated;
      parent[path[i]] = root;
    }
    rise = x === root ? 0 : offset[x];
    return root;
  };
  const out: string[] = [];
  for (const [a, b, d] of statements) {
    const rootA = find(a), riseA = rise;
    const rootB = find(b), riseB = rise;
    // height[a] - height[b] = d  =>  height[rootA] - height[rootB] = d - riseA + riseB.
    const rootGap = d - riseA + riseB;
    if (rootA === rootB) { out.push(riseA - riseB === d ? "known" : "conflict"); continue; }
    if (size[rootA] <= size[rootB]) { parent[rootA] = rootB; offset[rootA] = rootGap; size[rootB] += size[rootA]; }
    else { parent[rootB] = rootA; offset[rootB] = -rootGap; size[rootA] += size[rootB]; }
    out.push("new");
  }
  return out;
}
function elevationLedgerBrute(benchmarks: number, statements: [number, number, number][]) {
  const edges: [number, number][][] = Array.from({ length: benchmarks }, () => []);
  const out: string[] = [];
  for (const [a, b, d] of statements) {
    // Search the accepted statements for a walk from a to b, tracking height[at] - height[a].
    const gap = new Map<number, number>([[a, 0]]);
    const stack = [a];
    while (stack.length) {
      const at = stack.pop()!;
      for (const [other, delta] of edges[at]) if (!gap.has(other)) { gap.set(other, gap.get(at)! + delta); stack.push(other); }
    }
    if (!gap.has(b)) {
      edges[a].push([b, -d]); edges[b].push([a, d]);
      out.push("new");
    } else out.push(gap.get(b) === -d ? "known" : "conflict");
  }
  return out;
}

// ---------- Suffix Alarm: does any forbidden word end the stream so far? ----------

export const suffixAlarmInput = z.strictObject({
  words: z.array(z.string().regex(/^[a-z]{1,20}$/)).min(1).max(1000),
  stream: z.string().max(10_000).regex(/^[a-z]*$/),
});
export function suffixAlarm(words: string[], stream: string) {
  // Reversed trie: a word's last letter is the first edge, so a stream suffix is matched by walking backwards.
  const longest = Math.max(...words.map((w) => w.length));
  const total = words.reduce((sum, w) => sum + w.length, 0);
  const child = new Int32Array(26 * (total + 1));
  const terminal = new Uint8Array(total + 1);
  let nodes = 1;
  for (const word of words) {
    let at = 0;
    for (let i = word.length - 1; i >= 0; i--) {
      const slot = at * 26 + word.charCodeAt(i) - 97;
      if (child[slot] === 0) child[slot] = nodes++;
      at = child[slot];
    }
    terminal[at] = 1;
  }
  const out: boolean[] = [];
  for (let end = 0; end < stream.length; end++) {
    let at = 0, hit = false;
    for (let i = end; i >= 0 && i > end - longest; i--) {
      at = child[at * 26 + stream.charCodeAt(i) - 97];
      if (at === 0) break;
      if (terminal[at]) { hit = true; break; }
    }
    out.push(hit);
  }
  return out;
}
function suffixAlarmBrute(words: string[], stream: string) {
  return [...stream].map((_, end) => { const seen = stream.slice(0, end + 1); return words.some((w) => seen.endsWith(w)); });
}

// ---------- Grove Harvest: largest total of an ordered (strict BST) subtree ----------

const harvestValue = z.int().min(-100_000).max(100_000);
// Level-order encoding with null for a missing child. Entries are counted as serialized, nulls included. The encoding is
// canonical: the root is present, the last entry is not null, and no entry belongs to a missing parent.
export const groveHarvestInput = z.strictObject({
  tree: z.array(z.union([harvestValue, z.null()])).min(1).max(10_000),
}).superRefine((input, ctx) => {
  const tree = input.tree;
  if (tree[0] === null) { ctx.addIssue({ code: "custom", message: "The root must not be null" }); return; }
  if (tree[tree.length - 1] === null) { ctx.addIssue({ code: "custom", message: "The last entry must not be null" }); return; }
  let waiting = 1, index = 1;
  while (waiting > 0 && index < tree.length) {
    waiting--;
    if (tree[index++] !== null) waiting++;
    if (index < tree.length && tree[index++] !== null) waiting++;
  }
  if (index < tree.length) ctx.addIssue({ code: "custom", message: "Entries listed for a missing parent" });
});
function decodeTree(tree: (number | null)[]) {
  const value: number[] = [], left: number[] = [], right: number[] = [];
  value.push(tree[0] as number); left.push(-1); right.push(-1);
  let index = 1;
  for (let node = 0; node < value.length && index < tree.length; node++) {
    for (const side of [left, right]) {
      if (index >= tree.length) break;
      const entry = tree[index++];
      if (entry !== null) { side[node] = value.length; value.push(entry); left.push(-1); right.push(-1); }
    }
  }
  return { value, left, right };
}
export function groveHarvest(tree: (number | null)[]) {
  const { value, left, right } = decodeTree(tree);
  const n = value.length;
  // Children always come after their parent in level order, so a reverse sweep is a post-order pass.
  const ordered = new Uint8Array(n), sum = new Array<number>(n).fill(0), low = new Array<number>(n).fill(0), high = new Array<number>(n).fill(0);
  let best = 0;
  for (let node = n - 1; node >= 0; node--) {
    const l = left[node], r = right[node];
    const leftOk = l === -1 || (ordered[l] === 1 && high[l] < value[node]);
    const rightOk = r === -1 || (ordered[r] === 1 && low[r] > value[node]);
    if (!leftOk || !rightOk) continue;
    ordered[node] = 1;
    sum[node] = value[node] + (l === -1 ? 0 : sum[l]) + (r === -1 ? 0 : sum[r]);
    low[node] = l === -1 ? value[node] : low[l];
    high[node] = r === -1 ? value[node] : high[r];
    best = Math.max(best, sum[node]);
  }
  return best;
}
function groveHarvestBrute(tree: (number | null)[]) {
  const { value, left, right } = decodeTree(tree);
  let best = 0;
  for (let root = 0; root < value.length; root++) {
    // In-order walk of this subtree; a strict BST reads strictly increasing.
    const walked: number[] = [];
    const stack: number[] = [];
    let at = root;
    while (at !== -1 || stack.length) {
      while (at !== -1) { stack.push(at); at = left[at]; }
      at = stack.pop()!;
      walked.push(value[at]);
      at = right[at];
    }
    if (walked.every((v, i) => i === 0 || walked[i - 1] < v)) best = Math.max(best, walked.reduce((a, b) => a + b, 0));
  }
  return best;
}

// ---------- Crew Cover: fewest volunteers whose skill masks cover every skill ----------

export const crewCoverInput = z.strictObject({
  skills: z.int().min(1).max(16),
  volunteers: z.array(z.int().min(0).max(65_535)).min(1).max(60),
}).refine((i) => i.volunteers.every((mask) => mask < 2 ** i.skills), "A volunteer mask may only use bits below skills");
export function crewCover(skills: number, volunteers: number[]) {
  const full = (1 << skills) - 1;
  const fewest = new Int32Array(full + 1).fill(1_000);
  fewest[0] = 0;
  for (const mask of volunteers) {
    if (mask === 0) continue;
    // Reusing a volunteer never lowers a count, so one in-place pass per volunteer is exact.
    for (let covered = 0; covered <= full; covered++) {
      const merged = covered | mask;
      if (fewest[covered] + 1 < fewest[merged]) fewest[merged] = fewest[covered] + 1;
    }
  }
  return fewest[full] >= 1_000 ? -1 : fewest[full];
}
function crewCoverBrute(skills: number, volunteers: number[]) {
  if (volunteers.length > 20) throw new Error("The exhaustive baseline only supports small rosters");
  const full = 2 ** skills - 1;
  let best = Infinity;
  for (let chosen = 0; chosen < 2 ** volunteers.length; chosen++) {
    let covered = 0, count = 0;
    for (let i = 0; i < volunteers.length; i++) if ((chosen >> i) & 1) { covered |= volunteers[i]; count++; }
    if (covered === full && count < best) best = count;
  }
  return best === Infinity ? -1 : best;
}

// ---------- Samplers ----------

type Tree = { value: number; left: Tree | null; right: Tree | null };
function serialize(root: Tree | null): (number | null)[] {
  const out: (number | null)[] = [];
  const queue: (Tree | null)[] = [root];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    out.push(node ? node.value : null);
    if (node) queue.push(node.left, node.right);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
function sampleGroveTree(rng: Rng): (number | null)[] {
  const size = rng.int(1, 12);
  const root: Tree = { value: 0, left: null, right: null };
  const nodes = [root];
  while (nodes.length < size) {
    const parent = rng.pick(nodes);
    const side = rng.chance(0.5) ? "left" : "right";
    if (!parent[side]) { const node: Tree = { value: 0, left: null, right: null }; parent[side] = node; nodes.push(node); }
  }
  if (rng.chance(0.65)) {
    // Mostly ordered: hand out increasing values in in-order, then occasionally spoil one or two of them.
    let next = rng.int(-6, 3);
    const assign = (node: Tree | null) => { if (!node) return; assign(node.left); node.value = next; next += rng.int(1, 3); assign(node.right); };
    assign(root);
    for (let spoil = rng.int(0, 2); spoil > 0; spoil--) rng.pick(nodes).value = rng.int(-9, 9);
  } else for (const node of nodes) node.value = rng.int(-9, 9);
  return serialize(root);
}

function sampleMergePoint(rng: Rng) {
  // Pool layout: [shared tail][A-only prefix][B-only prefix]; an unjoined route simply ends in its own -1.
  const tail = rng.int(0, 4), aOnly = rng.int(0, 4), bOnly = rng.int(0, 4), join = rng.chance(0.65);
  const n = Math.max(1, tail + aOnly + bOnly + (join ? 0 : 1));
  const next = new Array<number>(n).fill(-1);
  const order = shuffle(rng, Array.from({ length: n }, (_, i) => i)); // label stops in a shuffled order
  const tailIds = order.slice(0, tail), aIds = order.slice(tail, tail + aOnly), bIds = order.slice(tail + aOnly, tail + aOnly + bOnly);
  const spare = order.slice(tail + aOnly + bOnly);
  for (let i = 0; i + 1 < tailIds.length; i++) next[tailIds[i]] = tailIds[i + 1];
  const chain = (ids: number[], into: number) => { for (let i = 0; i < ids.length; i++) next[ids[i]] = i + 1 < ids.length ? ids[i + 1] : into; };
  chain(aIds, join && tailIds.length ? tailIds[0] : -1);
  chain(bIds, join && tailIds.length ? tailIds[0] : -1);
  const headOf = (ids: number[]) => (ids.length ? ids[0] : join && tailIds.length ? tailIds[0] : spare.length ? spare[0] : order[0]);
  return { next, headA: headOf(aIds), headB: headOf(bIds) };
}

function sampleEdges(rng: Rng, n: number, maxEdges: number): [number, number][] {
  const edges: [number, number][] = [];
  if (n < 2) return edges;
  for (let k = rng.int(0, maxEdges); k > 0; k--) {
    const a = rng.int(0, n - 1);
    let b = rng.int(0, n - 2);
    if (b >= a) b++;
    edges.push([a, b]);
  }
  return edges;
}

function sampleRival(rng: Rng) {
  const campers = rng.int(1, 9);
  if (campers < 2 || rng.chance(0.3)) return { campers, rivalries: sampleEdges(rng, campers, campers + 3) };
  // Plant a two-cabin split so bipartite answers are common, then occasionally add one edge inside a cabin.
  const side = Array.from({ length: campers }, () => rng.int(0, 1));
  const rivalries: [number, number][] = [];
  for (let k = rng.int(0, campers + 2); k > 0; k--) {
    const a = rng.int(0, campers - 1), b = rng.int(0, campers - 1);
    if (a !== b && side[a] !== side[b]) rivalries.push([a, b]);
  }
  if (rng.chance(0.4)) rivalries.push(...sampleEdges(rng, campers, 1));
  return { campers, rivalries: shuffle(rng, rivalries) };
}

function sampleRingOps(rng: Rng): { capacity: number; operations: RingOp[] } {
  return {
    capacity: rng.int(1, 4),
    operations: Array.from({ length: rng.int(0, 16) }, (): RingOp => {
      const kind = rng.int(0, 3);
      return kind === 0 || kind === 1 ? ["write", rng.int(-9, 9)] : kind === 2 ? rng.pick([["read"], ["newest"]] as RingOp[]) : ["size"];
    }),
  };
}

function sampleRouterOps(rng: Rng): { operations: RouterOp[] } {
  const names = ["a", "b", "c", "d"];
  return {
    operations: Array.from({ length: rng.int(0, 16) }, (): RouterOp => {
      const kind = rng.int(0, 5);
      if (kind <= 1) return ["add", rng.pick(names), rng.int(0, 12)];
      if (kind === 2) return ["remove", rng.pick(names)];
      return ["route", rng.int(0, 13)];
    }),
  };
}

function sampleLedger(rng: Rng) {
  const benchmarks = rng.int(2, 7);
  // Heights are planted so most statements are consistent, and some are deliberately wrong.
  const height = ints(rng, benchmarks, -5, 5);
  const statements = Array.from({ length: rng.int(0, 12) }, (): [number, number, number] => {
    const a = rng.int(0, benchmarks - 1);
    let b = rng.int(0, benchmarks - 2);
    if (b >= a) b++;
    return [a, b, height[a] - height[b] + (rng.chance(0.2) ? rng.int(-2, 2) : 0)];
  });
  return { benchmarks, statements };
}

export const BATCH6: Record<string, ExpansionEntry> = {
  "switch-gap": entry(switchGapInput, switchGap, switchGapBrute, (rng) => ({
    mask: rng.chance(0.25) ? rng.int(0, U31) : rng.chance(0.5) ? rng.int(0, 255) : rng.pick([0, 1, U31, 2 ** 30, 2 ** 30 + 1, 2 ** 30 - 1]) })),
  "merge-point": entry(mergePointInput, mergePoint, mergePointBrute, sampleMergePoint),
  "sensor-ring": entry(sensorRingInput, sensorRing, sensorRingBrute, sampleRingOps),
  "rival-teams": entry(rivalTeamsInput, rivalTeams, rivalTeamsBrute, sampleRival),
  "parallel-stages": entry(parallelStagesInput, parallelStages, parallelStagesBrute, (rng) => {
    const tasks = rng.int(1, 8);
    // Edges point from a lower to a higher rank in a hidden shuffled order, so most graphs are acyclic.
    const rank = shuffle(rng, Array.from({ length: tasks }, (_, i) => i));
    const prerequisites = sampleEdges(rng, tasks, tasks + 3).map(([a, b]): [number, number] => (rng.chance(0.9) && rank[a] > rank[b] ? [b, a] : [a, b]));
    return { tasks, prerequisites };
  }),
  "laser-shots": entry(laserShotsInput, laserShots, laserShotsBrute, (rng) => ({
    panels: Array.from({ length: rng.int(0, 8) }, () => { const l = rng.int(-6, 8); return [l, l + rng.int(0, 5)]; }) })),
  "exact-flags": entry(exactFlagsInput, exactFlags, exactFlagsBrute, (rng) => ({ readings: ints(rng, rng.int(1, 12), -6, 6), k: rng.int(0, 5) })),
  "digit-power": entry(digitPowerInput, digitPower, digitPowerBrute, (rng) => ({
    base: rng.chance(0.2) ? rng.int(0, 1_000_000_000) : rng.int(0, 12),
    digits: [rng.int(1, 9), ...ints(rng, rng.int(0, 3), 0, 9)],
    modulus: rng.chance(0.3) ? rng.int(1, 1_000_000) : rng.int(1, 30) })),
  "ring-router": entry(ringRouterInput, ringRouter, ringRouterBrute, sampleRouterOps),
  "elevation-ledger": entry(elevationLedgerInput, elevationLedger, elevationLedgerBrute, sampleLedger),
  "suffix-alarm": entry(suffixAlarmInput, suffixAlarm, suffixAlarmBrute, (rng) => ({
    words: Array.from({ length: rng.int(1, 4) }, () => randomWord(rng, rng.int(1, 3))), stream: randomWord(rng, rng.int(0, 14)) })),
  "grove-harvest": entry(groveHarvestInput, groveHarvest, groveHarvestBrute, (rng) => ({ tree: sampleGroveTree(rng) })),
  "crew-cover": entry(crewCoverInput, crewCover, crewCoverBrute, (rng) => {
    const skills = rng.int(1, 6);
    return { skills, volunteers: Array.from({ length: rng.int(1, 9) }, () => rng.int(0, 2 ** skills - 1)) };
  }),
};

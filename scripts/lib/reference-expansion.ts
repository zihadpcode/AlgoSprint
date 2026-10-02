import { z } from "zod";

// Trusted references for the library expansion (problems 36 onward). Each entry has a strict input schema, the typed
// reference that computes expected outputs, an independent brute-force baseline and a seeded sampler; the tests
// compare the two implementations on sampled inputs. JSON code strings from seed files are NEVER evaluated here.

export type Rng = { int(min: number, max: number): number; pick<T>(items: readonly T[]): T; chance(p: number): boolean };

export function seededRng(seed: number): Rng {
  let state = seed >>> 0 || 1;
  const next = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x1_0000_0000;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return { int, pick: (items) => items[int(0, items.length - 1)], chance: (p) => next() < p };
}

type Solver = (...args: never[]) => unknown;
export type ExpansionEntry = { input: z.ZodType; solve: Solver; brute: Solver; sample: (rng: Rng) => Record<string, unknown> };
const entry = <S extends z.ZodType>(input: S, solve: Solver, brute: Solver, sample: (rng: Rng) => Record<string, unknown>): ExpansionEntry =>
  ({ input, solve, brute, sample });

const int = z.int().min(-1_000_000).max(1_000_000);
const lowerWord = z.string().min(1).max(20).regex(/^[a-z]+$/);
const ints = (rng: Rng, length: number, min: number, max: number) => Array.from({ length }, () => rng.int(min, max));
const distinct = (rng: Rng, length: number, min: number, max: number) => {
  const seen = new Set<number>();
  while (seen.size < length) seen.add(rng.int(min, max));
  return [...seen];
};

// ---------- Trees (level-order arrays with null gaps, same encoding as the original library) ----------

type TreeNode = { value: number; left: TreeNode | null; right: TreeNode | null };
const levelTree = z.array(z.union([z.int().min(-100_000).max(100_000), z.null()])).max(10_000)
  .refine((t) => t.length === 0 || t[0] !== null, "A non-empty tree starts with its root");

function buildTree(values: (number | null)[]): TreeNode | null {
  if (values.length === 0 || values[0] === null) return null;
  const root: TreeNode = { value: values[0], left: null, right: null };
  const queue = [root];
  let index = 1;
  while (queue.length && index < values.length) {
    const node = queue.shift()!;
    const left = values[index++];
    if (left !== undefined && left !== null) queue.push(node.left = { value: left, left: null, right: null });
    const right = values[index++];
    if (right !== undefined && right !== null) queue.push(node.right = { value: right, left: null, right: null });
  }
  return root;
}

function toLevelOrder(root: TreeNode | null): (number | null)[] {
  const out: (number | null)[] = [];
  const queue: (TreeNode | null)[] = [root];
  while (queue.length) {
    const node = queue.shift()!;
    out.push(node ? node.value : null);
    if (node) queue.push(node.left, node.right);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

function randomTree(rng: Rng, size: number, values: () => number): (number | null)[] {
  if (size === 0) return [];
  const root: TreeNode = { value: values(), left: null, right: null };
  const nodes = [root];
  for (let i = 1; i < size; i++) {
    for (;;) {
      const parent = rng.pick(nodes);
      const side = rng.chance(0.5) ? "left" : "right";
      if (!parent[side]) { nodes.push(parent[side] = { value: values(), left: null, right: null }); break; }
    }
  }
  return toLevelOrder(root);
}

function insertBst(root: TreeNode | null, value: number): TreeNode {
  if (!root) return { value, left: null, right: null };
  if (value < root.value) root.left = insertBst(root.left, value); else root.right = insertBst(root.right, value);
  return root;
}

function inorder(node: TreeNode | null, out: number[] = []): number[] {
  if (node) { inorder(node.left, out); out.push(node.value); inorder(node.right, out); }
  return out;
}

// ---------- Studio Bookings: minimum rooms for half-open bookings ----------

const booking = z.tuple([z.int().min(0).max(1_000_000), z.int().min(0).max(1_000_000)]).refine(([s, e]) => s < e, "A booking must end after it starts");
export const studioBookingsInput = z.strictObject({ bookings: z.array(booking).max(10_000) });
export function studioBookings(bookings: [number, number][]) {
  const starts = bookings.map((b) => b[0]).sort((a, b) => a - b);
  const ends = bookings.map((b) => b[1]).sort((a, b) => a - b);
  let open = 0, best = 0, j = 0;
  for (const start of starts) {
    while (j < ends.length && ends[j] <= start) { j++; open--; }
    best = Math.max(best, ++open);
  }
  return best;
}
function studioBookingsBrute(bookings: [number, number][]) {
  let best = 0;
  for (const [t] of bookings) best = Math.max(best, bookings.filter(([s, e]) => s <= t && t < e).length);
  return best;
}

// ---------- Slot Insert: insert one closed interval into a sorted disjoint list ----------

const closed = z.tuple([int, int]).refine(([s, e]) => s <= e, "A slot must not end before it starts");
export const slotInsertInput = z.strictObject({
  slots: z.array(closed).max(10_000).refine((slots) => slots.every((slot, i) => i === 0 || slots[i - 1][1] < slot[0]),
    "Slots must be sorted and pairwise disjoint"),
  newSlot: closed,
});
export function slotInsert(slots: [number, number][], newSlot: [number, number]) {
  const result: [number, number][] = [];
  let [start, end] = newSlot;
  let i = 0;
  while (i < slots.length && slots[i][1] < start) { result.push([slots[i][0], slots[i][1]]); i++; }
  while (i < slots.length && slots[i][0] <= end) { start = Math.min(start, slots[i][0]); end = Math.max(end, slots[i][1]); i++; }
  result.push([start, end]);
  while (i < slots.length) { result.push([slots[i][0], slots[i][1]]); i++; }
  return result;
}
function slotInsertBrute(slots: [number, number][], newSlot: [number, number]) {
  const all = [...slots, newSlot].map(([s, e]) => [s, e] as [number, number]).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of all) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e); else merged.push([s, e]);
  }
  return merged;
}
function sampleSlots(rng: Rng) {
  const slots: [number, number][] = [];
  let cursor = rng.int(-20, 0);
  for (let n = rng.int(0, 6); n > 0; n--) {
    const start = cursor + rng.int(1, 4);
    const end = start + rng.int(0, 3);
    slots.push([start, end]);
    cursor = end;
  }
  const a = rng.int(-22, 30), b = a + rng.int(0, 12);
  return { slots, newSlot: [a, b] };
}

// ---------- Prefix Suggestions: up to three smallest matches per typed prefix ----------

export const prefixSuggestionsInput = z.strictObject({
  words: z.array(lowerWord).max(1000).refine((w) => new Set(w).size === w.length, "Words must be distinct"),
  typed: lowerWord,
});
export function prefixSuggestions(words: string[], typed: string) {
  const sorted = [...words].sort();
  const result: string[][] = [];
  let low = 0;
  for (let length = 1; length <= typed.length; length++) {
    const prefix = typed.slice(0, length);
    let lo = low, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < prefix) lo = mid + 1; else hi = mid; }
    low = lo;
    const picks: string[] = [];
    for (let i = lo; i < sorted.length && picks.length < 3 && sorted[i].startsWith(prefix); i++) picks.push(sorted[i]);
    result.push(picks);
  }
  return result;
}
function prefixSuggestionsBrute(words: string[], typed: string) {
  return Array.from(typed, (_, i) => words.filter((w) => w.startsWith(typed.slice(0, i + 1))).sort().slice(0, 3));
}

// ---------- Radio Clusters: connected components ----------

const towers = z.int().min(1).max(10_000);
export const radioClustersInput = z.strictObject({
  towers,
  links: z.array(z.tuple([z.int().min(0), z.int().min(0)])).max(20_000),
}).refine((i) => i.links.every(([a, b]) => a < i.towers && b < i.towers), "Links must name existing towers");
export function radioClusters(count: number, links: [number, number][]) {
  const parent = Array.from({ length: count }, (_, i) => i);
  const size = new Array<number>(count).fill(1);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  let groups = count;
  for (const [a, b] of links) {
    let ra = find(a), rb = find(b);
    if (ra === rb) continue;
    if (size[ra] < size[rb]) [ra, rb] = [rb, ra];
    parent[rb] = ra; size[ra] += size[rb]; groups--;
  }
  return groups;
}
function radioClustersBrute(count: number, links: [number, number][]) {
  const label = Array.from({ length: count }, (_, i) => i);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of links) {
      const low = Math.min(label[a], label[b]);
      if (label[a] !== low || label[b] !== low) { label[a] = label[b] = low; changed = true; }
    }
  }
  return new Set(label).size;
}

// ---------- Module Plan: can every module be completed (cycle detection) ----------

export const modulePlanInput = z.strictObject({
  modules: z.int().min(1).max(10_000),
  prerequisites: z.array(z.tuple([z.int().min(0), z.int().min(0)])).max(20_000),
}).refine((i) => i.prerequisites.every(([a, b]) => a < i.modules && b < i.modules && a !== b),
  "Prerequisites must name two different existing modules");
export function modulePlan(modules: number, prerequisites: [number, number][]) {
  const indegree = new Array<number>(modules).fill(0);
  const unlocks: number[][] = Array.from({ length: modules }, () => []);
  for (const [module, needed] of prerequisites) { unlocks[needed].push(module); indegree[module]++; }
  const ready: number[] = [];
  indegree.forEach((d, m) => { if (d === 0) ready.push(m); });
  let done = 0;
  while (ready.length) {
    const m = ready.pop()!;
    done++;
    for (const next of unlocks[m]) if (--indegree[next] === 0) ready.push(next);
  }
  return done === modules;
}
function modulePlanBrute(modules: number, prerequisites: [number, number][]) {
  const completed = new Set<number>();
  let progress = true;
  while (progress) {
    progress = false;
    for (let m = 0; m < modules; m++) {
      if (completed.has(m)) continue;
      if (prerequisites.every(([module, needed]) => module !== m || completed.has(needed))) { completed.add(m); progress = true; }
    }
  }
  return completed.size === modules;
}
function sampleGraph(rng: Rng, maxNodes: number, allowSelf: boolean) {
  const n = rng.int(1, maxNodes);
  const edges: [number, number][] = [];
  for (let k = rng.int(0, n + 2); k > 0; k--) {
    const a = rng.int(0, n - 1);
    let b = rng.int(0, n - 1);
    if (!allowSelf && a === b) { if (n === 1) continue; b = (a + 1) % n; }
    edges.push([a, b]);
  }
  return { n, edges };
}

// ---------- Lit Panels: set-bit counts for 0..count ----------

export const litPanelsInput = z.strictObject({ count: z.int().min(0).max(10_000) });
export function litPanels(count: number) {
  const bits = new Array<number>(count + 1).fill(0);
  for (let i = 1; i <= count; i++) bits[i] = bits[i >> 1] + (i & 1);
  return bits;
}
function litPanelsBrute(count: number) {
  return Array.from({ length: count + 1 }, (_, i) => i.toString(2).split("").filter((c) => c === "1").length);
}

// ---------- Tile Side: greatest common divisor of plank lengths ----------

export const tileSideInput = z.strictObject({ planks: z.array(z.int().min(1).max(1_000_000)).min(1).max(10_000) });
export function tileSide(planks: number[]) {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  return planks.reduce(gcd);
}
function tileSideBrute(planks: number[]) {
  for (let side = Math.min(...planks); side >= 1; side--) if (planks.every((p) => p % side === 0)) return side;
  return 1;
}

// ---------- Kth Badge: kth smallest value in a BST ----------

export const kthBadgeInput = z.strictObject({ tree: levelTree, k: z.int().min(1) }).superRefine((input, ctx) => {
  const values = input.tree.filter((v): v is number => v !== null);
  const root = buildTree(input.tree);
  const order = inorder(root);
  if (order.length !== values.length) ctx.addIssue({ code: "custom", message: "Every listed value must be reachable" });
  if (order.some((v, i) => i > 0 && order[i - 1] >= v)) ctx.addIssue({ code: "custom", message: "The tree must be a BST with distinct values" });
  if (input.k > order.length) ctx.addIssue({ code: "custom", message: "k cannot exceed the number of badges" });
});
export function kthBadge(tree: (number | null)[], k: number) {
  const stack: TreeNode[] = [];
  let node = buildTree(tree);
  let remaining = k;
  while (node || stack.length) {
    while (node) { stack.push(node); node = node.left; }
    node = stack.pop()!;
    if (--remaining === 0) return node.value;
    node = node.right;
  }
  throw new Error("k exceeds tree size");
}
function kthBadgeBrute(tree: (number | null)[], k: number) {
  return tree.filter((v): v is number => v !== null).sort((a, b) => a - b)[k - 1];
}
function sampleBst(rng: Rng) {
  let root: TreeNode | null = null;
  const values = distinct(rng, rng.int(1, 12), -50, 50);
  for (const v of values) root = insertBst(root, v);
  return { tree: toLevelOrder(root), k: rng.int(1, values.length) };
}

// ---------- Canopy Layers: per-depth sums ----------

export const canopyLayersInput = z.strictObject({ tree: levelTree }).refine(
  (i) => inorder(buildTree(i.tree)).length === i.tree.filter((v) => v !== null).length, "Every listed value must be reachable");
export function canopyLayers(tree: (number | null)[]) {
  const sums: number[] = [];
  let level = buildTree(tree) ? [buildTree(tree)!] : [];
  while (level.length) {
    sums.push(level.reduce((total, node) => total + node.value, 0));
    level = level.flatMap((node) => [node.left, node.right].filter((child): child is TreeNode => child !== null));
  }
  return sums;
}
function canopyLayersBrute(tree: (number | null)[]) {
  const sums: number[] = [];
  const visit = (node: TreeNode | null, depth: number) => {
    if (!node) return;
    sums[depth] = (sums[depth] ?? 0) + node.value;
    visit(node.left, depth + 1); visit(node.right, depth + 1);
  };
  visit(buildTree(tree), 0);
  return sums;
}

// ---------- Dial Lookup: search a rotated sorted array ----------

export const dialLookupInput = z.strictObject({ dial: z.array(int).min(1).max(10_000), target: int }).refine((i) => {
  const drops = i.dial.filter((v, k) => k > 0 && i.dial[k - 1] >= v).length;
  const wraps = i.dial[i.dial.length - 1] < i.dial[0] || drops === 0;
  return (drops === 0 || (drops === 1 && wraps)) && new Set(i.dial).size === i.dial.length;
}, "The dial must be a rotation of strictly increasing distinct values");
export function dialLookup(dial: number[], target: number) {
  let lo = 0, hi = dial.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dial[mid] === target) return mid;
    if (dial[lo] <= dial[mid]) {
      if (dial[lo] <= target && target < dial[mid]) hi = mid - 1; else lo = mid + 1;
    } else if (dial[mid] < target && target <= dial[hi]) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}
function dialLookupBrute(dial: number[], target: number) { return dial.indexOf(target); }
function sampleDial(rng: Rng) {
  const sorted = distinct(rng, rng.int(1, 12), -40, 40).sort((a, b) => a - b);
  const shift = rng.int(0, sorted.length - 1);
  const dial = [...sorted.slice(shift), ...sorted.slice(0, shift)];
  return { dial, target: rng.chance(0.7) ? rng.pick(dial) : rng.int(-45, 45) };
}

// ---------- Fuel Stretch: shortest window with sum at least target ----------

export const fuelStretchInput = z.strictObject({ fuel: z.array(z.int().min(1).max(10_000)).min(1).max(10_000), target: z.int().min(1).max(1_000_000_000) });
export function fuelStretch(fuel: number[], target: number) {
  let best = Infinity, sum = 0, left = 0;
  for (let right = 0; right < fuel.length; right++) {
    sum += fuel[right];
    while (sum >= target) { best = Math.min(best, right - left + 1); sum -= fuel[left++]; }
  }
  return best === Infinity ? 0 : best;
}
function fuelStretchBrute(fuel: number[], target: number) {
  let best = 0;
  for (let i = 0; i < fuel.length; i++) {
    let sum = 0;
    for (let j = i; j < fuel.length; j++) { sum += fuel[j]; if (sum >= target) { if (!best || j - i + 1 < best) best = j - i + 1; break; } }
  }
  return best;
}

// ---------- Postfix Ledger: evaluate reverse Polish notation ----------

// Signed 32-bit range: [-2^31, 2^31 - 1].
const LOW = -(2 ** 31), HIGH = 2 ** 31 - 1;
function evaluatePostfix(tokens: string[]): { ok: true; value: number } | { ok: false; reason: string } {
  const stack: number[] = [];
  for (const token of tokens) {
    if (/^-?\d+$/.test(token)) { stack.push(Number(token)); continue; }
    if (stack.length < 2) return { ok: false, reason: "An operator needs two operands" };
    const right = stack.pop()!, left = stack.pop()!;
    if (token === "/" && right === 0) return { ok: false, reason: "Division by zero" };
    const value = token === "+" ? left + right : token === "-" ? left - right : token === "*" ? left * right : Math.trunc(left / right);
    if (value < LOW || value > HIGH) return { ok: false, reason: "Intermediate values must stay within 32-bit range" };
    stack.push(value === 0 ? 0 : value);
  }
  return stack.length === 1 ? { ok: true, value: stack[0] } : { ok: false, reason: "The expression must reduce to one value" };
}
export const postfixLedgerInput = z.strictObject({
  tokens: z.array(z.string().regex(/^(?:[-+*/]|-?(?:0|[1-9]\d{0,5}))$/)).min(1).max(10_000),
}).superRefine((i, ctx) => {
  const result = evaluatePostfix(i.tokens);
  if (!result.ok) ctx.addIssue({ code: "custom", message: result.reason });
});
export function postfixLedger(tokens: string[]) {
  const result = evaluatePostfix(tokens);
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}
function postfixLedgerBrute(tokens: string[]) {
  const items: (string | number)[] = tokens.map((t) => (/^-?\d+$/.test(t) ? Number(t) : t));
  while (items.length > 1) {
    const i = items.findIndex((t) => typeof t === "string");
    const left = items[i - 2] as number, right = items[i - 1] as number, op = items[i] as string;
    const value = op === "+" ? left + right : op === "-" ? left - right : op === "*" ? left * right : Math.trunc(left / right);
    items.splice(i - 2, 3, value === 0 ? 0 : value);
  }
  return items[0] as number;
}
function samplePostfix(rng: Rng): { tokens: string[] } {
  for (;;) {
    const tokens: string[] = [];
    let depth = 0;
    const operands = rng.int(1, 7);
    let pushed = 0;
    while (pushed < operands || depth > 1) {
      if (pushed < operands && (depth < 2 || rng.chance(0.55))) { tokens.push(String(rng.int(-9, 12))); depth++; pushed++; }
      else { tokens.push(rng.pick(["+", "-", "*", "/"])); depth--; }
    }
    if (evaluatePostfix(tokens).ok) return { tokens };
  }
}

// ---------- Floor Tracker: a stack that reports its minimum ----------

const trackerOp = z.union([z.tuple([z.literal("push"), int]), z.tuple([z.literal("pop")]), z.tuple([z.literal("top")]), z.tuple([z.literal("min")])]);
type TrackerOp = ["push", number] | ["pop"] | ["top"] | ["min"];
export const floorTrackerInput = z.strictObject({ operations: z.array(trackerOp).max(10_000) }).refine((i) => {
  let size = 0;
  for (const op of i.operations) { if (op[0] === "push") size++; else if (size === 0) return false; else if (op[0] === "pop") size--; }
  return true;
}, "pop, top and min require a non-empty tracker");
export function floorTracker(operations: TrackerOp[]) {
  const values: number[] = [], minimums: number[] = [], results: number[] = [];
  for (const op of operations) {
    if (op[0] === "push") { values.push(op[1]); minimums.push(minimums.length ? Math.min(minimums[minimums.length - 1], op[1]) : op[1]); }
    else if (op[0] === "pop") { minimums.pop(); results.push(values.pop()!); }
    else if (op[0] === "top") results.push(values[values.length - 1]);
    else results.push(minimums[minimums.length - 1]);
  }
  return results;
}
function floorTrackerBrute(operations: TrackerOp[]) {
  const values: number[] = [], results: number[] = [];
  for (const op of operations) {
    if (op[0] === "push") values.push(op[1]);
    else if (op[0] === "pop") results.push(values.pop()!);
    else if (op[0] === "top") results.push(values[values.length - 1]);
    else results.push(Math.min(...values));
  }
  return results;
}
function sampleTracker(rng: Rng) {
  const operations: TrackerOp[] = [];
  let size = 0;
  for (let n = rng.int(0, 14); n > 0; n--) {
    if (size === 0 || rng.chance(0.4)) { operations.push(["push", rng.int(-9, 9)]); size++; }
    else { const kind = rng.pick(["pop", "top", "min"] as const); operations.push([kind]); if (kind === "pop") size--; }
  }
  return { operations };
}

// ---------- Shuffled Signs: anagram check ----------

const letters = z.string().max(10_000).regex(/^[a-z]*$/);
export const shuffledSignsInput = z.strictObject({ first: letters, second: letters });
export function shuffledSigns(first: string, second: string) {
  if (first.length !== second.length) return false;
  const counts = new Array<number>(26).fill(0);
  for (let i = 0; i < first.length; i++) { counts[first.charCodeAt(i) - 97]++; counts[second.charCodeAt(i) - 97]--; }
  return counts.every((c) => c === 0);
}
function shuffledSignsBrute(first: string, second: string) { return [...first].sort().join("") === [...second].sort().join(""); }
const randomWord = (rng: Rng, length: number, alphabet = "abc") => Array.from({ length }, () => alphabet[rng.int(0, alphabet.length - 1)]).join("");

// ---------- Trail Gain: best single increase ----------

export const trailGainInput = z.strictObject({ heights: z.array(z.int().min(0).max(1_000_000)).min(1).max(10_000) });
export function trailGain(heights: number[]) {
  let lowest = heights[0], best = 0;
  for (const h of heights) { best = Math.max(best, h - lowest); lowest = Math.min(lowest, h); }
  return best;
}
function trailGainBrute(heights: number[]) {
  let best = 0;
  for (let i = 0; i < heights.length; i++) for (let j = i + 1; j < heights.length; j++) best = Math.max(best, heights[j] - heights[i]);
  return best;
}

// ---------- Middle Car: middle node of a linked chain ----------

export const middleCarInput = z.strictObject({ next: z.array(z.int().min(-1)).min(1).max(10_000), head: z.int().min(0) }).refine((i) => {
  if (i.head >= i.next.length) return false;
  const seen = new Set<number>();
  for (let node = i.head; node !== -1; node = i.next[node]) { if (node >= i.next.length || seen.has(node)) return false; seen.add(node); }
  return seen.size === i.next.length;
}, "The chain from head must visit every car exactly once and end with -1");
export function middleCar(next: number[], head: number) {
  let slow = head, fast = head;
  while (fast !== -1 && next[fast] !== -1) { slow = next[slow]; fast = next[next[fast]]; }
  return slow;
}
function middleCarBrute(next: number[], head: number) {
  const order: number[] = [];
  for (let node = head; node !== -1; node = next[node]) order.push(node);
  return order[Math.floor(order.length / 2)];
}
function sampleChain(rng: Rng) {
  const n = rng.int(1, 9);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  const next = new Array<number>(n).fill(-1);
  for (let i = 0; i + 1 < n; i++) next[order[i]] = order[i + 1];
  return { next, head: order[0] };
}

// ---------- Fare Combinations: unbounded coin-change counting ----------

const MOD = 1_000_000_007;
export const fareCombinationsInput = z.strictObject({
  coins: z.array(z.int().min(1).max(5000)).min(1).max(50).refine((c) => new Set(c).size === c.length, "Fare values must be distinct"),
  amount: z.int().min(0).max(5000),
});
export function fareCombinations(coins: number[], amount: number) {
  const ways = new Array<number>(amount + 1).fill(0);
  ways[0] = 1;
  for (const coin of coins) for (let total = coin; total <= amount; total++) ways[total] = (ways[total] + ways[total - coin]) % MOD;
  return ways[amount];
}
function fareCombinationsBrute(coins: number[], amount: number) {
  const count = (index: number, remaining: number): number => {
    if (remaining === 0) return 1;
    if (index === coins.length) return 0;
    let total = 0;
    for (let used = 0; used * coins[index] <= remaining; used++) total = (total + count(index + 1, remaining - used * coins[index])) % MOD;
    return total;
  };
  return count(0, amount);
}

// ---------- Warehouse Routes: grid paths around blocked cells ----------

const grid = (cells: string) => z.array(z.string().min(1).max(100).regex(new RegExp(`^[${cells}]+$`))).min(1).max(100)
  .refine((g) => g.every((row) => row.length === g[0].length), "Rows must have equal length");
export const warehouseRoutesInput = z.strictObject({ grid: grid(".#") });
export function warehouseRoutes(rows: string[]) {
  const width = rows[0].length;
  const ways = new Array<number>(width).fill(0);
  ways[0] = rows[0][0] === "." ? 1 : 0;
  for (const row of rows) {
    for (let c = 0; c < width; c++) {
      if (row[c] === "#") ways[c] = 0;
      else if (c > 0) ways[c] = (ways[c] + ways[c - 1]) % MOD;
    }
  }
  return ways[width - 1];
}
function warehouseRoutesBrute(rows: string[]) {
  const walk = (r: number, c: number): number => {
    if (r >= rows.length || c >= rows[0].length || rows[r][c] === "#") return 0;
    if (r === rows.length - 1 && c === rows[0].length - 1) return 1;
    return (walk(r + 1, c) + walk(r, c + 1)) % MOD;
  };
  return walk(0, 0);
}
const randomGrid = (rng: Rng, cells: string, weights: number[]) => {
  const h = rng.int(1, 5), w = rng.int(1, 5);
  return Array.from({ length: h }, () => Array.from({ length: w }, () => {
    let roll = rng.int(0, weights.reduce((a, b) => a + b) - 1);
    for (let k = 0; k < cells.length; k++) { if (roll < weights[k]) return cells[k]; roll -= weights[k]; }
    return cells[0];
  }).join(""));
};

// ---------- Mold Spread: multi-source BFS on a grid ----------

export const moldSpreadInput = z.strictObject({ grid: grid("FS.") });
export function moldSpread(rows: string[]) {
  const h = rows.length, w = rows[0].length;
  const state = rows.map((row) => [...row]);
  let queue: [number, number][] = [];
  let fresh = 0;
  state.forEach((row, r) => row.forEach((cell, c) => { if (cell === "S") queue.push([r, c]); else if (cell === "F") fresh++; }));
  let minutes = 0;
  while (queue.length && fresh) {
    const next: [number, number][] = [];
    for (const [r, c] of queue) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < h && nc >= 0 && nc < w && state[nr][nc] === "F") { state[nr][nc] = "S"; fresh--; next.push([nr, nc]); }
    }
    queue = next;
    minutes++;
  }
  return fresh ? -1 : minutes;
}
function moldSpreadBrute(rows: string[]) {
  let state = rows.map((row) => [...row]);
  for (let minute = 0; ; minute++) {
    if (!state.some((row) => row.includes("F"))) return minute;
    const next = state.map((row, r) => row.map((cell, c) => (cell === "F" && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => state[r + dr]?.[c + dc] === "S") ? "S" : cell)));
    if (next.every((row, r) => row.every((cell, c) => cell === state[r][c]))) return -1;
    state = next;
  }
}

// ---------- Nearest Beacons: k closest points with deterministic ties ----------

const point = z.tuple([z.int().min(-10_000).max(10_000), z.int().min(-10_000).max(10_000)]);
export const nearestBeaconsInput = z.strictObject({ beacons: z.array(point).min(1).max(10_000), k: z.int().min(1) })
  .refine((i) => i.k <= i.beacons.length, "k cannot exceed the number of beacons");
const beaconOrder = (a: [number, number], b: [number, number]) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]) || a[0] - b[0] || a[1] - b[1];
export function nearestBeacons(beacons: [number, number][], k: number) {
  // Max-heap of size k under beaconOrder, then sort the survivors.
  const heap: [number, number][] = [];
  const up = (i: number) => { while (i > 0) { const p = (i - 1) >> 1; if (beaconOrder(heap[p], heap[i]) >= 0) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = (i: number) => {
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let top = i;
      if (l < heap.length && beaconOrder(heap[l], heap[top]) > 0) top = l;
      if (r < heap.length && beaconOrder(heap[r], heap[top]) > 0) top = r;
      if (top === i) return;
      [heap[top], heap[i]] = [heap[i], heap[top]]; i = top;
    }
  };
  for (const b of beacons) {
    const p: [number, number] = [b[0], b[1]];
    if (heap.length < k) { heap.push(p); up(heap.length - 1); }
    else if (beaconOrder(p, heap[0]) < 0) { heap[0] = p; down(0); }
  }
  return heap.sort(beaconOrder);
}
function nearestBeaconsBrute(beacons: [number, number][], k: number) {
  return beacons.map((b) => [b[0], b[1]] as [number, number]).sort(beaconOrder).slice(0, k);
}

// ---------- Balance Runs: subarrays summing to a target ----------

export const balanceRunsInput = z.strictObject({ changes: z.array(z.int().min(-1000).max(1000)).min(1).max(10_000), target: int });
export function balanceRuns(changes: number[], target: number) {
  const seen = new Map<number, number>([[0, 1]]);
  let prefix = 0, count = 0;
  for (const change of changes) {
    prefix += change;
    count += seen.get(prefix - target) ?? 0;
    seen.set(prefix, (seen.get(prefix) ?? 0) + 1);
  }
  return count;
}
function balanceRunsBrute(changes: number[], target: number) {
  let count = 0;
  for (let i = 0; i < changes.length; i++) { let sum = 0; for (let j = i; j < changes.length; j++) if ((sum += changes[j]) === target) count++; }
  return count;
}

// ---------- Typo Distance: edit distance ----------

const shortWord = z.string().max(500).regex(/^[a-z]*$/);
export const typoDistanceInput = z.strictObject({ typed: shortWord, intended: shortWord });
export function typoDistance(typed: string, intended: string) {
  let previous = Array.from({ length: intended.length + 1 }, (_, j) => j);
  for (let i = 1; i <= typed.length; i++) {
    const current = [i];
    for (let j = 1; j <= intended.length; j++) {
      current[j] = typed[i - 1] === intended[j - 1] ? previous[j - 1] : 1 + Math.min(previous[j - 1], previous[j], current[j - 1]);
    }
    previous = current;
  }
  return previous[intended.length];
}
function typoDistanceBrute(typed: string, intended: string): number {
  const go = (i: number, j: number): number => {
    if (i === typed.length) return intended.length - j;
    if (j === intended.length) return typed.length - i;
    if (typed[i] === intended[j]) return go(i + 1, j + 1);
    return 1 + Math.min(go(i + 1, j + 1), go(i + 1, j), go(i, j + 1));
  };
  return go(0, 0);
}

// ---------- Peak Watch: sliding window maximum ----------

export const peakWatchInput = z.strictObject({ readings: z.array(z.int().min(-10_000).max(10_000)).min(1).max(10_000), k: z.int().min(1) })
  .refine((i) => i.k <= i.readings.length, "k cannot exceed the number of readings");
export function peakWatch(readings: number[], k: number) {
  const deque: number[] = [];
  let head = 0;
  const result: number[] = [];
  for (let i = 0; i < readings.length; i++) {
    while (deque.length > head && readings[deque[deque.length - 1]] <= readings[i]) deque.pop();
    deque.push(i);
    if (deque[head] <= i - k) head++;
    if (i >= k - 1) result.push(readings[deque[head]]);
  }
  return result;
}
function peakWatchBrute(readings: number[], k: number) {
  return Array.from({ length: readings.length - k + 1 }, (_, s) => Math.max(...readings.slice(s, s + k)));
}

// ---------- Signal Codes: shortest one-letter transformation chain ----------

export const signalCodesInput = z.strictObject({
  start: z.string().min(1).max(10).regex(/^[a-z]+$/), goal: z.string().min(1).max(10).regex(/^[a-z]+$/),
  codes: z.array(z.string().min(1).max(10).regex(/^[a-z]+$/)).max(1000),
}).refine((i) => i.start !== i.goal && i.goal.length === i.start.length && i.codes.every((c) => c.length === i.start.length) && new Set(i.codes).size === i.codes.length,
  "start and goal must differ, and every code must be distinct and the same length as start");
export function signalCodes(start: string, goal: string, codes: string[]) {
  const unused = new Set(codes);
  if (!unused.has(goal)) return 0;
  unused.delete(start);
  let layer = [start];
  for (let length = 1; layer.length; length++) {
    const next: string[] = [];
    for (const word of layer) {
      for (let i = 0; i < word.length; i++) for (let c = 97; c <= 122; c++) {
        const candidate = word.slice(0, i) + String.fromCharCode(c) + word.slice(i + 1);
        if (!unused.has(candidate)) continue;
        if (candidate === goal) return length + 1;
        unused.delete(candidate);
        next.push(candidate);
      }
    }
    layer = next;
  }
  return 0;
}
function signalCodesBrute(start: string, goal: string, codes: string[]) {
  const differsByOne = (a: string, b: string) => [...a].filter((ch, i) => ch !== b[i]).length === 1;
  let best = 0;
  const visit = (word: string, used: Set<string>, length: number) => {
    if (word === goal) { if (!best || length < best) best = length; return; }
    for (const code of codes) if (!used.has(code) && differsByOne(word, code)) { used.add(code); visit(code, used, length + 1); used.delete(code); }
  };
  visit(start, new Set([start]), 1);
  return best;
}
function sampleSignal(rng: Rng) {
  const length = rng.int(1, 3);
  const make = () => randomWord(rng, length, "abc");
  const codes = [...new Set(Array.from({ length: rng.int(0, 7) }, make))];
  let start = make(), goal = make();
  while (goal === start) goal = make();
  if (rng.chance(0.7) && !codes.includes(goal)) codes.push(goal);
  return { start, goal, codes };
}

// ---------- Billboard Space: largest rectangle in a histogram ----------

export const billboardSpaceInput = z.strictObject({ heights: z.array(z.int().min(0).max(10_000)).min(1).max(10_000) });
export function billboardSpace(heights: number[]) {
  const stack: number[] = [];
  let best = 0;
  for (let i = 0; i <= heights.length; i++) {
    const h = i === heights.length ? 0 : heights[i];
    while (stack.length && heights[stack[stack.length - 1]] >= h) {
      const height = heights[stack.pop()!];
      const left = stack.length ? stack[stack.length - 1] + 1 : 0;
      best = Math.max(best, height * (i - left));
    }
    stack.push(i);
  }
  return best;
}
function billboardSpaceBrute(heights: number[]) {
  let best = 0;
  for (let i = 0; i < heights.length; i++) {
    let low = Infinity;
    for (let j = i; j < heights.length; j++) { low = Math.min(low, heights[j]); best = Math.max(best, low * (j - i + 1)); }
  }
  return best;
}

// ---------- Pace Median: running median ----------

export const paceMedianInput = z.strictObject({ paces: z.array(z.int().min(-100_000).max(100_000)).min(1).max(10_000) });
export function paceMedian(paces: number[]) {
  // lower is a max-heap (stored negated), upper a min-heap; lower holds the extra element when the count is odd.
  const lower: number[] = [], upper: number[] = [];
  const push = (heap: number[], value: number) => {
    heap.push(value);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p] <= heap[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = (heap: number[]) => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l] < heap[m]) m = l;
        if (r < heap.length && heap[r] < heap[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const result: number[] = [];
  for (const pace of paces) {
    if (lower.length && pace > -lower[0]) push(upper, pace); else push(lower, -pace);
    if (lower.length > upper.length + 1) push(upper, -pop(lower));
    else if (upper.length > lower.length) push(lower, -pop(upper));
    result.push(lower.length > upper.length ? -lower[0] : (-lower[0] + upper[0]) / 2);
  }
  return result;
}
function paceMedianBrute(paces: number[]) {
  return paces.map((_, i) => {
    const sorted = paces.slice(0, i + 1).sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  });
}

// ---------- Registry ----------

export const EXPANSION: Record<string, ExpansionEntry> = {
  "studio-bookings": entry(studioBookingsInput, studioBookings, studioBookingsBrute, (rng) => ({
    bookings: Array.from({ length: rng.int(0, 8) }, () => { const s = rng.int(0, 20); return [s, s + rng.int(1, 8)]; }) })),
  "slot-insert": entry(slotInsertInput, slotInsert, slotInsertBrute, sampleSlots),
  "prefix-suggestions": entry(prefixSuggestionsInput, prefixSuggestions, prefixSuggestionsBrute, (rng) => {
    const words = [...new Set(Array.from({ length: rng.int(0, 10) }, () => Array.from({ length: rng.int(1, 4) }, () => rng.pick(["a", "b", "c"])).join("")))];
    return { words, typed: Array.from({ length: rng.int(1, 4) }, () => rng.pick(["a", "b", "c", "d"])).join("") };
  }),
  "radio-clusters": entry(radioClustersInput, radioClusters, radioClustersBrute, (rng) => {
    const { n, edges } = sampleGraph(rng, 9, true);
    return { towers: n, links: edges };
  }),
  "module-plan": entry(modulePlanInput, modulePlan, modulePlanBrute, (rng) => {
    const { n, edges } = sampleGraph(rng, 7, false);
    return { modules: n, prerequisites: edges };
  }),
  "lit-panels": entry(litPanelsInput, litPanels, litPanelsBrute, (rng) => ({ count: rng.int(0, 70) })),
  "tile-side": entry(tileSideInput, tileSide, tileSideBrute, (rng) => {
    const unit = rng.int(1, 12);
    return { planks: Array.from({ length: rng.int(1, 6) }, () => unit * rng.int(1, 9)) };
  }),
  "kth-badge": entry(kthBadgeInput, kthBadge, kthBadgeBrute, sampleBst),
  "canopy-layers": entry(canopyLayersInput, canopyLayers, canopyLayersBrute, (rng) => ({ tree: randomTree(rng, rng.int(0, 12), () => rng.int(-20, 20)) })),
  "dial-lookup": entry(dialLookupInput, dialLookup, dialLookupBrute, sampleDial),
  "fuel-stretch": entry(fuelStretchInput, fuelStretch, fuelStretchBrute, (rng) => ({ fuel: ints(rng, rng.int(1, 10), 1, 9), target: rng.int(1, 40) })),
  "postfix-ledger": entry(postfixLedgerInput, postfixLedger, postfixLedgerBrute, samplePostfix),
  "floor-tracker": entry(floorTrackerInput, floorTracker, floorTrackerBrute, sampleTracker),
  "shuffled-signs": entry(shuffledSignsInput, shuffledSigns, shuffledSignsBrute, (rng) => {
    const first = randomWord(rng, rng.int(0, 6));
    const second = rng.chance(0.5) ? [...first].sort(() => rng.int(-1, 1)).join("") : randomWord(rng, rng.int(0, 6));
    return { first, second };
  }),
  "trail-gain": entry(trailGainInput, trailGain, trailGainBrute, (rng) => ({ heights: ints(rng, rng.int(1, 9), 0, 20) })),
  "middle-car": entry(middleCarInput, middleCar, middleCarBrute, sampleChain),
  "fare-combinations": entry(fareCombinationsInput, fareCombinations, fareCombinationsBrute, (rng) => ({ coins: distinct(rng, rng.int(1, 4), 1, 9), amount: rng.int(0, 25) })),
  "warehouse-routes": entry(warehouseRoutesInput, warehouseRoutes, warehouseRoutesBrute, (rng) => ({ grid: randomGrid(rng, ".#", [4, 1]) })),
  "mold-spread": entry(moldSpreadInput, moldSpread, moldSpreadBrute, (rng) => ({ grid: randomGrid(rng, "FS.", [5, 1, 2]) })),
  "nearest-beacons": entry(nearestBeaconsInput, nearestBeacons, nearestBeaconsBrute, (rng) => {
    const beacons = Array.from({ length: rng.int(1, 9) }, () => [rng.int(-4, 4), rng.int(-4, 4)]);
    return { beacons, k: rng.int(1, beacons.length) };
  }),
  "balance-runs": entry(balanceRunsInput, balanceRuns, balanceRunsBrute, (rng) => ({ changes: ints(rng, rng.int(1, 10), -3, 3), target: rng.int(-4, 4) })),
  "typo-distance": entry(typoDistanceInput, typoDistance, typoDistanceBrute, (rng) => ({ typed: randomWord(rng, rng.int(0, 6)), intended: randomWord(rng, rng.int(0, 6)) })),
  "peak-watch": entry(peakWatchInput, peakWatch, peakWatchBrute, (rng) => {
    const readings = ints(rng, rng.int(1, 10), -9, 9);
    return { readings, k: rng.int(1, readings.length) };
  }),
  "signal-codes": entry(signalCodesInput, signalCodes, signalCodesBrute, sampleSignal),
  "billboard-space": entry(billboardSpaceInput, billboardSpace, billboardSpaceBrute, (rng) => ({ heights: ints(rng, rng.int(1, 9), 0, 8) })),
  "pace-median": entry(paceMedianInput, paceMedian, paceMedianBrute, (rng) => ({ paces: ints(rng, rng.int(1, 10), -9, 9) })),
};

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

const LIMIT = 2 ** 31;
function evaluatePostfix(tokens: string[]): { ok: true; value: number } | { ok: false; reason: string } {
  const stack: number[] = [];
  for (const token of tokens) {
    if (/^-?\d+$/.test(token)) { stack.push(Number(token)); continue; }
    if (stack.length < 2) return { ok: false, reason: "An operator needs two operands" };
    const right = stack.pop()!, left = stack.pop()!;
    if (token === "/" && right === 0) return { ok: false, reason: "Division by zero" };
    const value = token === "+" ? left + right : token === "-" ? left - right : token === "*" ? left * right : Math.trunc(left / right);
    if (Math.abs(value) >= LIMIT) return { ok: false, reason: "Intermediate values must stay within 32-bit range" };
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
};

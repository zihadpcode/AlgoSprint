import { z } from "zod";
import { SIGNATURES } from "../../src/features/submissions/signatures";

// Authored, typed reference solutions for the hand-written library problems. Each entry parses the JSON input with
// its own schema and computes the trusted expected output. JSON code strings from seed files are NEVER evaluated.

const int = z.int().min(-1_000_000).max(1_000_000);
const ints = z.array(int).max(10_000);
const positives = z.array(z.int().min(1).max(1_000_000)).max(10_000);
const word = z.string().max(200).regex(/^[a-z]*$/);
const tree = z.array(z.union([z.int().min(-100_000).max(100_000), z.null()])).max(10_000)
  .refine((t) => t.length === 0 || t[0] !== null, "A non-empty tree starts with its root");

type TreeNode = { value: number; left: TreeNode | null; right: TreeNode | null };

export function buildTree(values: (number | null)[]): TreeNode | null {
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

class MinHeap<T> {
  private items: T[] = [];
  constructor(private readonly key: (item: T) => number) {}
  get size() { return this.items.length; }
  push(item: T) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.key(items[parent]) <= this.key(items[i])) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): T {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1, right = left + 1;
        let smallest = i;
        if (left < items.length && this.key(items[left]) < this.key(items[smallest])) smallest = left;
        if (right < items.length && this.key(items[right]) < this.key(items[smallest])) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

function compareArrays(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

const gridOf = (allowed: RegExp) => z.array(z.string().max(100).regex(allowed)).max(100)
  .refine((rows) => rows.every((row) => row.length === rows[0].length), "Rows must share one width");

// ---------------------------------------------------------------------------------------------------------------

export const ridgeCountInput = z.strictObject({ heights: ints });
export function ridgeCount(heights: number[]) {
  let count = 0;
  let highest = -Infinity;
  for (const height of heights) {
    if (height > highest) { count++; highest = height; }
  }
  return count;
}

export const ticketPairInput = z.strictObject({ prices: ints, budget: int });
export function ticketPair(prices: number[], budget: number) {
  const earliest = new Map<number, number>();
  for (let j = 0; j < prices.length; j++) {
    const partner = earliest.get(budget - prices[j]);
    if (partner !== undefined) return [partner, j];
    if (!earliest.has(prices[j])) earliest.set(prices[j], j);
  }
  return [-1, -1];
}

export const mirrorCallsignInput = z.strictObject({ text: z.string().max(10_000).regex(/^[\x20-\x7e]*$/) });
export function mirrorCallsign(text: string) {
  const keep = (c: string) => /[a-z0-9]/i.test(c);
  let left = 0, right = text.length - 1;
  while (left < right) {
    if (!keep(text[left])) { left++; continue; }
    if (!keep(text[right])) { right--; continue; }
    if (text[left].toLowerCase() !== text[right].toLowerCase()) return false;
    left++; right--;
  }
  return true;
}

export const longestCleanStreakInput = z.strictObject({ log: z.string().max(10_000).regex(/^[a-z]*$/) });
export function longestCleanStreak(log: string) {
  const lastSeen = new Map<string, number>();
  let best = 0, start = 0;
  for (let i = 0; i < log.length; i++) {
    const previous = lastSeen.get(log[i]);
    if (previous !== undefined && previous >= start) start = previous + 1;
    lastSeen.set(log[i], i);
    best = Math.max(best, i - start + 1);
  }
  return best;
}

export const balancedBlueprintInput = z.strictObject({ plan: z.string().max(10_000).regex(/^[()[\]{}]*$/) });
export function balancedBlueprint(plan: string) {
  const closerFor: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const expected: string[] = [];
  for (const symbol of plan) {
    if (symbol in closerFor) expected.push(closerFor[symbol]);
    else if (expected.pop() !== symbol) return false;
  }
  return expected.length === 0;
}

export const warmerWaitInput = z.strictObject({ temps: ints });
export function warmerWait(temps: number[]) {
  const wait = new Array<number>(temps.length).fill(0);
  const pending: number[] = [];
  for (let day = 0; day < temps.length; day++) {
    while (pending.length && temps[pending[pending.length - 1]] < temps[day]) {
      const earlier = pending.pop()!;
      wait[earlier] = day - earlier;
    }
    pending.push(day);
  }
  return wait;
}

export const ticketTurnsInput = z.strictObject({ tickets: positives.min(1), position: z.int().nonnegative() })
  .refine((i) => i.position < i.tickets.length, "Position must index the queue");
export function ticketTurns(tickets: number[], position: number) {
  let time = 0;
  for (let i = 0; i < tickets.length; i++) {
    time += Math.min(tickets[i], i <= position ? tickets[position] : tickets[position] - 1);
  }
  return time;
}

export const chainLoopStartInput = z.strictObject({ next: z.array(z.int().min(-1)).max(10_000), head: z.int().min(-1) })
  .refine((i) => i.head < i.next.length && i.next.every((n) => n < i.next.length), "Pointers must index the chain or be -1");
export function chainLoopStart(next: number[], head: number) {
  let slow = head, fast = head;
  for (;;) {
    if (fast === -1 || next[fast] === -1) return -1;
    slow = next[slow];
    fast = next[next[fast]];
    if (slow === fast) break;
  }
  let entry = head;
  while (entry !== slow) { entry = next[entry]; slow = next[slow]; }
  return entry;
}

export const balancedCanopyInput = z.strictObject({ tree });
export function balancedCanopy(values: (number | null)[]) {
  function height(node: TreeNode | null): number {
    if (!node) return 0;
    const left = height(node.left);
    if (left < 0) return -1;
    const right = height(node.right);
    if (right < 0 || Math.abs(left - right) > 1) return -1;
    return Math.max(left, right) + 1;
  }
  return height(buildTree(values)) >= 0;
}

export const ledgerTreeCheckInput = z.strictObject({ tree });
export function ledgerTreeCheck(values: (number | null)[]) {
  function within(node: TreeNode | null, low: number, high: number): boolean {
    if (!node) return true;
    if (node.value <= low || node.value >= high) return false;
    return within(node.left, low, node.value) && within(node.right, node.value, high);
  }
  return within(buildTree(values), -Infinity, Infinity);
}

export const spliceCablesInput = z.strictObject({ lengths: positives });
export function spliceCables(lengths: number[]) {
  const heap = new MinHeap<number>((n) => n);
  for (const length of lengths) heap.push(length);
  let cost = 0;
  while (heap.size > 1) {
    const joined = heap.pop() + heap.pop();
    cost += joined;
    heap.push(joined);
  }
  return cost;
}

export const gridRescueHopsInput = z.strictObject({ grid: gridOf(/^[.#ST]*$/) })
  .refine((i) => { const all = i.grid.join(""); return (all.match(/S/g) ?? []).length === 1 && (all.match(/T/g) ?? []).length === 1; }, "Exactly one S and one T");
export function gridRescueHops(grid: string[]) {
  const rows = grid.length, cols = grid[0].length;
  let start = 0;
  for (let r = 0; r < rows; r++) { const c = grid[r].indexOf("S"); if (c >= 0) start = r * cols + c; }
  const distance = new Map<number, number>([[start, 0]]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const r = Math.floor(cell / cols), c = cell % cols;
    if (grid[r][c] === "T") return distance.get(cell)!;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || grid[nr][nc] === "#") continue;
      const next = nr * cols + nc;
      if (!distance.has(next)) { distance.set(next, distance.get(cell)! + 1); queue.push(next); }
    }
  }
  return -1;
}

export const orchardPlotsInput = z.strictObject({ grid: gridOf(/^[.T]*$/) });
export function orchardPlots(grid: string[]) {
  const rows = grid.length, cols = rows ? grid[0].length : 0;
  const seen = new Set<number>();
  let plots = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r][c] !== "T" || seen.has(r * cols + c)) continue;
    plots++;
    const stack = [r * cols + c];
    seen.add(r * cols + c);
    while (stack.length) {
      const cell = stack.pop()!;
      const cr = Math.floor(cell / cols), cc = cell % cols;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = cr + dr, nc = cc + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || grid[nr][nc] !== "T" || seen.has(nr * cols + nc)) continue;
        seen.add(nr * cols + nc);
        stack.push(nr * cols + nc);
      }
    }
  }
  return plots;
}

export const cheapestRouteInput = z.strictObject({
  stops: z.int().min(1).max(2000), roads: z.array(z.tuple([z.int().nonnegative(), z.int().nonnegative(), z.int().min(0).max(1_000_000)])).max(10_000),
  start: z.int().nonnegative(), target: z.int().nonnegative(),
}).refine((i) => i.start < i.stops && i.target < i.stops && i.roads.every(([a, b]) => a < i.stops && b < i.stops), "Stops must exist");
export function cheapestRoute(stops: number, roads: [number, number, number][], start: number, target: number) {
  const adjacent: [number, number][][] = Array.from({ length: stops }, () => []);
  for (const [a, b, cost] of roads) { adjacent[a].push([b, cost]); adjacent[b].push([a, cost]); }
  const best = new Array<number>(stops).fill(Infinity);
  best[start] = 0;
  const heap = new MinHeap<[number, number]>(([cost]) => cost);
  heap.push([0, start]);
  while (heap.size) {
    const [cost, stop] = heap.pop();
    if (cost > best[stop]) continue;
    if (stop === target) return cost;
    for (const [next, extra] of adjacent[stop]) {
      if (cost + extra < best[next]) { best[next] = cost + extra; heap.push([cost + extra, next]); }
    }
  }
  return -1;
}

export const crateCombinationsInput = z.strictObject({ weights: z.array(z.int().min(1).max(1000)).max(16), target: z.int().min(0).max(5000) })
  .refine((i) => new Set(i.weights).size === i.weights.length, "Weights must be distinct");
export function crateCombinations(weights: number[], target: number) {
  const sorted = [...weights].sort((a, b) => a - b);
  const results: number[][] = [];
  const chosen: number[] = [];
  function extend(from: number, remaining: number) {
    if (remaining === 0) { results.push([...chosen]); return; }
    for (let i = from; i < sorted.length && sorted[i] <= remaining; i++) {
      chosen.push(sorted[i]);
      extend(i + 1, remaining - sorted[i]);
      chosen.pop();
    }
  }
  extend(0, target);
  return results.sort(compareArrays);
}

export const watchtowerPlacementsInput = z.strictObject({ size: z.int().min(1).max(9) });
export function watchtowerPlacements(size: number) {
  const columns = new Set<number>(), rising = new Set<number>(), falling = new Set<number>();
  function place(row: number): number {
    if (row === size) return 1;
    let total = 0;
    for (let column = 0; column < size; column++) {
      if (columns.has(column) || rising.has(row + column) || falling.has(row - column)) continue;
      columns.add(column); rising.add(row + column); falling.add(row - column);
      total += place(row + 1);
      columns.delete(column); rising.delete(row + column); falling.delete(row - column);
    }
    return total;
  }
  return place(0);
}

export const fewestTokensInput = z.strictObject({ tokens: z.array(z.int().min(1).max(10_000)).min(1).max(50), amount: z.int().min(0).max(10_000) });
export function fewestTokens(tokens: number[], amount: number) {
  const fewest = new Array<number>(amount + 1).fill(Infinity);
  fewest[0] = 0;
  for (let value = 1; value <= amount; value++) {
    for (const token of tokens) if (token <= value && fewest[value - token] + 1 < fewest[value]) fewest[value] = fewest[value - token] + 1;
  }
  return fewest[amount] === Infinity ? -1 : fewest[amount];
}

export const sharedMelodyInput = z.strictObject({ first: z.string().max(1000).regex(/^[a-z]*$/), second: z.string().max(1000).regex(/^[a-z]*$/) });
export function sharedMelody(first: string, second: string) {
  let previous = new Array<number>(second.length + 1).fill(0);
  for (let i = 1; i <= first.length; i++) {
    const current = new Array<number>(second.length + 1).fill(0);
    for (let j = 1; j <= second.length; j++) {
      current[j] = first[i - 1] === second[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    }
    previous = current;
  }
  return previous[second.length];
}

export const risingMarksInput = z.strictObject({ marks: ints });
export function risingMarks(marks: number[]) {
  const tails: number[] = [];
  for (const mark of marks) {
    let left = 0, right = tails.length;
    while (left < right) {
      const middle = (left + right) >> 1;
      if (tails[middle] < mark) left = middle + 1;
      else right = middle;
    }
    tails[left] = mark;
  }
  return tails.length;
}

export const chargingHopsInput = z.strictObject({ ranges: z.array(z.int().min(0).max(10_000)).min(1).max(10_000) });
export function chargingHops(ranges: number[]) {
  let farthest = 0;
  for (let i = 0; i <= farthest && i < ranges.length; i++) farthest = Math.max(farthest, i + ranges[i]);
  return farthest >= ranges.length - 1;
}

export const bakeBatchesInput = z.strictObject({ trays: positives.min(1), days: z.int().min(1) })
  .refine((i) => i.days <= i.trays.length, "Days cannot exceed the number of trays");
export function bakeBatches(trays: number[], days: number) {
  function batchesNeeded(capacity: number) {
    let batches = 1, load = 0;
    for (const tray of trays) {
      if (load + tray > capacity) { batches++; load = 0; }
      load += tray;
    }
    return batches;
  }
  let low = Math.max(...trays), high = trays.reduce((a, b) => a + b, 0);
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (batchesNeeded(middle) <= days) high = middle;
    else low = middle + 1;
  }
  return low;
}

export const mergeShiftsInput = z.strictObject({ shifts: z.array(z.tuple([int, int])).max(10_000) })
  .refine((i) => i.shifts.every(([a, b]) => a <= b), "Each shift must start before it ends");
export function mergeShifts(shifts: [number, number][]) {
  const sorted = shifts.map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const merged: number[][] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

export const rankTagsInput = z.strictObject({ tags: z.array(word.min(1)).max(10_000) });
export function rankTags(tags: string[]) {
  const counts = new Map<string, number>();
  for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || (a < b ? -1 : a > b ? 1 : 0));
}

export const firstRedundantLinkInput = z.strictObject({ stations: z.int().min(1).max(10_000), links: z.array(z.tuple([z.int().nonnegative(), z.int().nonnegative()])).max(10_000) })
  .refine((i) => i.links.every(([a, b]) => a < i.stations && b < i.stations), "Links must join existing stations");
export function firstRedundantLink(stations: number, links: [number, number][]) {
  const parent = Array.from({ length: stations }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  for (const [a, b] of links) {
    const rootA = find(a), rootB = find(b);
    if (rootA === rootB) return [a, b];
    parent[rootA] = rootB;
  }
  return [];
}

export const taskOrderInput = z.strictObject({ tasks: z.int().min(1).max(10_000), prerequisites: z.array(z.tuple([z.int().nonnegative(), z.int().nonnegative()])).max(10_000) })
  .refine((i) => i.prerequisites.every(([a, b]) => a < i.tasks && b < i.tasks), "Prerequisites must name existing tasks");
export function taskOrder(tasks: number, prerequisites: [number, number][]) {
  const blocked = new Array<number>(tasks).fill(0);
  const unlocks: number[][] = Array.from({ length: tasks }, () => []);
  for (const [before, after] of prerequisites) { unlocks[before].push(after); blocked[after]++; }
  const ready = new MinHeap<number>((n) => n);
  for (let task = 0; task < tasks; task++) if (blocked[task] === 0) ready.push(task);
  const order: number[] = [];
  while (ready.size) {
    const task = ready.pop();
    order.push(task);
    for (const next of unlocks[task]) if (--blocked[next] === 0) ready.push(next);
  }
  return order.length === tasks ? order : [];
}

export const prefixCountsInput = z.strictObject({ words: z.array(word).max(10_000), queries: z.array(word).max(10_000) });
export function prefixCounts(words: string[], queries: string[]) {
  type Node = { count: number; children: Map<string, Node> };
  const root: Node = { count: 0, children: new Map() };
  for (const w of words) {
    let node = root;
    node.count++;
    for (const letter of w) {
      let child = node.children.get(letter);
      if (!child) node.children.set(letter, child = { count: 0, children: new Map() });
      node = child;
      node.count++;
    }
  }
  return queries.map((query) => {
    let node: Node | undefined = root;
    for (const letter of query) { node = node.children.get(letter); if (!node) return 0; }
    return node.count;
  });
}

export const loneSensorInput = z.strictObject({ readings: ints.min(1) }).refine((i) => {
  const counts = new Map<number, number>();
  for (const n of i.readings) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.values()].filter((c) => c === 1).length === 1 && [...counts.values()].every((c) => c === 1 || c === 2);
}, "Exactly one reading is single and every other reading is paired");
export function loneSensor(readings: number[]) {
  let lone = 0;
  for (const reading of readings) lone ^= reading;
  return lone;
}

export const primeTallyInput = z.strictObject({ limit: z.int().min(0).max(1_000_000) });
export function primeTally(limit: number) {
  if (limit < 3) return 0;
  const composite = new Uint8Array(limit);
  let count = 0;
  for (let n = 2; n < limit; n++) {
    if (composite[n]) continue;
    count++;
    for (let multiple = n * n; multiple < limit; multiple += n) composite[multiple] = 1;
  }
  return count;
}

const operation = z.union([z.tuple([z.literal("put"), int, int]), z.tuple([z.literal("get"), int])]);
export const lruResultsInput = z.strictObject({ capacity: z.int().min(1).max(10_000), operations: z.array(operation).max(10_000) });
export function lruResults(capacity: number, operations: (["put", number, number] | ["get", number])[]) {
  const cache = new Map<number, number>();
  const results: number[] = [];
  for (const op of operations) {
    if (op[0] === "get") {
      const value = cache.get(op[1]);
      if (value === undefined) { results.push(-1); continue; }
      cache.delete(op[1]);
      cache.set(op[1], value);
      results.push(value);
    } else {
      cache.delete(op[1]);
      cache.set(op[1], op[2]);
      if (cache.size > capacity) cache.delete(cache.keys().next().value!);
    }
  }
  return results;
}

export const gutterCapacityInput = z.strictObject({ heights: z.array(z.int().min(0).max(1_000_000)).max(10_000) });
export function gutterCapacity(heights: number[]) {
  let left = 0, right = heights.length - 1, leftWall = 0, rightWall = 0, water = 0;
  while (left < right) {
    if (heights[left] < heights[right]) {
      leftWall = Math.max(leftWall, heights[left]);
      water += leftWall - heights[left];
      left++;
    } else {
      rightWall = Math.max(rightWall, heights[right]);
      water += rightWall - heights[right];
      right--;
    }
  }
  return water;
}

// ---------------------------------------------------------------------------------------------------------------

type Entry = { input: z.ZodType; solve: (...args: never[]) => unknown };
const entry = <S extends z.ZodType>(input: S, solve: (...args: never[]) => unknown): Entry => ({ input, solve });

export const LIBRARY: Record<string, Entry> = {
  "ridge-count": entry(ridgeCountInput, ridgeCount),
  "ticket-pair": entry(ticketPairInput, ticketPair),
  "mirror-callsign": entry(mirrorCallsignInput, mirrorCallsign),
  "longest-clean-streak": entry(longestCleanStreakInput, longestCleanStreak),
  "balanced-blueprint": entry(balancedBlueprintInput, balancedBlueprint),
  "warmer-wait": entry(warmerWaitInput, warmerWait),
  "ticket-turns": entry(ticketTurnsInput, ticketTurns),
  "chain-loop-start": entry(chainLoopStartInput, chainLoopStart),
  "balanced-canopy": entry(balancedCanopyInput, balancedCanopy),
  "ledger-tree-check": entry(ledgerTreeCheckInput, ledgerTreeCheck),
  "splice-cables": entry(spliceCablesInput, spliceCables),
  "grid-rescue-hops": entry(gridRescueHopsInput, gridRescueHops),
  "orchard-plots": entry(orchardPlotsInput, orchardPlots),
  "cheapest-route": entry(cheapestRouteInput, cheapestRoute),
  "crate-combinations": entry(crateCombinationsInput, crateCombinations),
  "watchtower-placements": entry(watchtowerPlacementsInput, watchtowerPlacements),
  "fewest-tokens": entry(fewestTokensInput, fewestTokens),
  "shared-melody": entry(sharedMelodyInput, sharedMelody),
  "rising-marks": entry(risingMarksInput, risingMarks),
  "charging-hops": entry(chargingHopsInput, chargingHops),
  "bake-batches": entry(bakeBatchesInput, bakeBatches),
  "merge-shifts": entry(mergeShiftsInput, mergeShifts),
  "rank-tags": entry(rankTagsInput, rankTags),
  "first-redundant-link": entry(firstRedundantLinkInput, firstRedundantLink),
  "task-order": entry(taskOrderInput, taskOrder),
  "prefix-counts": entry(prefixCountsInput, prefixCounts),
  "lone-sensor": entry(loneSensorInput, loneSensor),
  "prime-tally": entry(primeTallyInput, primeTally),
  "lru-results": entry(lruResultsInput, lruResults),
  "gutter-capacity": entry(gutterCapacityInput, gutterCapacity),
};

// Positional arguments follow the runner signature, so a JSON input object is never spread by key order.
export function libraryResult(slug: string, input: unknown): unknown {
  const item = Object.hasOwn(LIBRARY, slug) ? LIBRARY[slug] : undefined;
  const signature = Object.hasOwn(SIGNATURES, slug) ? SIGNATURES[slug] : undefined;
  if (!item || !signature) return undefined;
  const parsed = item.input.parse(input) as Record<string, unknown>;
  return item.solve(...(signature.keys.map((key) => parsed[key]) as never[]));
}

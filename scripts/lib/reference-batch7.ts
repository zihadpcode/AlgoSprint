import { z } from "zod";
import type { ExpansionEntry, Rng } from "./reference-expansion";

// Trusted references for library batch 7. Same contract as reference-batch6.ts: a strict input schema, the typed
// reference that computes expected outputs, an independent brute-force baseline and a seeded sampler. JSON code strings
// from seed files are NEVER evaluated here.

type Solver = (...args: never[]) => unknown;
const entry = <S extends z.ZodType>(input: S, solve: Solver, brute: Solver, sample: (rng: Rng) => Record<string, unknown>): ExpansionEntry =>
  ({ input, solve, brute, sample });

const ints = (rng: Rng, length: number, min: number, max: number) => Array.from({ length }, () => rng.int(min, max));
const randomWord = (rng: Rng, length: number, alphabet = "abc") => Array.from({ length }, () => rng.pick([...alphabet])).join("");

// ---------- Worn Tiles: how many tiles are covered by at least `limit` cleaning passes? ----------

export const wornTilesInput = z.strictObject({
  length: z.int().min(1).max(100_000),
  passes: z.array(z.tuple([z.int().min(0).max(99_999), z.int().min(0).max(99_999)])).max(3_500),
  limit: z.int().min(1).max(3_500),
}).refine((i) => i.passes.every(([from, to]) => from <= to && to < i.length), "Every pass must satisfy from <= to < length");
export function wornTiles(length: number, passes: [number, number][], limit: number) {
  // Difference array: +1 where a pass starts, -1 just after it ends; a running sum is the pass count of each tile.
  const change = new Int32Array(length + 1);
  for (const [from, to] of passes) { change[from]++; change[to + 1]--; }
  let running = 0, worn = 0;
  for (let tile = 0; tile < length; tile++) {
    running += change[tile];
    if (running >= limit) worn++;
  }
  return worn;
}
function wornTilesBrute(length: number, passes: [number, number][], limit: number) {
  const scrubbed = new Array<number>(length).fill(0);
  for (const [from, to] of passes) for (let tile = from; tile <= to; tile++) scrubbed[tile]++;
  return scrubbed.filter((count) => count >= limit).length;
}
const wornTilesSample = (rng: Rng) => {
  const length = rng.int(1, 30);
  const passes = Array.from({ length: rng.int(0, 12) }, () => { const a = rng.int(0, length - 1), b = rng.int(0, length - 1); return [Math.min(a, b), Math.max(a, b)]; });
  return { length, passes, limit: rng.int(1, 5) };
};

// ---------- Close Calls: pairs of readings that differ by at most the tolerance ----------

export const closeCallsInput = z.strictObject({
  readings: z.array(z.int().min(0).max(999)).min(1).max(15_000),
  tolerance: z.int().min(0).max(999),
});
export function closeCalls(readings: number[], tolerance: number) {
  const sorted = Int32Array.from(readings).sort();
  let low = 0, pairs = 0;
  for (let high = 0; high < sorted.length; high++) {
    // Everything from `low` up to just before `high` is within tolerance of sorted[high].
    while (sorted[high] - sorted[low] > tolerance) low++;
    pairs += high - low;
  }
  return pairs;
}
function closeCallsBrute(readings: number[], tolerance: number) {
  let pairs = 0;
  for (let i = 0; i < readings.length; i++) for (let j = i + 1; j < readings.length; j++) if (Math.abs(readings[i] - readings[j]) <= tolerance) pairs++;
  return pairs;
}
const closeCallsSample = (rng: Rng) => {
  const spread = rng.pick([5, 20, 999]);
  return { readings: ints(rng, rng.int(1, 14), 0, spread), tolerance: rng.int(0, Math.min(999, rng.pick([0, 2, 6, 999]))) };
};

// ---------- Dial Distance: clicks between two settings of a reflected-code dial ----------

const MAX_DIAL = 2 ** 30;
export const dialDistanceInput = z.strictObject({
  bits: z.int().min(1).max(30),
  pairs: z.array(z.tuple([z.int().min(0).max(MAX_DIAL - 1), z.int().min(0).max(MAX_DIAL - 1)])).min(1).max(2_500),
}).refine((i) => i.pairs.every(([a, b]) => a < 2 ** i.bits && b < 2 ** i.bits), "Every setting must be below 2^bits");
// The setting shown at click k is k XOR (k >> 1). Decoding folds the high bits downward (a prefix XOR).
function dialStep(setting: number) {
  let step = setting;
  step ^= step >> 1; step ^= step >> 2; step ^= step >> 4; step ^= step >> 8; step ^= step >> 16;
  return step;
}
export function dialDistance(bits: number, pairs: [number, number][]) {
  const total = 2 ** bits;
  return pairs.map(([a, b]) => {
    const apart = Math.abs(dialStep(a) - dialStep(b));
    return Math.min(apart, total - apart);
  });
}
function dialDistanceBrute(bits: number, pairs: [number, number][]) {
  const total = 2 ** bits;
  return pairs.map(([a, b]) => {
    // Walk the dial from click 0 by building the reflected sequence, remembering where each setting first shows up.
    let stepA = -1, stepB = -1;
    for (let click = 0; click < total && (stepA < 0 || stepB < 0); click++) {
      const shown = click ^ Math.floor(click / 2);
      if (shown === a) stepA = click;
      if (shown === b) stepB = click;
    }
    const forward = (stepB - stepA + total) % total;
    return Math.min(forward, total - forward);
  });
}
const dialDistanceSample = (rng: Rng) => {
  const bits = rng.int(1, 9);
  return { bits, pairs: Array.from({ length: rng.int(1, 6) }, () => { const a = rng.int(0, 2 ** bits - 1); return [a, rng.chance(0.2) ? a : rng.int(0, 2 ** bits - 1)]; }) };
};

// ---------- Zero Tail: trailing zeros of a product written in another base ----------

export const zeroTailInput = z.strictObject({
  numbers: z.array(z.int().min(1).max(1_000_000_000)).min(1).max(5_000),
  base: z.int().min(2).max(1_000_000_000),
});
export function zeroTail(numbers: number[], base: number) {
  // A product ends in k zeros in `base` exactly when base^k divides it: for each prime power p^e || base, the product
  // must hold at least k*e copies of p. Factor the base once, then count each prime across the numbers.
  let remaining = base, best = Infinity;
  for (let prime = 2; remaining > 1; prime++) {
    if (prime * prime > remaining) prime = remaining; // what is left is itself prime
    if (remaining % prime !== 0) continue;
    let need = 0;
    while (remaining % prime === 0) { remaining /= prime; need++; }
    let have = 0;
    for (const value of numbers) { let rest = value; while (rest % prime === 0) { rest /= prime; have++; } }
    best = Math.min(best, Math.floor(have / need));
  }
  return best;
}
function zeroTailBrute(numbers: number[], base: number) {
  let product = BigInt(1);
  for (const value of numbers) product *= BigInt(value);
  const divisor = BigInt(base);
  let zeros = 0;
  while (product % divisor === BigInt(0)) { product /= divisor; zeros++; }
  return zeros;
}
const zeroTailSample = (rng: Rng) => {
  const base = rng.pick([2, 3, 4, 5, 6, 8, 10, 12, 16, 18, 30, 36, 49, 97, 100, 210, rng.int(2, 300)]);
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 15, 16, 20, 25, 30, 49, 64, 97, 125];
  return { numbers: Array.from({ length: rng.int(1, 8) }, () => (rng.chance(0.7) ? rng.pick(pool) : rng.int(1, 200))), base };
};

// ---------- Toll Slide: cheapest right/down walk with one free slide along a row ----------

export const tollSlideInput = z.strictObject({
  grid: z.array(z.array(z.int().min(0).max(99)).min(1).max(150)).min(1).max(150),
}).superRefine((input, ctx) => {
  const width = input.grid[0].length;
  if (input.grid.some((row) => row.length !== width)) ctx.addIssue({ code: "custom", message: "Every row must have the same length" });
  else if (input.grid.length * width > 20_000) ctx.addIssue({ code: "custom", message: "The grid may hold at most 20,000 cells" });
});
export function tollSlide(grid: number[][]) {
  const rows = grid.length, cols = grid[0].length;
  const INF = 1_000_000_000;
  // plain[c]: cheapest arrival at (row, c) with the slide unused; slid[c]: slide already used.
  let plain = new Array<number>(cols).fill(INF), slid = new Array<number>(cols).fill(INF);
  for (let r = 0; r < rows; r++) {
    const nextPlain = new Array<number>(cols).fill(INF), nextSlid = new Array<number>(cols).fill(INF);
    let cheapestPlainBefore = INF; // min nextPlain over columns to the left in this row (slide origins)
    for (let c = 0; c < cols; c++) {
      const cost = grid[r][c];
      if (r === 0 && c === 0) nextPlain[c] = cost;
      else {
        nextPlain[c] = Math.min(r > 0 ? plain[c] : INF, c > 0 ? nextPlain[c - 1] : INF) + cost;
        nextSlid[c] = Math.min(Math.min(r > 0 ? slid[c] : INF, c > 0 ? nextSlid[c - 1] : INF) + cost, cheapestPlainBefore);
      }
      cheapestPlainBefore = Math.min(cheapestPlainBefore, nextPlain[c]);
    }
    plain = nextPlain; slid = nextSlid;
  }
  return Math.min(plain[cols - 1], slid[cols - 1]);
}
function tollSlideBrute(grid: number[][]) {
  const rows = grid.length, cols = grid[0].length;
  let best = Infinity;
  const walk = (r: number, c: number, paid: number, slideUsed: boolean) => {
    if (r === rows - 1 && c === cols - 1) { best = Math.min(best, paid); return; }
    if (r + 1 < rows) walk(r + 1, c, paid + grid[r + 1][c], slideUsed);
    if (c + 1 < cols) walk(r, c + 1, paid + grid[r][c + 1], slideUsed);
    if (!slideUsed) for (let target = c + 1; target < cols; target++) walk(r, target, paid, true);
  };
  walk(0, 0, grid[0][0], false);
  return best;
}
const tollSlideSample = (rng: Rng) => {
  const rows = rng.int(1, 5), cols = rng.int(1, 5), top = rng.pick([3, 9, 99]);
  return { grid: Array.from({ length: rows }, () => ints(rng, cols, 0, top)) };
};

// ---------- Bay Ledger: point assignments, prefix totals and "which bay holds box k" ----------

const bayOp = z.union([
  z.tuple([z.literal("set"), z.int().min(1).max(100_000), z.int().min(0).max(1_000)]),
  z.tuple([z.literal("total"), z.int().min(1).max(100_000)]),
  z.tuple([z.literal("locate"), z.int().min(1).max(1_000_000_000)]),
]);
type BayOp = z.infer<typeof bayOp>;
export const bayLedgerInput = z.strictObject({
  bays: z.int().min(1).max(100_000),
  operations: z.array(bayOp).max(3_000),
}).refine((i) => i.operations.every((op) => op[0] === "locate" || op[1] <= i.bays), "Bay numbers must be between 1 and bays");
export function bayLedger(bays: number, operations: BayOp[]) {
  const tree = new Float64Array(bays + 1); // Fenwick tree over box counts
  const held = new Int32Array(bays + 1);
  let top = 1;
  while (top * 2 <= bays) top *= 2;
  const out: number[] = [];
  for (const op of operations) {
    if (op[0] === "set") {
      const change = op[2] - held[op[1]];
      held[op[1]] = op[2];
      for (let at = op[1]; at <= bays; at += at & -at) tree[at] += change;
    } else if (op[0] === "total") {
      let sum = 0;
      for (let at = op[1]; at > 0; at -= at & -at) sum += tree[at];
      out.push(sum);
    } else {
      // Binary descent: take the largest position whose prefix total is still below the target; the answer is the next bay.
      let at = 0, remaining = op[1];
      for (let step = top; step > 0; step >>= 1) {
        if (at + step <= bays && tree[at + step] < remaining) { at += step; remaining -= tree[at]; }
      }
      out.push(at + 1 <= bays ? at + 1 : -1);
    }
  }
  return out;
}
function bayLedgerBrute(bays: number, operations: BayOp[]) {
  const counts = new Array<number>(bays + 1).fill(0);
  const out: number[] = [];
  for (const op of operations) {
    if (op[0] === "set") counts[op[1]] = op[2];
    else if (op[0] === "total") { let sum = 0; for (let bay = 1; bay <= op[1]; bay++) sum += counts[bay]; out.push(sum); }
    else {
      let sum = 0, found = -1;
      for (let bay = 1; bay <= bays && found < 0; bay++) { sum += counts[bay]; if (sum >= op[1]) found = bay; }
      out.push(found);
    }
  }
  return out;
}
const bayLedgerSample = (rng: Rng) => {
  const bays = rng.int(1, 12), top = rng.pick([1, 4, 30]);
  return {
    bays,
    operations: Array.from({ length: rng.int(1, 18) }, (): BayOp => {
      const kind = rng.int(0, 2);
      if (kind === 0) return ["set", rng.int(1, bays), rng.int(0, top)];
      if (kind === 1) return ["total", rng.int(1, bays)];
      return ["locate", rng.int(1, Math.max(1, bays * Math.min(top, 3)))];
    }),
  };
};

// ---------- Booth Bookings: reservations that need a cleaning gap, with cancellation ----------

const HORIZON = 1_000_000;
const boothOp = z.union([
  z.tuple([z.literal("book"), z.int().min(0).max(HORIZON - 1), z.int().min(1).max(HORIZON)]),
  z.tuple([z.literal("cancel"), z.int().min(1).max(2_500)]),
  z.tuple([z.literal("next"), z.int().min(0).max(HORIZON)]),
]);
type BoothOp = z.infer<typeof boothOp>;
export const boothBookingsInput = z.strictObject({
  gap: z.int().min(0).max(1_000),
  operations: z.array(boothOp).max(2_500),
}).refine((i) => i.operations.every((op) => op[0] !== "book" || op[1] < op[2]), "A booking must end after it starts");
export function boothBookings(gap: number, operations: BoothOp[]) {
  // Active bookings sorted by start. They never overlap, so starts are distinct and the order is also the order of ends.
  const starts: number[] = [], ends: number[] = [];
  const startOfId = new Map<number, number>();
  let issued = 0;
  const firstAtLeast = (time: number) => {
    let low = 0, high = starts.length;
    while (low < high) { const mid = (low + high) >> 1; if (starts[mid] < time) low = mid + 1; else high = mid; }
    return low;
  };
  const out: (number | boolean)[] = [];
  for (const op of operations) {
    if (op[0] === "book") {
      const [, start, end] = op;
      const at = firstAtLeast(start);
      // Only the neighbours in time can collide: the booking before (its end plus the gap) and the one after.
      const clearBefore = at === 0 || ends[at - 1] + gap <= start;
      const clearAfter = at === starts.length || end + gap <= starts[at];
      if (clearBefore && clearAfter) {
        starts.splice(at, 0, start); ends.splice(at, 0, end);
        startOfId.set(++issued, start);
        out.push(issued);
      } else out.push(-1);
    } else if (op[0] === "cancel") {
      const start = startOfId.get(op[1]);
      if (start === undefined) out.push(false);
      else { const at = firstAtLeast(start); starts.splice(at, 1); ends.splice(at, 1); startOfId.delete(op[1]); out.push(true); }
    } else {
      const at = firstAtLeast(op[1]);
      out.push(at === starts.length ? -1 : starts[at]);
    }
  }
  return out;
}
function boothBookingsBrute(gap: number, operations: BoothOp[]) {
  // A minute-by-minute calendar: owner[m] is the booking id occupying minute m (0 = free), isStart marks first minutes.
  const owner = new Int32Array(HORIZON + 1), isStart = new Uint8Array(HORIZON + 1);
  const span = new Map<number, [number, number]>();
  let issued = 0;
  const out: (number | boolean)[] = [];
  for (const op of operations) {
    if (op[0] === "book") {
      const [, start, end] = op;
      let clash = false;
      for (let minute = Math.max(0, start - gap); minute < Math.min(HORIZON, end + gap) && !clash; minute++) if (owner[minute] !== 0) clash = true;
      if (clash) out.push(-1);
      else {
        issued++;
        for (let minute = start; minute < end; minute++) owner[minute] = issued;
        isStart[start] = 1; span.set(issued, [start, end]);
        out.push(issued);
      }
    } else if (op[0] === "cancel") {
      const booking = span.get(op[1]);
      if (!booking) out.push(false);
      else { for (let minute = booking[0]; minute < booking[1]; minute++) owner[minute] = 0; isStart[booking[0]] = 0; span.delete(op[1]); out.push(true); }
    } else {
      let minute = op[1];
      while (minute <= HORIZON && !isStart[minute]) minute++;
      out.push(minute > HORIZON ? -1 : minute);
    }
  }
  return out;
}
const boothBookingsSample = (rng: Rng) => {
  const horizon = rng.pick([12, 40, 300]);
  const gap = rng.pick([0, 1, 3, 10]);
  return {
    gap,
    operations: Array.from({ length: rng.int(1, 22) }, (): BoothOp => {
      const kind = rng.int(0, 5);
      if (kind <= 2) { const start = rng.int(0, horizon - 1); return ["book", start, Math.min(HORIZON, start + rng.int(1, Math.max(1, horizon / 4)))]; }
      if (kind === 3) return ["cancel", rng.int(1, 8)];
      return ["next", rng.int(0, horizon)];
    }),
  };
};

// ---------- Pulse Gates: shortest time through a grid whose gates open on a repeating beat ----------

const GATE_CELL = /^[.#SE0-5]+$/;
export const pulseGatesInput = z.strictObject({
  grid: z.array(z.string().regex(GATE_CELL).max(250)).min(1).max(250),
  period: z.int().min(1).max(6),
}).superRefine((input, ctx) => {
  const width = input.grid[0].length;
  if (input.grid.some((row) => row.length !== width)) { ctx.addIssue({ code: "custom", message: "Every row must have the same length" }); return; }
  if (input.grid.length * width > 60_000) ctx.addIssue({ code: "custom", message: "The grid may hold at most 60,000 cells" });
  const all = input.grid.join("");
  if ([...all].filter((ch) => ch === "S").length !== 1 || [...all].filter((ch) => ch === "E").length !== 1) ctx.addIssue({ code: "custom", message: "The grid needs exactly one S and one E" });
  if ([...all].some((ch) => ch >= "0" && ch <= "9" && Number(ch) >= input.period)) ctx.addIssue({ code: "custom", message: "Gate digits must be below period" });
});
const DIRECTIONS: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function pulseGates(grid: string[], period: number) {
  const rows = grid.length, cols = grid[0].length;
  const cells = rows * cols;
  const flat = grid.join("");
  const open = (cell: number, time: number) => {
    const ch = flat.charCodeAt(cell);
    if (ch === 35) return false; // '#'
    return ch < 48 || ch > 57 || (time % period) === ch - 48;
  };
  const start = flat.indexOf("S"), goal = flat.indexOf("E");
  // State = (cell, time mod period). Every move takes one tick, so breadth-first order is time order.
  const seen = new Uint8Array(cells * period);
  const queue = new Int32Array(cells * period);
  const clock = new Int32Array(cells * period);
  let head = 0, tail = 0;
  seen[start * period] = 1; queue[tail] = start; clock[tail++] = 0;
  while (head < tail) {
    const cell = queue[head], time = clock[head++];
    if (cell === goal) return time;
    const r = Math.floor(cell / cols), c = cell % cols;
    for (const [dr, dc] of DIRECTIONS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const next = nr * cols + nc, nextTime = time + 1;
      if (!open(next, nextTime) || seen[next * period + (nextTime % period)]) continue;
      seen[next * period + (nextTime % period)] = 1;
      queue[tail] = next; clock[tail++] = nextTime;
    }
  }
  return -1;
}
function pulseGatesBrute(grid: string[], period: number) {
  const rows = grid.length, cols = grid[0].length;
  let here = new Set<number>();
  let goal = -1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (grid[r][c] === "S") here.add(r * cols + c); if (grid[r][c] === "E") goal = r * cols + c; }
  if (here.has(goal)) return 0;
  // Simulate the set of cells you could be standing on, tick by tick. After rows*cols*period ticks nothing new can happen.
  for (let time = 1; time <= rows * cols * period; time++) {
    const after = new Set<number>();
    for (const cell of here) {
      const r = Math.floor(cell / cols), c = cell % cols;
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const ch = grid[nr][nc];
        if (ch === "#") continue;
        if (ch >= "0" && ch <= "9" && Number(ch) !== time % period) continue;
        after.add(nr * cols + nc);
      }
    }
    if (after.has(goal)) return time;
    here = after;
  }
  return -1;
}
const pulseGatesSample = (rng: Rng) => {
  const rows = rng.int(1, 6), cols = rng.int(rows === 1 ? 2 : 1, 7), period = rng.int(1, 4);
  const wall = rng.pick([0.1, 0.25, 0.4]), gate = rng.pick([0, 0.15, 0.3]);
  const cells: string[] = Array.from({ length: rows * cols }, () => {
    const roll = rng.int(0, 99) / 100;
    if (roll < wall) return "#";
    if (roll < wall + gate) return String(rng.int(0, period - 1));
    return ".";
  });
  const start = rng.int(0, cells.length - 1);
  let goal = rng.int(0, cells.length - 1);
  while (goal === start) goal = rng.int(0, cells.length - 1);
  cells[start] = "S"; cells[goal] = "E";
  return { grid: Array.from({ length: rows }, (_, r) => cells.slice(r * cols, (r + 1) * cols).join("")), period };
};

// ---------- Profit Block: best total of a block whose length lies in [minLen, maxLen] ----------

export const profitBlockInput = z.strictObject({
  profits: z.array(z.int().min(-9).max(9)).min(1).max(20_000),
  minLen: z.int().min(1).max(20_000),
  maxLen: z.int().min(1).max(20_000),
}).refine((i) => i.minLen <= i.maxLen && i.maxLen <= i.profits.length, "Lengths must satisfy 1 <= minLen <= maxLen <= profits.length");
export function profitBlock(profits: number[], minLen: number, maxLen: number) {
  const n = profits.length;
  const prefix = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + profits[i];
  // For a block ending at prefix index e, the start prefix index s lies in [e - maxLen, e - minLen]. The deque holds
  // candidate starts with strictly increasing prefix values, so its front is the cheapest start in the window.
  const deque = new Int32Array(n + 1);
  let head = 0, tail = 0, best = -Infinity;
  for (let end = minLen; end <= n; end++) {
    const entering = end - minLen;
    while (tail > head && prefix[deque[tail - 1]] >= prefix[entering]) tail--;
    deque[tail++] = entering;
    while (deque[head] < end - maxLen) head++;
    best = Math.max(best, prefix[end] - prefix[deque[head]]);
  }
  return best;
}
function profitBlockBrute(profits: number[], minLen: number, maxLen: number) {
  let best = -Infinity;
  for (let start = 0; start < profits.length; start++) {
    let sum = 0;
    for (let length = 1; length <= maxLen && start + length <= profits.length; length++) {
      sum += profits[start + length - 1];
      if (length >= minLen) best = Math.max(best, sum);
    }
  }
  return best;
}
const profitBlockSample = (rng: Rng) => {
  const n = rng.int(1, 14), lean = rng.pick([-9, -3, 0, 3]);
  const profits = ints(rng, n, Math.max(-9, lean - 6), Math.min(9, lean + 6));
  const minLen = rng.int(1, n);
  return { profits, minLen, maxLen: rng.int(minLen, n) };
};

// ---------- Tile Pop: interval DP over a rail of tiles that pop in neighbouring pairs ----------

export const tilePopInput = z.strictObject({
  weights: z.array(z.int().min(1).max(1_000)).min(1).max(200),
  tolerance: z.int().min(0).max(1_000),
});
export function tilePop(weights: number[], tolerance: number) {
  const n = weights.length;
  const width = n + 2;
  // clear[i][j]: tiles i..j can all be popped; best[i][j]: most weight poppable inside i..j. Index j + 1 style offsets
  // let an empty segment (j = i - 1) read as true / 0 without special cases.
  const clear = new Uint8Array(width * width), best = new Int32Array(width * width);
  const at = (i: number, j: number) => i * width + (j + 1);
  const sum = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) sum[i + 1] = sum[i] + weights[i];
  for (let i = 0; i <= n; i++) clear[at(i, i - 1)] = 1; // empty segments, including i = n
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i; j < n; j++) {
      let canClear = 0, most = best[at(i + 1, j)];
      for (let k = i + 1; k <= j; k += 2) {
        if (Math.abs(weights[i] - weights[k]) > tolerance || !clear[at(i + 1, k - 1)]) continue;
        if (clear[at(k + 1, j)]) canClear = 1;
        most = Math.max(most, sum[k + 1] - sum[i] + best[at(k + 1, j)]);
      }
      clear[at(i, j)] = canClear;
      best[at(i, j)] = most;
    }
  }
  return best[at(0, n - 1)];
}
function tilePopBrute(weights: number[], tolerance: number) {
  // Try every legal pop in every order on the current rail.
  const play = (rail: number[], gained: number): number => {
    let top = gained;
    for (let i = 0; i + 1 < rail.length; i++) {
      if (Math.abs(rail[i] - rail[i + 1]) > tolerance) continue;
      const after = rail.slice(0, i).concat(rail.slice(i + 2));
      top = Math.max(top, play(after, gained + rail[i] + rail[i + 1]));
    }
    return top;
  };
  return play(weights, 0);
}
const tilePopSample = (rng: Rng) => {
  const top = rng.pick([3, 10, 1000]);
  return { weights: ints(rng, rng.int(1, 11), 1, top), tolerance: rng.pick([0, 1, 2, 5, top]) };
};

// ---------- Prefix Echoes: how often does each prefix of a text occur inside it? ----------

export const prefixEchoesInput = z.strictObject({
  text: z.string().regex(/^[a-z]+$/).max(40_000),
  lengths: z.array(z.int().min(1).max(40_000)).min(1).max(3_000),
}).refine((i) => i.lengths.every((length) => length <= i.text.length), "Every length must be at most text.length");
export function prefixEchoes(text: string, lengths: number[]) {
  const n = text.length;
  const border = new Int32Array(n); // border[i]: longest proper prefix of text[0..i] that is also its suffix
  for (let i = 1, k = 0; i < n; i++) {
    while (k > 0 && text[i] !== text[k]) k = border[k - 1];
    if (text[i] === text[k]) k++;
    border[i] = k;
  }
  // Every end position contributes one occurrence to each prefix on its border chain. Push counts down the chain once.
  const echoes = new Float64Array(n + 1).fill(1);
  for (let length = n; length >= 1; length--) if (border[length - 1] > 0) echoes[border[length - 1]] += echoes[length];
  return lengths.map((length) => echoes[length]);
}
function prefixEchoesBrute(text: string, lengths: number[]) {
  return lengths.map((length) => {
    let count = 0;
    for (let start = 0; start + length <= text.length; start++) {
      let match = true;
      for (let offset = 0; offset < length && match; offset++) if (text[start + offset] !== text[offset]) match = false;
      if (match) count++;
    }
    return count;
  });
}
const prefixEchoesSample = (rng: Rng) => {
  const alphabet = rng.pick(["a", "ab", "abc"]);
  const unit = randomWord(rng, rng.int(1, 4), alphabet);
  const text = rng.chance(0.5) ? randomWord(rng, rng.int(1, 24), alphabet) : unit.repeat(rng.int(1, 6)) + randomWord(rng, rng.int(0, 3), alphabet);
  return { text, lengths: ints(rng, rng.int(1, 6), 1, text.length) };
};

// ---------- Scale Splits: count left/right assignments whose pans differ by at most the tolerance ----------

export const scaleSplitsInput = z.strictObject({
  weights: z.array(z.int().min(1).max(1_000_000_000)).min(1).max(36),
  tolerance: z.int().min(0).max(36_000_000_000),
});
export function scaleSplits(weights: number[], tolerance: number) {
  // Meet in the middle: every half yields its sorted list of signed sums (+w for the left pan, -w for the right).
  const signedSums = (items: number[]) => {
    let sums = new Float64Array([0]);
    for (const weight of items) {
      const merged = new Float64Array(sums.length * 2);
      let a = 0, b = 0, out = 0;
      // sums + weight and sums - weight are both sorted; merge them.
      while (a < sums.length && b < sums.length) merged[out++] = sums[a] + weight <= sums[b] - weight ? sums[a++] + weight : sums[b++] - weight;
      while (a < sums.length) merged[out++] = sums[a++] + weight;
      while (b < sums.length) merged[out++] = sums[b++] - weight;
      sums = merged;
    }
    return sums;
  };
  const half = weights.length >> 1;
  const left = signedSums(weights.slice(0, half)), right = signedSums(weights.slice(half));
  // Pairs (x from left, y from right) with x + y <= limit, for an ascending x and a descending pointer into right.
  const atMost = (limit: number) => {
    let pointer = right.length - 1, count = 0;
    for (let i = 0; i < left.length; i++) {
      while (pointer >= 0 && left[i] + right[pointer] > limit) pointer--;
      count += pointer + 1;
    }
    return count;
  };
  return atMost(tolerance) - atMost(-tolerance - 1);
}
function scaleSplitsBrute(weights: number[], tolerance: number) {
  const place = (index: number, difference: number): number => {
    if (index === weights.length) return Math.abs(difference) <= tolerance ? 1 : 0;
    return place(index + 1, difference + weights[index]) + place(index + 1, difference - weights[index]);
  };
  return place(0, 0);
}
const scaleSplitsSample = (rng: Rng) => {
  const top = rng.pick([3, 10, 1000]);
  const weights = ints(rng, rng.int(1, 12), 1, top);
  const total = weights.reduce((a, b) => a + b, 0);
  return { weights, tolerance: rng.pick([0, 0, 1, Math.floor(total / 4), total]) };
};

export const BATCH7: Record<string, ExpansionEntry> = {
  "worn-tiles": entry(wornTilesInput, wornTiles, wornTilesBrute, wornTilesSample),
  "close-calls": entry(closeCallsInput, closeCalls, closeCallsBrute, closeCallsSample),
  "dial-distance": entry(dialDistanceInput, dialDistance, dialDistanceBrute, dialDistanceSample),
  "zero-tail": entry(zeroTailInput, zeroTail, zeroTailBrute, zeroTailSample),
  "toll-slide": entry(tollSlideInput, tollSlide, tollSlideBrute, tollSlideSample),
  "bay-ledger": entry(bayLedgerInput, bayLedger, bayLedgerBrute, bayLedgerSample),
  "booth-bookings": entry(boothBookingsInput, boothBookings, boothBookingsBrute, boothBookingsSample),
  "pulse-gates": entry(pulseGatesInput, pulseGates, pulseGatesBrute, pulseGatesSample),
  "profit-block": entry(profitBlockInput, profitBlock, profitBlockBrute, profitBlockSample),
  "tile-pop": entry(tilePopInput, tilePop, tilePopBrute, tilePopSample),
  "prefix-echoes": entry(prefixEchoesInput, prefixEchoes, prefixEchoesBrute, prefixEchoesSample),
  "scale-splits": entry(scaleSplitsInput, scaleSplits, scaleSplitsBrute, scaleSplitsSample),
};

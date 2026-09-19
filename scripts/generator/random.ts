import { z } from "zod";

export const seedSchema = z.int().min(0).max(0xffffffff);
export type Random = ReturnType<typeof createRandom>;

// A local uint32 stream: no global Math.random state, clock, or network inputs.
export function createRandom(seed: number) {
  let state = seedSchema.parse(seed);
  return {
    int(min: number, max: number) {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max || max - min > 1_000_000) {
        throw new Error("Invalid random integer bounds.");
      }
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return min + Math.floor((state / 0x100000000) * (max - min + 1));
    },
  };
}

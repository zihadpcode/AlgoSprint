// Pure helpers for the resizable problem/editor divider. The ratio is the left panel's share of the width, in percent.
export const SPLIT_DEFAULT = 42;
export const SPLIT_MIN = 25;
export const SPLIT_MAX = 75;
export const SPLIT_STEP = 2;
export const SPLIT_BIG_STEP = 10;
export const SPLIT_STORAGE_KEY = "algosprint:workspace-split:v1";

export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(value * 10) / 10));
}

/** Returns the new ratio for a keyboard press on the separator, or null when the key is not a resize key. */
export function ratioForKey(key: string, current: number, shift = false): number | null {
  const step = shift ? SPLIT_BIG_STEP : SPLIT_STEP;
  switch (key) {
    case "ArrowLeft": case "ArrowUp": return clampRatio(current - step);
    case "ArrowRight": case "ArrowDown": return clampRatio(current + step);
    case "Home": return SPLIT_MIN;
    case "End": return SPLIT_MAX;
    case "Enter": return SPLIT_DEFAULT;
    default: return null;
  }
}

/** Pointer position to ratio, relative to the container's left edge and width. */
export function ratioForPointer(clientX: number, left: number, width: number): number {
  if (!(width > 0)) return SPLIT_DEFAULT;
  return clampRatio(((clientX - left) / width) * 100);
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function readStoredRatio(storage: StorageLike | null, key = SPLIT_STORAGE_KEY): number {
  try {
    const raw = storage?.getItem(key);
    if (raw == null) return SPLIT_DEFAULT;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampRatio(parsed) : SPLIT_DEFAULT;
  } catch { return SPLIT_DEFAULT; }
}
export function writeStoredRatio(storage: StorageLike | null, ratio: number, key = SPLIT_STORAGE_KEY) {
  try { storage?.setItem(key, String(clampRatio(ratio))); } catch { /* Blocked storage only loses the preference. */ }
}

import { twoPointers } from "./templates/two-pointers";
import { slidingWindow } from "./templates/sliding-window";
import { prefixSum } from "./templates/prefix-sum";
import { binarySearch } from "./templates/binary-search";
import { dynamicProgramming } from "./templates/dynamic-programming";

export const TEMPLATES = [twoPointers, slidingWindow, prefixSum, binarySearch, dynamicProgramming] as const;
export const GENERATOR_VERSION = 1;
export function findTemplate(id: string) {
  const template = TEMPLATES.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  return template;
}

// Only authored, versioned template IDs are trusted. Never derive executable code from JSON.
export function templateForSlug(slug: string) {
  const match = /^gen-v1-([a-z-]+)-(0|[1-9][0-9]{0,9})$/.exec(slug);
  if (!match || Number(match[2]) > 0xffffffff) return undefined;
  return TEMPLATES.find((item) => item.id === match[1]);
}

import { RUNNER_LIMITS } from "./limits";
import { SIGNATURES } from "./signatures";

// Shared by browser-safe authoring validation and trusted server execution.
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function makeStdin(slug: string, input: unknown): string {
  const signature = Object.hasOwn(SIGNATURES, slug) ? SIGNATURES[slug] : undefined;
  if (!signature || !input || typeof input !== "object" || Array.isArray(input)) throw new Error("Unsupported test input");
  const record = input as Record<string, unknown>;
  if (signature.keys.some((key) => !Object.hasOwn(record, key))) throw new Error("Missing test argument");
  const result = JSON.stringify(signature.keys.map((key) => record[key]));
  if (utf8ByteLength(result) > RUNNER_LIMITS.maxInputBytes) throw new Error("Test input exceeds MVP limit");
  return result;
}

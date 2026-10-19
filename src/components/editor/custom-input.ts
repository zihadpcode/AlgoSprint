import { RUNNER_LIMITS } from "@/features/submissions/limits";
import { utf8ByteLength } from "@/features/submissions/serialization";
import type { CaseResult } from "@/features/submissions/contracts";

// Custom input runs only in the learner's browser (JavaScript). It is validated here and never sent to the server.
export type CustomInputCheck = { ok: true; input: Record<string, unknown> } | { ok: false; error: string };

export function parseCustomInput(text: string, keys: readonly string[]): CustomInputCheck {
  if (utf8ByteLength(text) > RUNNER_LIMITS.maxInputBytes) return { ok: false, error: `Input is larger than ${RUNNER_LIMITS.maxInputBytes.toLocaleString("en-US")} bytes.` };
  if (!text.trim()) return { ok: false, error: "Enter a JSON object with one value per parameter." };
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch (error) { return { ok: false, error: `Invalid JSON: ${error instanceof Error ? error.message : "could not parse the input"}` }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, error: `Use a JSON object such as { ${keys.map((key) => `"${key}": …`).join(", ")} }.` };
  const record = parsed as Record<string, unknown>;
  const missing = keys.filter((key) => !Object.hasOwn(record, key));
  if (missing.length) return { ok: false, error: `Missing ${missing.length === 1 ? "parameter" : "parameters"}: ${missing.join(", ")}.` };
  const extra = Object.keys(record).filter((key) => !keys.includes(key));
  if (extra.length) return { ok: false, error: `Unknown ${extra.length === 1 ? "parameter" : "parameters"}: ${extra.join(", ")}. Expected ${keys.join(", ")}.` };
  return { ok: true, input: record };
}

/** Starting text for the editor: the first public example's values in signature order, else null placeholders. */
export function defaultCustomInput(keys: readonly string[], example?: unknown): string {
  const source = example && typeof example === "object" && !Array.isArray(example) ? example as Record<string, unknown> : {};
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, Object.hasOwn(source, key) ? source[key] : null])), null, 2);
}

export type CustomRunOutcome = { kind: "returned"; value: string; console: string; runtimeMs: number | null } | { kind: "error"; message: string; console: string };

/** Interprets the browser runner's single-case result without any expected-output comparison. */
export function customRunOutcome(result: CaseResult): CustomRunOutcome {
  // The runner reports a returned value as ACCEPTED or WRONG_ANSWER depending on the (unused) expected value.
  if (result.status === "ACCEPTED" || result.status === "WRONG_ANSWER") {
    let value = result.stdout;
    try { value = JSON.stringify(JSON.parse(result.stdout), null, 2); } catch { /* Keep the raw text. */ }
    return { kind: "returned", value, console: result.diagnostic, runtimeMs: result.runtimeMs };
  }
  return { kind: "error", message: result.diagnostic || (result.status === "TIME_LIMIT" ? "The run took too long." : "The run failed."), console: "" };
}

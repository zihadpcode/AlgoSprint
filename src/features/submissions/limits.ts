import { SIGNATURES } from "./signatures";

// Browser-safe runner limits. Shared by server runners (sandbox, Judge0, store) and the admin editor so authoring help
// and server validation never drift. Keep this module free of "server-only" imports: it is loaded by client components.

export const RUNNER_LIMITS = {
  // The sandbox worker and the Judge0 batch endpoint both enforce an array of 1..10 cases.
  maxCases: 10,
  // Per-case CPU budget. Judge0 caps cpu_time_limit at 2 s; the sandbox interrupts at this deadline too.
  maxTimeMs: 2000,
  // Per-case memory. Judge0 passes this as memory_limit (KB); the sandbox applies it to the interpreter runtime.
  maxMemoryKb: 262_144,
  // Wall-clock budget for the whole run — Judge0 abort timer and sandbox total deadline.
  totalBudgetMs: 20_000,
} as const;

// A slug is executable only if a reviewed signature exists for it. Custom slugs stay study-only until a signature is added.
export function runnerSupportsSlug(slug: string): boolean {
  return Object.hasOwn(SIGNATURES, slug);
}

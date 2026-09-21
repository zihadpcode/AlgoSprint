import { z } from "zod";
import { problemSlug } from "@/features/problems/detail-validation";

export const executionInput = z.object({
  slug: problemSlug,
  language: z.literal("JAVASCRIPT"),
  mode: z.enum(["RUN", "SUBMIT"]),
  code: z.string().min(1).max(20_000).refine((s) => s.trim().length > 0 && !s.includes("\0")),
}).strict();
export type ExecutionInput = z.infer<typeof executionInput>;
export type Verdict = "ACCEPTED" | "WRONG_ANSWER" | "COMPILE_ERROR" | "RUNTIME_ERROR" | "TIME_LIMIT" | "MEMORY_LIMIT" | "INTERNAL_ERROR";
export type CaseResult = {
  position: number; status: Verdict; input: unknown; expected: unknown;
  stdout: string; diagnostic: string; runtimeMs: number | null; memoryKb: number | null;
};
export type ExecutionResult = {
  id: string; problemRevision?: number; mode: "RUN" | "SUBMIT"; status: Verdict; passedCount: number; totalCount: number;
  runtimeMs: number | null; memoryKb: number | null; cases: CaseResult[];
  // Set when visible tests ran in the learner's browser: no attempt was saved and nothing reached the server.
  browser?: true;
};
export type RunnerSignature = { entryPoint: string; keys: string[] };
export type ExecutionState = { success: false; message: string } | { success: true; result: ExecutionResult };
export const verdictLabels: Record<Verdict, string> = {
  ACCEPTED: "Passed", WRONG_ANSWER: "Wrong answer", COMPILE_ERROR: "Compilation error",
  RUNTIME_ERROR: "Runtime error", TIME_LIMIT: "Time limit exceeded", MEMORY_LIMIT: "Memory limit exceeded",
  INTERNAL_ERROR: "Execution service unavailable",
};

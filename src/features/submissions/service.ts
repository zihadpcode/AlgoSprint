import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { RunnerConfig } from "./config";
import type { ExecutionInput, ExecutionResult, ExecutionState } from "./contracts";
import { executeJudge0 } from "./judge0";
import { reserveSubmission, finishSubmission } from "./store";

export async function runSubmission(db: PrismaClient, userId: string, input: ExecutionInput, config: RunnerConfig): Promise<ExecutionState> {
  const reservation = await reserveSubmission(db, userId, input);
  if ("error" in reservation) return { success: false, message: reservation.error! };
  let result: ExecutionResult = { id: reservation.id, mode: input.mode, status: "INTERNAL_ERROR", passedCount: 0,
    totalCount: reservation.cases.length, runtimeMs: null, memoryKb: null, cases: [] };
  try {
    const outcomes = await executeJudge0(config, reservation.source, reservation.cases.map((t) => ({ stdin: t.stdin, expected: t.output })), reservation.limits);
    const failure = outcomes.find((o) => o.status !== "ACCEPTED");
    const times = outcomes.map((o) => o.runtimeMs); const memories = outcomes.map((o) => o.memoryKb);
    result = { ...result, status: outcomes.some((o) => o.status === "INTERNAL_ERROR") ? "INTERNAL_ERROR" : failure?.status ?? "ACCEPTED",
      passedCount: outcomes.filter((o) => o.status === "ACCEPTED").length,
      runtimeMs: times.every((n) => n !== null) ? Math.max(...times as number[]) : null,
      memoryKb: memories.every((n) => n !== null) ? Math.max(...memories as number[]) : null,
      // Never return/store hidden stdout, stderr, compile output, inputs, or expected values.
      cases: input.mode === "RUN" ? outcomes.map((outcome, index) => ({ ...outcome,
        position: reservation.cases[index].position, input: reservation.cases[index].input, expected: reservation.cases[index].output })) : [],
    };
  } catch { /* Provider/queue failure is an infrastructure verdict, never an accepted solution. */ }
  await finishSubmission(db, userId, result);
  return { success: true, result };
}

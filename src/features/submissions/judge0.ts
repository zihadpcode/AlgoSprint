import "server-only";
import { isDeepStrictEqual } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { Judge0Config } from "./config";
import type { Verdict } from "./contracts";
import { RUNNER_LIMITS } from "./limits";
import { utf8ByteLength } from "./serialization";

export type RunnerCase = { stdin: string; expected: unknown };
export type RunnerOutcome = { status: Verdict; stdout: string; diagnostic: string; runtimeMs: number | null; memoryKb: number | null };
export const JUDGE0_BASE64_LIMIT = 4 * Math.ceil(RUNNER_LIMITS.maxOutputBytes / 3);
// Up to three output fields per case, plus bounded metadata. The wire encoding
// is larger than the decoded per-stream budget; valid batches must still fit.
export const JUDGE0_RESPONSE_LIMIT = RUNNER_LIMITS.maxCases * (3 * JUDGE0_BASE64_LIMIT + 1024) + 1024;
const encodedOutput = z.string().max(JUDGE0_BASE64_LIMIT).nullable().optional();
const responseSchema = z.object({
  status: z.object({ id: z.number().int().min(1).max(14) }),
  stdout: encodedOutput, stderr: encodedOutput, compile_output: encodedOutput,
  time: z.string().regex(/^\d+(\.\d+)?$/).nullable().optional(),
  memory: z.number().int().nonnegative().max(2147483647).nullable().optional(),
});

async function request(config: Judge0Config, path: string, signal: AbortSignal, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.auth === "rapidapi") {
    headers["X-RapidAPI-Key"] = config.key; headers["X-RapidAPI-Host"] = new URL(config.url).host;
  } else headers["X-Auth-Token"] = config.key;
  const response = await fetch(new URL(path, config.url), {
    method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]), cache: "no-store", redirect: "error",
  });
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error("Runner request failed"); }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > JUDGE0_RESPONSE_LIMIT) throw new Error("Runner response exceeds limit");
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
class OutputLimitError extends Error {}
function decode(value: string | null | undefined) {
  if (!value) return "";
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("Invalid runner encoding");
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength > RUNNER_LIMITS.maxOutputBytes) throw new OutputLimitError();
  const text = bytes.toString("utf8");
  if (utf8ByteLength(text) > RUNNER_LIMITS.maxOutputBytes) throw new OutputLimitError();
  return text;
}
export function judgeOutcome(raw: unknown, expected: unknown): RunnerOutcome | null {
  const result = responseSchema.parse(raw);
  const id = result.status.id;
  if (id <= 2) return null;
  const ms = result.time == null ? null : Math.ceil(Number(result.time) * 1000);
  if (ms !== null && (!Number.isFinite(ms) || ms > 2147483647)) throw new Error("Invalid runtime");
  let stdout: string, diagnostic: string;
  try {
    stdout = decode(result.stdout);
    const compileOutput = decode(result.compile_output), stderr = decode(result.stderr);
    diagnostic = compileOutput || stderr;
  } catch (error) {
    if (!(error instanceof OutputLimitError)) throw error;
    return { status: "RUNTIME_ERROR", stdout: "", diagnostic: "Output exceeds the sandbox limit.", runtimeMs: ms, memoryKb: result.memory ?? null };
  }
  let status: Verdict = id === 5 ? "TIME_LIMIT" : id === 6 ? "COMPILE_ERROR" : id >= 13 ? "INTERNAL_ERROR" : "RUNTIME_ERROR";
  if (id === 3 || id === 4) {
    status = "WRONG_ANSWER";
    try { if (id === 3 && isDeepStrictEqual(JSON.parse(stdout), expected)) status = "ACCEPTED"; } catch { /* Non-JSON output is a wrong answer. */ }
  }
  // Compare the complete bounded stdout first. Truncation is only for display/storage.
  return { status, stdout: stdout.slice(0, 4000), diagnostic: diagnostic.slice(0, 4000), runtimeMs: ms, memoryKb: result.memory ?? null };
}
// Batch endpoints create every case together; each bounded poll fetches the full batch.
const createdSchema = z.array(z.object({ token: z.uuid() })).min(1).max(RUNNER_LIMITS.maxCases);
const batchSchema = z.object({ submissions: z.array(z.unknown()).min(1).max(RUNNER_LIMITS.maxCases) });
export async function executeJudge0(config: Judge0Config, source: string, cases: RunnerCase[], limits: { timeMs: number; memoryKb: number }): Promise<RunnerOutcome[]> {
  if (!cases.length || cases.length > RUNNER_LIMITS.maxCases) throw new Error("Unsupported test count");
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), RUNNER_LIMITS.totalBudgetMs);
  try {
    const created = createdSchema.parse(await request(config, "/submissions/batch?base64_encoded=true", controller.signal, {
      submissions: cases.map((test) => ({
        language_id: config.languageId,
        source_code: Buffer.from(source).toString("base64"), stdin: Buffer.from(test.stdin).toString("base64"),
        // Expected values stay in this application, outside the untrusted program.
        cpu_time_limit: Math.min(limits.timeMs / 1000, RUNNER_LIMITS.maxTimeMs / 1000), cpu_extra_time: 0.5,
        wall_time_limit: 5, memory_limit: Math.min(limits.memoryKb, RUNNER_LIMITS.maxMemoryKb), stack_limit: 64000,
        max_file_size: Math.ceil(RUNNER_LIMITS.maxOutputBytes / 1024), max_processes_and_or_threads: 32,
        enable_per_process_and_thread_time_limit: false, enable_per_process_and_thread_memory_limit: false,
        enable_network: false, number_of_runs: 1, redirect_stderr_to_stdout: false,
      })),
    }));
    if (created.length !== cases.length) throw new Error("Runner created an unexpected number of submissions");
    const tokens = created.map((item) => item.token).join(",");
    const outcomes: (RunnerOutcome | null)[] = cases.map(() => null);
    for (let attempt = 0; attempt < 20; attempt++) {
      await delay(1000, undefined, { signal: controller.signal });
      const batch = batchSchema.parse(await request(config, `/submissions/batch?tokens=${tokens}&base64_encoded=true&fields=status,stdout,stderr,compile_output,time,memory`, controller.signal));
      if (batch.submissions.length !== cases.length) throw new Error("Runner returned an unexpected number of submissions");
      batch.submissions.forEach((raw, index) => { if (!outcomes[index]) outcomes[index] = judgeOutcome(raw, cases[index].expected); });
      if (outcomes.every((outcome) => outcome !== null)) return outcomes as RunnerOutcome[];
    }
    throw new Error("Runner queue timed out");
  } finally { clearTimeout(deadline); controller.abort(); }
}

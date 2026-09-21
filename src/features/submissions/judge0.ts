import "server-only";
import { isDeepStrictEqual } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { RunnerConfig } from "./config";
import type { Verdict } from "./contracts";

export type RunnerCase = { stdin: string; expected: unknown };
export type RunnerOutcome = { status: Verdict; stdout: string; diagnostic: string; runtimeMs: number | null; memoryKb: number | null };
const responseSchema = z.object({
  status: z.object({ id: z.number().int().min(1).max(14) }),
  stdout: z.string().max(90000).nullable().optional(), stderr: z.string().max(90000).nullable().optional(),
  compile_output: z.string().max(90000).nullable().optional(),
  time: z.string().regex(/^\d+(\.\d+)?$/).nullable().optional(),
  memory: z.number().int().nonnegative().max(2147483647).nullable().optional(),
});

async function request(config: RunnerConfig, path: string, signal: AbortSignal, body?: unknown) {
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
      size += value.byteLength; if (size > 128_000) throw new Error("Runner response exceeds limit");
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
function decode(value: string | null | undefined) {
  if (!value) return "";
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("Invalid runner encoding");
  return Buffer.from(value, "base64").toString("utf8");
}
export function judgeOutcome(raw: unknown, expected: unknown): RunnerOutcome | null {
  const result = responseSchema.parse(raw);
  const id = result.status.id;
  if (id <= 2) return null;
  const stdout = decode(result.stdout);
  const diagnostic = decode(result.compile_output) || decode(result.stderr);
  let status: Verdict = id === 5 ? "TIME_LIMIT" : id === 6 ? "COMPILE_ERROR" : id >= 13 ? "INTERNAL_ERROR" : "RUNTIME_ERROR";
  if (id === 3 || id === 4) {
    status = "WRONG_ANSWER";
    try { if (id === 3 && isDeepStrictEqual(JSON.parse(stdout), expected)) status = "ACCEPTED"; } catch { /* Non-JSON output is a wrong answer. */ }
  }
  const ms = result.time == null ? null : Math.ceil(Number(result.time) * 1000);
  if (ms !== null && (!Number.isFinite(ms) || ms > 2147483647)) throw new Error("Invalid runtime");
  // Compare the complete bounded stdout first. Truncation is only for display/storage.
  return { status, stdout: stdout.slice(0, 4000), diagnostic: diagnostic.slice(0, 4000), runtimeMs: ms, memoryKb: result.memory ?? null };
}
// Batch endpoints keep metered providers affordable: one request creates every case and one request polls them all.
const createdSchema = z.array(z.object({ token: z.uuid() })).min(1).max(10);
const batchSchema = z.object({ submissions: z.array(z.unknown()).min(1).max(10) });
export async function executeJudge0(config: RunnerConfig, source: string, cases: RunnerCase[], limits: { timeMs: number; memoryKb: number }): Promise<RunnerOutcome[]> {
  if (!cases.length || cases.length > 10) throw new Error("Unsupported test count");
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 20_000);
  try {
    const created = createdSchema.parse(await request(config, "/submissions/batch?base64_encoded=true", controller.signal, {
      submissions: cases.map((test) => ({
        language_id: config.languageId,
        source_code: Buffer.from(source).toString("base64"), stdin: Buffer.from(test.stdin).toString("base64"),
        // Expected values stay in this application, outside the untrusted program.
        cpu_time_limit: Math.min(limits.timeMs / 1000, 2), cpu_extra_time: 0.5,
        wall_time_limit: 5, memory_limit: Math.min(limits.memoryKb, 262144), stack_limit: 64000,
        max_file_size: 64, max_processes_and_or_threads: 32,
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

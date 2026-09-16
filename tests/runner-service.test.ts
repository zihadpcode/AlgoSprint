import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ reserve: vi.fn(), finish: vi.fn(), execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/submissions/store", () => ({ reserveSubmission: f.reserve, finishSubmission: f.finish }));
vi.mock("@/features/submissions/judge0", () => ({ executeJudge0: f.execute }));
import { runSubmission } from "@/features/submissions/service";
import type { PrismaClient } from "@/generated/prisma/client";
const db = {} as PrismaClient;
const config = { url: "https://runner.example/", key: "private", auth: "token" as const, languageId: 102 };
const input = { slug: "relay-window", language: "JAVASCRIPT" as const, mode: "SUBMIT" as const, code: "source" };
beforeEach(() => {
  vi.clearAllMocks(); f.finish.mockResolvedValue(undefined);
  f.reserve.mockResolvedValue({ id: "own-attempt", cases: [
    { position: 1, input: "visible", output: 1, stdin: "visible" },
    { position: 2, input: "HIDDEN-INPUT", output: "HIDDEN-EXPECTED", stdin: "HIDDEN-INPUT" },
  ], source: "source", limits: { timeMs: 2000, memoryKb: 262144 } });
  f.execute.mockResolvedValue([
    { status: "ACCEPTED", stdout: "1", diagnostic: "", runtimeMs: 10, memoryKb: 100 },
    { status: "RUNTIME_ERROR", stdout: "HIDDEN-PRINT", diagnostic: "HIDDEN-ERROR", runtimeMs: 20, memoryKb: 200 },
  ]);
});
it("suppresses all hidden payloads and diagnostics in both response and stored result", async () => {
  const result = await runSubmission(db, "owner", input, config);
  expect(result).toMatchObject({ success: true, result: { passedCount: 1, totalCount: 2, status: "RUNTIME_ERROR", cases: [], runtimeMs: 20, memoryKb: 200 } });
  for (const text of [JSON.stringify(result), JSON.stringify(f.finish.mock.calls)]) expect(text).not.toContain("HIDDEN");
});
it("returns visible inputs, outputs and errors only for visible runs", async () => {
  f.reserve.mockResolvedValue({ id: "own-attempt", source: "source", limits: {}, cases: [{ position: 1, input: [1], output: 1, stdin: "[1]" }] });
  f.execute.mockResolvedValue([{ status: "WRONG_ANSWER", stdout: "2", diagnostic: "debug", runtimeMs: null, memoryKb: null }]);
  expect(await runSubmission(db, "owner", { ...input, mode: "RUN" }, config)).toMatchObject({ success: true, result: { status: "WRONG_ANSWER", cases: [{ input: [1], expected: 1, stdout: "2", diagnostic: "debug" }], runtimeMs: null } });
});
it("persists infrastructure failures without revealing provider errors or inventing results", async () => {
  f.execute.mockRejectedValue(new Error("api-key HIDDEN-INPUT"));
  const result = await runSubmission(db, "owner", input, config);
  expect(result).toMatchObject({ success: true, result: { status: "INTERNAL_ERROR", passedCount: 0, runtimeMs: null, cases: [] } });
  expect(JSON.stringify(result)).not.toContain("api-key"); expect(f.finish).toHaveBeenCalledOnce();
});
it("never calls the provider when a reservation is denied and surfaces failed persistence", async () => {
  f.reserve.mockResolvedValue({ error: "Limit reached" });
  expect(await runSubmission(db, "owner", input, config)).toEqual({ success: false, message: "Limit reached" }); expect(f.execute).not.toHaveBeenCalled();
  f.reserve.mockResolvedValue({ id: "own-attempt", cases: [], limits: {}, source: "" }); f.finish.mockRejectedValue(new Error("DB failed"));
  await expect(runSubmission(db, "owner", input, config)).rejects.toThrow("DB failed");
});

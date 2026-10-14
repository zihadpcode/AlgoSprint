import { beforeEach, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
const f = vi.hoisted(() => ({ prune: vi.fn(), reserve: vi.fn(), execute: vi.fn(), progress: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/submissions/retention", () => ({ pruneSubmissionPayloads: f.prune }));
vi.mock("@/features/progress/write", () => ({ writeProgress: f.progress }));
vi.mock("@/features/submissions/sandbox", () => ({ executeSandbox: f.execute }));
vi.mock("@/features/submissions/store", async (original) => ({ ...await original<typeof import("@/features/submissions/store")>(), reserveSubmission: f.reserve }));
import { finishSubmission } from "@/features/submissions/store";
import { runSubmission } from "@/features/submissions/service";
const events: string[] = [];
const result = { id: "attempt", mode: "RUN" as const, status: "ACCEPTED" as const, passedCount: 1, totalCount: 1, runtimeMs: 1, memoryKb: 1, cases: [] };
const tx = { userSubmission: { findFirst: f.find, updateMany: f.update }, $queryRaw: async () => [{ revision: 1, status: "PUBLISHED" }] };
const db = { $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => {
  events.push("begin"); const value = await callback(tx); events.push("commit"); return value;
} } as unknown as PrismaClient;
beforeEach(() => {
  vi.resetAllMocks(); events.length = 0;
  f.find.mockResolvedValue({ problemId: "problem", problemRevision: 1, mode: "RUN", totalCount: 1, createdAt: new Date() });
  f.update.mockResolvedValue({ count: 1 }); f.progress.mockResolvedValue(undefined);
  f.prune.mockImplementation(async () => { events.push("cleanup"); return 0; });
  f.reserve.mockResolvedValue({ id: "attempt", revision: 1, source: "source", limits: { timeMs: 2000, memoryKb: 262144 }, cases: [{ position: 1, input: {}, output: 1, stdin: "[]" }] });
  f.execute.mockResolvedValue([{ status: "ACCEPTED", stdout: "1", diagnostic: "", runtimeMs: 1, memoryKb: 1 }]);
});
it("cleans only after owned completion commits, using the server completion time", async () => {
  await finishSubmission(db, "owner", result);
  expect(events).toEqual(["begin", "commit", "cleanup"]);
  expect(f.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "attempt", userId: "owner", status: "RUNNING" } }));
  expect(f.prune).toHaveBeenCalledWith(db, "owner", f.update.mock.calls[0][0].data.completedAt);
});
it("does not clean after a rejected or failed completion", async () => {
  f.find.mockResolvedValue(null);
  await expect(finishSubmission(db, "other-owner", result)).rejects.toThrow("does not match");
  expect(f.prune).not.toHaveBeenCalled();
  f.find.mockResolvedValue({ problemId: "problem", problemRevision: 1, mode: "RUN", totalCount: 1, createdAt: new Date() });
  f.update.mockRejectedValue(new Error("save failed"));
  await expect(finishSubmission(db, "owner", result)).rejects.toThrow("save failed");
  expect(f.prune).not.toHaveBeenCalled();
});
it("keeps a saved server result successful when separate cleanup fails or times out", async () => {
  for (const message of ["statement timeout", "cleanup unavailable"]) {
    f.prune.mockRejectedValue(new Error(message));
    const outcome = await runSubmission(db, "owner", { slug: "relay-window", language: "JAVASCRIPT", mode: "RUN", code: "source" }, { provider: "sandbox" });
    expect(outcome).toMatchObject({ success: true, result: { id: "attempt", status: "ACCEPTED", passedCount: 1 } });
    expect(f.update).toHaveBeenCalled();
    expect(JSON.stringify(outcome)).not.toContain(message);
  }
});
it("does not finish or clean after admission is rejected", async () => {
  f.reserve.mockResolvedValue({ error: "The runner is busy" });
  expect(await runSubmission(db, "owner", { slug: "relay-window", language: "JAVASCRIPT", mode: "RUN", code: "source" }, { provider: "sandbox" })).toEqual({ success: false, message: "The runner is busy" });
  expect(f.execute).not.toHaveBeenCalled(); expect(f.find).not.toHaveBeenCalled(); expect(f.prune).not.toHaveBeenCalled();
});

import "server-only";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { ExecutionInput, ExecutionResult } from "./contracts";
import { makeProgram, makeStdin } from "./harness";

// Caller authenticates first. A short database lock shares quotas across server instances.
export async function reserveSubmission(db: PrismaClient, userId: string, input: ExecutionInput) {
  return db.$transaction(async (tx) => {
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now FROM pg_advisory_xact_lock(728551, 8)`;
    const now = clock.now;
    await tx.userSubmission.updateMany({ where: { status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: new Date(now.getTime() - 120_000) } },
      data: { status: "INTERNAL_ERROR", completedAt: now } });
    const active = { status: { in: ["QUEUED", "RUNNING"] as ("QUEUED" | "RUNNING")[] } };
    const minute = new Date(now.getTime() - 60_000);
    if (await tx.userSubmission.count({ where: { userId, ...active } }) ||
        await tx.userSubmission.count({ where: { userId, createdAt: { gte: minute } } }) >= 5 ||
        await tx.userSubmission.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - 3600_000) } } }) >= 30 ||
        await tx.userSubmission.count({ where: active }) >= 20 ||
        await tx.userSubmission.count({ where: { createdAt: { gte: minute } } }) >= 60) {
      return { error: "The runner is busy or your execution limit was reached. Wait a minute and try again; the hourly limit is 30 requests." } as const;
    }
    // Hold a shared row lock only while snapshotting tests and recording the reservation.
    const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM app."Problem" WHERE slug = ${input.slug} AND status = 'PUBLISHED' AND kind = 'CODING' FOR SHARE`;
    if (!locked) return { error: "This problem is no longer available for execution." } as const;
    const problem = await tx.problem.findUniqueOrThrow({ where: { id: locked.id }, select: {
      id: true, revision: true, timeLimitMs: true, memoryLimitKb: true,
      starterCode: { where: { language: "JAVASCRIPT" }, select: { entryPoint: true } },
      testCases: { where: input.mode === "RUN" ? { visibility: "VISIBLE" } : {}, orderBy: { position: "asc" }, take: 11,
        select: { position: true, visibility: true, input: true, output: true } },
    } });
    if (!problem.starterCode[0] || !problem.testCases.length || problem.testCases.length > 10 ||
        (input.mode === "SUBMIT" && !problem.testCases.some((t) => t.visibility === "HIDDEN"))) {
      return { error: "This problem does not have a supported test suite yet." } as const;
    }
    const source = makeProgram(input.slug, problem.starterCode[0].entryPoint, input.code);
    const cases = problem.testCases.map((test) => ({ ...test, stdin: makeStdin(input.slug, test.input) }));
    const submission = await tx.userSubmission.create({ data: { userId, problemId: problem.id, problemRevision: problem.revision,
      language: input.language, mode: input.mode, code: input.code, status: "RUNNING", totalCount: cases.length }, select: { id: true } });
    return { id: submission.id, problemId: problem.id, revision: problem.revision, source, cases,
      limits: { timeMs: problem.timeLimitMs, memoryKb: problem.memoryLimitKb } } as const;
  }, { timeout: 10_000 });
}

export async function finishSubmission(db: PrismaClient, userId: string, result: ExecutionResult) {
  return db.$transaction(async (tx) => {
    const saved = await tx.userSubmission.updateMany({ where: { id: result.id, userId, status: "RUNNING" }, data: {
      status: result.status, passedCount: result.passedCount, totalCount: result.totalCount,
      runtimeMs: result.runtimeMs, memoryKb: result.memoryKb, completedAt: new Date(),
      result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    } });
    if (saved.count !== 1) throw new Error("Submission is no longer writable");
    // Progress analytics are Phase 9. Phase 8 only persists the actual runner verdict.
  });
}

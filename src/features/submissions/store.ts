import "server-only";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { ExecutionInput, ExecutionResult } from "./contracts";
import { writeProgress } from "@/features/progress/write";
import { makeProgram, makeStdin, runnerSupports } from "./harness";
import { RUNNER_LIMITS } from "./limits";
import { checkPythonBudget } from "./python-budget";
import { pruneSubmissionPayloads } from "./retention";

export const RUN_REFUSALS = {
  ownActive: "You already have a run in progress. Wait for it to finish, then try again.",
  perMinute: "You have reached the limit of 5 runs per minute. Wait a minute and try again.",
  perHour: "You have reached the limit of 30 runs per hour. Try again later.",
  busy: "The runner is busy right now. Wait a minute and try again.",
} as const;

const languageNames = { JAVASCRIPT: "JavaScript", PYTHON: "Python" } as const;

// Caller authenticates first. A short database lock shares quotas across server instances.
export async function reserveSubmission(db: PrismaClient, userId: string, input: ExecutionInput) {
  return db.$transaction(async (tx) => {
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now FROM pg_advisory_xact_lock(728551, 8)`;
    const now = clock.now;
    await tx.userSubmission.updateMany({ where: { status: { in: ["QUEUED", "RUNNING"] }, createdAt: { lt: new Date(now.getTime() - 120_000) } },
      data: { status: "INTERNAL_ERROR", completedAt: now } });
    const active = { status: { in: ["QUEUED", "RUNNING"] as ("QUEUED" | "RUNNING")[] } };
    const minute = new Date(now.getTime() - 60_000);
    // One message per cap so the learner is told which limit they hit. The queries and their order are unchanged.
    const refusal =
      await tx.userSubmission.count({ where: { userId, ...active } }) ? RUN_REFUSALS.ownActive :
      await tx.userSubmission.count({ where: { userId, createdAt: { gte: minute } } }) >= 5 ? RUN_REFUSALS.perMinute :
      await tx.userSubmission.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - 3600_000) } } }) >= 30 ? RUN_REFUSALS.perHour :
      await tx.userSubmission.count({ where: active }) >= 20 || await tx.userSubmission.count({ where: { createdAt: { gte: minute } } }) >= 60 ? RUN_REFUSALS.busy : null;
    if (refusal) return { error: refusal } as const;
    // Hold a shared row lock only while snapshotting tests and recording the reservation.
    const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM app."Problem" WHERE slug = ${input.slug} AND status = 'PUBLISHED' AND kind = 'CODING' FOR SHARE`;
    if (!locked) return { error: "This problem is no longer available for execution." } as const;
    const problem = await tx.problem.findUniqueOrThrow({ where: { id: locked.id }, select: {
      id: true, revision: true, timeLimitMs: true, memoryLimitKb: true,
      starterCode: { where: { language: input.language }, select: { entryPoint: true } },
      testCases: { where: input.mode === "RUN" ? { visibility: "VISIBLE" } : {}, orderBy: { position: "asc" }, take: RUNNER_LIMITS.maxCases + 1,
        select: { position: true, visibility: true, input: true, output: true } },
    } });
    // Runnable in a language only with a reviewed signature AND a starter row (its entry point) for that language.
    if (!runnerSupports(input.slug) || !problem.starterCode[0]) {
      return { error: `This problem is not available to run in ${languageNames[input.language]} yet.` } as const;
    }
    if (!problem.testCases.length || problem.testCases.length > RUNNER_LIMITS.maxCases ||
        (input.mode === "SUBMIT" && !problem.testCases.some((t) => t.visibility === "HIDDEN"))) {
      return { error: "This problem does not have a supported test suite yet." } as const;
    }
    // Python starts one VM per case, so it has its own VM budgets on top of the request limits above.
    if (input.language === "PYTHON") {
      const refusal = await checkPythonBudget(tx, userId, now, problem.testCases.length);
      if (refusal) return { error: refusal } as const;
    }
    const source = makeProgram(input.slug, problem.starterCode[0].entryPoint, input.code, input.language);
    const cases = problem.testCases.map((test) => ({ ...test, stdin: makeStdin(input.slug, test.input) }));
    const submission = await tx.userSubmission.create({ data: { userId, problemId: problem.id, problemRevision: problem.revision,
      language: input.language, mode: input.mode, code: input.code, status: "RUNNING", totalCount: cases.length }, select: { id: true, createdAt: true } });
    await writeProgress(tx, userId, problem.id, { kind: "attempt", at: submission.createdAt });
    return { id: submission.id, problemId: problem.id, revision: problem.revision, source, cases,
      limits: { timeMs: problem.timeLimitMs, memoryKb: problem.memoryLimitKb } } as const;
  }, { timeout: 10_000 });
}

export async function finishSubmission(db: PrismaClient, userId: string, result: ExecutionResult) {
  const savedAt = await db.$transaction(async (tx) => {
    const submission = await tx.userSubmission.findFirst({ where: { id: result.id, userId, status: "RUNNING" },
      select: { problemId: true, problemRevision: true, mode: true, totalCount: true, createdAt: true } });
    if (!submission || result.mode !== submission.mode || result.totalCount !== submission.totalCount) throw new Error("Submission does not match its reservation");
    const [problem] = await tx.$queryRaw<{ revision: number; status: string }[]>`SELECT revision, status FROM app."Problem" WHERE id = ${submission.problemId}::uuid FOR SHARE`;
    const completedAt = new Date();
    const saved = await tx.userSubmission.updateMany({ where: { id: result.id, userId, status: "RUNNING" }, data: {
      status: result.status, passedCount: result.passedCount, totalCount: result.totalCount,
      runtimeMs: result.runtimeMs, memoryKb: result.memoryKb, completedAt,
      result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
    } });
    if (saved.count !== 1) throw new Error("Submission is no longer writable");
    await writeProgress(tx, userId, submission.problemId, { kind: "attempt", at: submission.createdAt });
    if (submission.mode === "SUBMIT" && result.status === "ACCEPTED" && result.totalCount > 0 && result.passedCount === result.totalCount &&
        problem?.status === "PUBLISHED" && problem.revision === submission.problemRevision) {
      await writeProgress(tx, userId, submission.problemId, { kind: "verified-solve", revision: submission.problemRevision, at: completedAt });
    }
    return completedAt;
  });
  // Admission and completion have already committed. Retention never holds the
  // deployment-wide admission lock, and a failed cleanup cannot undo a verdict
  // or turn its successful save into an error that encourages a duplicate retry.
  try { await pruneSubmissionPayloads(db, userId, savedAt); }
  catch { /* Best effort: a later saved server attempt can retry a small batch. */ }
}

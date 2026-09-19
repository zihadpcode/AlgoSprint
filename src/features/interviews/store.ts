import "server-only";
import { createHash, randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { interviewCommand, snapshotSchema, type SessionView } from "./contracts";
import { INTERVIEW_QUESTIONS } from "./questions";
import { assessment, readAnswer, remainingMs } from "./policy";
export class InterviewError extends Error {}
export const answerToken = (value: string | null) => createHash("sha256").update(value ?? "").digest("hex");
const sessionInclude = { questions: { orderBy: { position: "asc" as const } } };
type Session = Prisma.MockInterviewGetPayload<{ include: typeof sessionInclude }>;
async function complete(tx: Prisma.TransactionClient, session: Session, abandoned = false) {
  const scores = session.questions.map((q) => ({ id: q.id, ...assessment(readAnswer(q.answer)) }));
  if (!abandoned) for (const q of scores) await tx.mockInterviewQuestion.update({ where: { id: q.id }, data: { score: q.score, feedback: q.feedback } });
  await tx.mockInterview.update({ where: { id: session.id }, data: { status: abandoned ? "ABANDONED" : "COMPLETED", completedAt: new Date(), score: abandoned ? null : Math.round(scores.reduce((s, q) => s + q.score, 0) / Math.max(1, scores.length)), report: { version: 1, method: "Self-assessed reasoning, tradeoffs and checks. Not an automated correctness score.", expired: remainingMs(session.startedAt!, session.durationMinutes) === 0 } } });
}
export async function writeInterview(db: PrismaClient, userId: string, raw: unknown) {
  const command = interviewCommand.parse(raw);
  return db.$transaction(async (tx) => {
    if (command.operation === "start") {
      const user = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM app."User" WHERE id=${userId}::uuid FOR UPDATE`;
      if (!user.length) throw new InterviewError("Sign in to start an interview.");
      const active = await tx.mockInterview.findFirst({ where: { userId, status: "IN_PROGRESS" }, include: sessionInclude });
      if (active && remainingMs(active.startedAt!, active.durationMinutes) > 0) return { success: true, message: "Resuming your active session.", id: active.id };
      if (active) { await tx.$queryRaw`SELECT id FROM app."MockInterview" WHERE id=${active.id}::uuid FOR UPDATE`; const fresh = await tx.mockInterview.findUniqueOrThrow({ where: { id: active.id }, include: sessionInclude }); if (fresh.status === "IN_PROGRESS") await complete(tx, fresh); }
      const recent = await tx.mockInterview.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 86400000) } } });
      if (recent >= 20) throw new InterviewError("You have reached 20 sessions in 24 hours. Review a saved report and return later.");
      const { difficulty, kind, topic, count, duration } = command.setup;
      const candidates: { id: string; library: boolean }[] = INTERVIEW_QUESTIONS.filter((q) => (kind === "ANY" || q.kind === kind) && (difficulty === "ANY" || q.difficulty === difficulty) && (!topic || q.topic === topic)).map((q) => ({ id: q.id, library: false }));
      if (kind === "ANY" || kind === "CODING") {
        const rows = await tx.problem.findMany({ where: { status: "PUBLISHED", kind: "CODING", ...(difficulty === "ANY" ? {} : { difficulty }), ...(topic ? { categories: { some: { category: { slug: topic } } } } : {}) }, select: { id: true }, take: 1001, orderBy: { id: "asc" } });
        if (rows.length > 1000) throw new InterviewError("This collection exceeds the current interview selection limit.");
        candidates.push(...rows.map((p) => ({ id: p.id, library: true })));
      }
      if (candidates.length < count) throw new InterviewError(`Only ${candidates.length} matching questions are available. Reduce the count or broaden your filters.`);
      for (let i = candidates.length - 1; i > 0; i--) { const j = randomInt(i + 1); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
      const selected = candidates.slice(0, count); const ids = selected.filter((c) => c.library).map((c) => c.id).sort();
      if (ids.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM app."Problem" WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`);
      const problems = await tx.problem.findMany({ where: { id: { in: ids }, status: "PUBLISHED" }, select: { id: true, slug: true, title: true, statement: true, constraints: true, revision: true, examples: { orderBy: { position: "asc" }, select: { input: true, output: true, explanation: true } }, solutions: { where: { kind: "OPTIMAL" }, take: 1, orderBy: { id: "asc" }, select: { approach: true, intuition: true, code: true, timeComplexity: true, spaceComplexity: true } } } });
      if (problems.length !== ids.length) throw new InterviewError("The collection changed during selection. Try again.");
      const questions = selected.map((c, index) => {
        const q = INTERVIEW_QUESTIONS.find((q) => q.id === c.id); const p = problems.find((p) => p.id === c.id);
        const snapshot = q?.snapshot ?? snapshotSchema.parse({ version: 1, title: p!.title, statement: p!.statement, details: `${p!.constraints.join("\n")}\n\n${p!.examples.map((e) => `Input: ${JSON.stringify(e.input)}\nOutput: ${JSON.stringify(e.output)}\n${e.explanation}`).join("\n\n")}`, reference: p!.solutions.map((s) => `${s.intuition}\n${s.approach}\nTime: ${s.timeComplexity}; space: ${s.spaceComplexity}\n${s.code}`).join("\n") || "No reference discussion was available when this session started.", revision: p!.revision, slug: p!.slug });
        return { position: index + 1, kind: q?.kind ?? "CODING" as const, problemId: p?.id ?? null, prompt: JSON.stringify(snapshot) };
      });
      const session = await tx.mockInterview.create({ data: { userId, durationMinutes: duration, startedAt: new Date(), status: "IN_PROGRESS", questions: { create: questions } } });
      return { success: true, message: "Interview started.", id: session.id };
    }
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM app."MockInterview" WHERE id=${command.id}::uuid AND "userId"=${userId}::uuid FOR UPDATE`;
    if (!locked.length) throw new InterviewError("Interview unavailable.");
    const session = await tx.mockInterview.findUniqueOrThrow({ where: { id: command.id }, include: sessionInclude });
    if (session.status !== "IN_PROGRESS") return { success: true, message: "This session has ended.", id: session.id, ended: true };
    if (remainingMs(session.startedAt!, session.durationMinutes) === 0) { await complete(tx, session); return { success: true, message: "Time expired. The report uses answers saved before the deadline.", id: session.id, ended: true }; }
    if (command.operation === "save") {
      const question = session.questions.find((q) => q.id === command.questionId);
      if (!question) throw new InterviewError("Question unavailable.");
      if (answerToken(question.answer) !== command.token) throw new InterviewError("This answer changed in another tab. Copy your draft, then reload before saving again.");
      const answer = JSON.stringify(command.answer);
      await tx.mockInterviewQuestion.update({ where: { id: question.id }, data: { answer } });
      return { success: true, message: "Answer saved.", token: answerToken(answer) };
    }
    await complete(tx, session, command.operation === "abandon");
    return { success: true, message: command.operation === "abandon" ? "Session abandoned." : "Report ready.", id: session.id, ended: true };
  }, { timeout: 20000 });
}
export async function queryInterview(db: PrismaClient, userId: string, id: string): Promise<SessionView | null> {
  const session = await db.mockInterview.findFirst({ where: { id, userId }, include: sessionInclude });
  if (!session || !session.startedAt || !session.questions.length) return null;
  const ended = session.status === "COMPLETED" || session.status === "ABANDONED";
  return { id: session.id, status: session.status, duration: session.durationMinutes, remainingMs: remainingMs(session.startedAt, session.durationMinutes), score: session.score, questions: session.questions.map((q) => {
    const { reference, ...prompt } = snapshotSchema.parse(JSON.parse(q.prompt));
    return { id: q.id, position: q.position, kind: q.kind, prompt, ...(ended ? { reference } : {}), answer: readAnswer(q.answer), token: answerToken(q.answer), score: q.score, feedback: q.feedback };
  }) };
}
export async function queryInterviews(db: PrismaClient, userId: string) {
  return db.mockInterview.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, select: { id: true, status: true, durationMinutes: true, createdAt: true, score: true } });
}

import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { ProblemSeed } from "@/lib/validators/problem";
import { validateProblemSemantics } from "../../../scripts/lib/reference-problems";
import { makeProgram, runnerSupports } from "@/features/submissions/harness";
import { AdminError, lockAdmin } from "./access";
import { adminCommand, parseAdminProblems, parseAdminRoadmap, type AdminResult } from "./contracts";
import { adminRoadmapSelect, roadmapToken } from "./query";

const json = (value: unknown) => value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
function contentData(p: ProblemSeed) {
  return { title: p.title, difficulty: p.difficulty, kind: p.kind, status: p.status, pattern: p.pattern,
    statement: p.statement, constraints: p.constraints, estimatedMinutes: p.estimatedMinutes, timeLimitMs: p.timeLimitMs, memoryLimitKb: p.memoryLimitKb,
    seedHash: null, publishedAt: p.status === "PUBLISHED" ? new Date() : null };
}
function relations(p: ProblemSeed) {
  return {
    examples: p.examples.map((e) => ({ ...e, input: json(e.input), output: json(e.output) })), hints: p.hints,
    starterCode: p.starterCode, testCases: p.testCases.map((t) => ({ ...t, input: json(t.input), output: json(t.output) })),
    solutions: p.solutions.map((s) => ({ ...s, steps: { create: s.steps } })),
    categories: p.categories.map((slug) => ({ category: { connect: { slug } } })), tags: p.tags.map((slug) => ({ tag: { connect: { slug } } })),
    interviewStyles: p.interviewStyles.map((slug) => ({ style: { connect: { slug } } })),
  };
}
function checkProblem(p: ProblemSeed, reviewed: boolean) {
  if (p.slug === "new") throw new AdminError("Choose a slug other than the reserved word new.");
  if (p.status === "PUBLISHED" && !reviewed) throw new AdminError("Confirm that you reviewed originality, explanations and expected outputs before publishing.");
  if (runnerSupports(p.slug)) {
    const js = p.starterCode.find((s) => s.language === "JAVASCRIPT");
    if (!js || p.testCases.length > 10) throw new AdminError("Existing runner problems require JavaScript and at most ten test cases.");
    try { makeProgram(p.slug, js.entryPoint, ""); validateProblemSemantics(p); }
    catch { throw new AdminError("An existing runner problem has an invalid signature, input or expected output. Keep its reviewed contract intact."); }
  }
}

// Input is validated again here; caller must supply an identity from provider verification.
export async function writeAdmin(db: PrismaClient, userId: string, raw: unknown): Promise<AdminResult> {
  const command = adminCommand.parse(raw);
  return db.$transaction(async (tx) => {
    await lockAdmin(tx, userId);
    // One order across content operations; the roadmap lock also coordinates with seeds.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(713013::bigint)`;
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(712012::bigint)`;
    if (command.operation === "roadmap") {
      const p = parseAdminRoadmap(command.payload);
      if (p.slug !== command.slug) throw new AdminError("Roadmap slugs cannot change.");
      await tx.$queryRaw`SELECT id FROM app."Roadmap" WHERE slug = ${p.slug} FOR UPDATE`;
      const current = await tx.roadmap.findUnique({ where: { slug: p.slug }, select: adminRoadmapSelect });
      if (!current || roadmapToken(current) !== command.token) throw new AdminError("This roadmap changed. Copy your draft and reload before saving.");
      if (p.status === "PUBLISHED" && !command.reviewed) throw new AdminError("Confirm the roadmap sequence was reviewed before publishing.");
      const problems = await tx.problem.findMany({ where: { slug: { in: p.steps.map((s) => s.problemSlug) } }, select: { slug: true, id: true, status: true } });
      if (problems.length !== p.steps.length || (p.status === "PUBLISHED" && problems.some((x) => x.status !== "PUBLISHED"))) throw new AdminError("Every step must exist; published roadmaps require published problems.");
      const ids = new Map(problems.map((x) => [x.slug, x.id]));
      await tx.roadmap.update({ where: { slug: p.slug }, data: { title: p.title, description: p.description, difficulty: p.difficulty, estimatedMinutes: p.estimatedMinutes, status: p.status,
        steps: { deleteMany: {}, create: p.steps.map((s, i) => ({ problemId: ids.get(s.problemSlug)!, position: i + 1, title: s.title, description: s.description })) } } });
      const saved = await tx.roadmap.findUniqueOrThrow({ where: { slug: p.slug }, select: adminRoadmapSelect });
      return { success: true, message: "Roadmap saved.", slug: p.slug, token: roadmapToken(saved) };
    }
    if (command.operation === "archive" || command.operation === "delete") {
      if (command.confirmation !== command.slug) throw new AdminError("Type the exact problem slug to confirm.");
      const [row] = await tx.$queryRaw<{ id: string; revision: number; status: string }[]>`SELECT id, revision, status FROM app."Problem" WHERE slug = ${command.slug} FOR UPDATE`;
      if (!row || row.revision !== command.revision) throw new AdminError("This problem changed. Reload before trying again.");
      if (command.operation === "delete") {
        const counts = await tx.problem.findUniqueOrThrow({ where: { id: row.id }, select: { _count: { select: { progress: true, notes: true, submissions: true, roadmapSteps: true, interviewQuestions: true, related: true, relatedTo: true } } } });
        if (row.status !== "ARCHIVED" || Object.values(counts._count).some((count) => count > 0)) throw new AdminError("Only archived problems with no user history, roadmap, interview or related-problem references can be deleted. Keep this problem archived.");
        await tx.problem.delete({ where: { id: row.id } });
        return { success: true, message: "Problem deleted.", deleted: true };
      }
      const revision = row.status === "ARCHIVED" ? row.revision : row.revision + 1;
      if (row.status !== "ARCHIVED") await tx.problem.update({ where: { id: row.id }, data: { status: "ARCHIVED", revision, seedHash: null } });
      return { success: true, message: "Problem archived. User history is preserved.", slug: command.slug, revision };
    }
    const problems = parseAdminProblems(command.payload, command.operation === "import");
    for (const problem of problems) checkProblem(problem, command.reviewed);
    const editing = command.operation === "save" && command.slug !== null;
    if (command.operation === "save" && ((command.slug === null) !== (command.revision === null))) throw new AdminError("Invalid create/edit version.");
    if (editing && problems[0].slug !== command.slug) throw new AdminError("Problem slugs cannot change after creation.");
    let existing: { id: string; revision: number } | undefined;
    if (editing) {
      [existing] = await tx.$queryRaw<{ id: string; revision: number }[]>`SELECT id, revision FROM app."Problem" WHERE slug = ${command.slug} FOR UPDATE`;
      if (!existing || existing.revision !== command.revision) throw new AdminError("This problem changed in another tab. Copy your draft and reload before saving.");
    } else if (await tx.problem.count({ where: { slug: { in: problems.map((p) => p.slug) } } })) throw new AdminError("A problem slug already exists. Imports create new problems only; no existing content was changed.");
    const relatedSlugs = [...new Set(problems.flatMap((p) => p.relatedSlugs))];
    const related = await tx.problem.findMany({ where: { slug: { in: relatedSlugs } }, select: { slug: true, id: true } });
    const available = new Set([...related.map((p) => p.slug), ...problems.map((p) => p.slug)]);
    if (relatedSlugs.some((slug) => !available.has(slug))) throw new AdminError("A related problem slug does not exist in the collection or this import.");
    const ids = new Map(related.map((p) => [p.slug, p.id]));
    for (const p of problems) {
      const r = relations(p);
      const created = existing ? await tx.problem.update({ where: { id: existing.id }, data: { ...contentData(p), revision: existing.revision + 1,
        examples: { deleteMany: {}, create: r.examples }, hints: { deleteMany: {}, create: r.hints }, starterCode: { deleteMany: {}, create: r.starterCode },
        testCases: { deleteMany: {}, create: r.testCases }, solutions: { deleteMany: {}, create: r.solutions }, categories: { deleteMany: {}, create: r.categories },
        tags: { deleteMany: {}, create: r.tags }, interviewStyles: { deleteMany: {}, create: r.interviewStyles },
      }, select: { id: true } }) : await tx.problem.create({ data: { ...contentData(p), slug: p.slug,
        examples: { create: r.examples }, hints: { create: r.hints }, starterCode: { create: r.starterCode }, testCases: { create: r.testCases }, solutions: { create: r.solutions },
        categories: { create: r.categories }, tags: { create: r.tags }, interviewStyles: { create: r.interviewStyles },
      }, select: { id: true } });
      ids.set(p.slug, created.id);
    }
    for (const p of problems) {
      const problemId = ids.get(p.slug)!;
      await tx.problemRelation.deleteMany({ where: { problemId } });
      if (p.relatedSlugs.length) await tx.problemRelation.createMany({ data: p.relatedSlugs.map((slug) => ({ problemId, relatedId: ids.get(slug)! })) });
    }
    return command.operation === "import" ? { success: true, message: `Imported ${problems.length} problems. No existing content was overwritten.` } :
      { success: true, message: "Problem saved. Previous solves retain their recorded revision.", slug: problems[0].slug, revision: existing ? existing.revision + 1 : 1 };
  }, { timeout: 30_000 });
}

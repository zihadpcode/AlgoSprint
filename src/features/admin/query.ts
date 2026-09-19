import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { lockAdmin } from "./access";

export const adminProblemSelect = {
  slug: true, title: true, difficulty: true, kind: true, status: true, pattern: true,
  statement: true, constraints: true, estimatedMinutes: true, timeLimitMs: true, memoryLimitKb: true, revision: true,
  categories: { select: { category: { select: { slug: true } } } }, tags: { select: { tag: { select: { slug: true } } } },
  interviewStyles: { select: { style: { select: { slug: true } } } }, related: { select: { related: { select: { slug: true } } } },
  examples: { orderBy: { position: "asc" }, select: { position: true, input: true, output: true, explanation: true } },
  hints: { orderBy: { position: "asc" }, select: { position: true, content: true } },
  starterCode: { orderBy: { language: "asc" }, select: { language: true, entryPoint: true, code: true } },
  testCases: { orderBy: { position: "asc" }, select: { position: true, visibility: true, input: true, output: true, explanation: true } },
  solutions: { orderBy: [{ kind: "asc" }, { language: "asc" }], select: { kind: true, language: true, title: true, intuition: true, approach: true, pseudocode: true, code: true, timeComplexity: true, spaceComplexity: true, commonMistakes: true, interviewExplanation: true,
    steps: { orderBy: { position: "asc" }, select: { position: true, title: true, content: true } } } },
} satisfies Prisma.ProblemSelect;

export const adminRoadmapSelect = { slug: true, title: true, description: true, difficulty: true, estimatedMinutes: true, status: true, updatedAt: true,
  steps: { orderBy: { position: "asc" }, select: { position: true, title: true, description: true, problem: { select: { slug: true } } } },
} satisfies Prisma.RoadmapSelect;
export function roadmapToken(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export async function queryAdminProblem(db: PrismaClient, userId: string, slug: string) {
  return db.$transaction(async (tx) => {
    await lockAdmin(tx, userId);
    const row = await tx.problem.findUnique({ where: { slug }, select: adminProblemSelect });
    if (!row) return null;
    const { revision, categories, tags, interviewStyles, related, ...content } = row;
    return { revision, content: { ...content, schemaVersion: 1 as const, categories: categories.map((x) => x.category.slug).sort(), tags: tags.map((x) => x.tag.slug).sort(),
      interviewStyles: interviewStyles.map((x) => x.style.slug).sort(), relatedSlugs: related.map((x) => x.related.slug).sort(), testCases: content.testCases.map((x) => ({ ...x, explanation: x.explanation ?? "" })) } };
  }, { isolationLevel: "RepeatableRead" });
}
export async function queryAdminRoadmap(db: PrismaClient, userId: string, slug: string) {
  return db.$transaction(async (tx) => {
    await lockAdmin(tx, userId);
    const row = await tx.roadmap.findUnique({ where: { slug }, select: adminRoadmapSelect });
    if (!row) return null;
    const { steps, status } = row;
    const content = { slug: row.slug, title: row.title, description: row.description, difficulty: row.difficulty, estimatedMinutes: row.estimatedMinutes };
    return { token: roadmapToken(row), status, content: { ...content, steps: steps.map((s) => ({ problemSlug: s.problem.slug, title: s.title, description: s.description ?? "" })) } };
  }, { isolationLevel: "RepeatableRead" });
}

export type AdminFilters = { q: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | ""; page: number };
export async function queryAdminIndex(db: PrismaClient, userId: string, filters: AdminFilters) {
  return db.$transaction(async (tx) => {
    await lockAdmin(tx, userId);
    const where = { ...(filters.status ? { status: filters.status } : {}), ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" as const } } : {}) };
    const total = await tx.problem.count({ where }); const pages = Math.max(1, Math.ceil(total / 20)); const page = Math.min(Math.max(filters.page, 1), pages);
    const problems = await tx.problem.findMany({ where, orderBy: [{ title: "asc" }, { slug: "asc" }], skip: (page - 1) * 20, take: 20,
      select: { slug: true, title: true, status: true, difficulty: true, revision: true } });
    const roadmaps = await tx.roadmap.findMany({ orderBy: [{ title: "asc" }, { slug: "asc" }], take: 100, select: { slug: true, title: true, status: true } });
    return { problems, roadmaps, total, pages, page };
  }, { isolationLevel: "RepeatableRead" });
}

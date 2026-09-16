import "server-only";
import { progressView } from "@/features/progress/presentation";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// An allowlist, never include:true: hidden tests and operational fields stay server-side.
const detailSelect = {
  id: true, revision: true, slug: true, title: true, difficulty: true, kind: true, pattern: true,
  statement: true, constraints: true, estimatedMinutes: true,
  categories: { select: { category: { select: { slug: true, name: true } } }, orderBy: { category: { name: "asc" } } },
  tags: { select: { tag: { select: { slug: true, name: true } } }, orderBy: { tag: { name: "asc" } } },
  examples: { select: { position: true, input: true, output: true, explanation: true }, orderBy: { position: "asc" } },
  hints: { select: { position: true, content: true }, orderBy: { position: "asc" } },
  solutions: {
    select: {
      kind: true, language: true, title: true, intuition: true, approach: true, pseudocode: true,
      code: true, timeComplexity: true, spaceComplexity: true, commonMistakes: true, interviewExplanation: true,
      steps: { select: { position: true, title: true, content: true }, orderBy: { position: "asc" } },
    },
    orderBy: [{ kind: "asc" }, { language: "asc" }],
  },
  starterCode: { select: { language: true, entryPoint: true, code: true }, orderBy: { language: "asc" } },
  related: {
    where: { related: { status: "PUBLISHED" } }, take: 6,
    select: { related: { select: { slug: true, title: true, difficulty: true } } },
    orderBy: { related: { slug: "asc" } },
  },
} satisfies Prisma.ProblemSelect;

// viewerId is supplied only by loadProblem after provider verification.
export async function queryProblem(db: PrismaClient, slug: string, viewerId: string | null) {
  return db.$transaction(async (tx) => {
    const row = await tx.problem.findFirst({ where: { slug, status: "PUBLISHED" }, select: detailSelect });
    if (!row) return null;
    const { id, revision, categories, tags, related, ...content } = row;
    const relatedProblems = related.length ? related.map((item) => item.related) : await tx.problem.findMany({
      where: { status: "PUBLISHED", slug: { not: slug }, categories: { some: { category: { slug: { in: categories.map((item) => item.category.slug) } } } } },
      select: { slug: true, title: true, difficulty: true }, orderBy: { slug: "asc" }, take: 3,
    });
    const personal = viewerId ? {
      progress: progressView(await tx.userProgress.findUnique({
        where: { userId_problemId: { userId: viewerId, problemId: id } },
        select: { status: true, reviewLater: true, selfMarked: true, verifiedRevision: true },
      }), revision),
      note: (await tx.userNote.findUnique({
        where: { userId_problemId: { userId: viewerId, problemId: id } }, select: { content: true },
      }))?.content ?? "",
    } : null;
    return {
      ...content, categories: categories.map((item) => item.category), tags: tags.map((item) => item.tag),
      related: relatedProblems, personal,
    };
  }, { isolationLevel: "RepeatableRead" });
}
export type ProblemDetail = NonNullable<Awaited<ReturnType<typeof queryProblem>>>;

import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import { CATEGORIES, TAGS, INTERVIEW_STYLES } from "../src/data/seeds/taxonomy";
import { problemBatchSchema, type ProblemSeed } from "../src/lib/validators/problem";
import { validateProblemSemantics } from "../scripts/lib/reference-problems";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function problemHash(problem: ProblemSeed) {
  return createHash("sha256").update(canonicalJson(problem)).digest("hex");
}

function jsonValue(value: unknown) {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

export async function seedProblems(db: PrismaClient, input: unknown) {
  // Validate the whole batch before any write, including callers outside the CLI.
  const problems = problemBatchSchema.parse(input);
  for (const p of problems) validateProblemSemantics(p);
  const existing = await db.problem.findMany({ select: { slug: true, seedHash: true } });
  const known = new Map(existing.map((p) => [p.slug, p.seedHash]));
  const available = new Set([...known.keys(), ...problems.map((p) => p.slug)]);
  for (const p of problems) {
    if (known.has(p.slug) && known.get(p.slug) !== problemHash(p)) {
      throw new Error(`Seed conflict for ${p.slug}: existing content differs. No seed content was changed.`);
    }
    if (p.relatedSlugs.some((slug) => !available.has(slug))) throw new Error(`Unknown related slug in ${p.slug}.`);
  }

  await db.$transaction(async (tx) => {
    for (const [slug, name] of CATEGORIES) await tx.category.upsert({ where: { slug }, create: { slug, name }, update: {} });
    for (const [slug, name] of TAGS) await tx.tag.upsert({ where: { slug }, create: { slug, name }, update: {} });
    for (const [slug, name] of INTERVIEW_STYLES) await tx.interviewStyle.upsert({ where: { slug }, create: { slug, name }, update: {} });
  }, { timeout: 30_000 });

  let created = 0;
  let skipped = 0;
  // Bounded transactions keep larger seed directories restartable.
  for (let offset = 0; offset < problems.length; offset += 20) {
    await db.$transaction(async (tx) => {
      for (const p of problems.slice(offset, offset + 20)) {
        const seedHash = problemHash(p);
        const current = await tx.problem.findUnique({ where: { slug: p.slug }, select: { seedHash: true } });
        if (current) {
          if (current.seedHash !== seedHash) throw new Error(`Concurrent seed conflict for ${p.slug}.`);
          skipped++;
          continue;
        }
        await tx.problem.create({ data: {
          slug: p.slug, title: p.title, difficulty: p.difficulty, kind: p.kind,
          status: p.status, pattern: p.pattern, statement: p.statement, constraints: p.constraints,
          estimatedMinutes: p.estimatedMinutes, timeLimitMs: p.timeLimitMs, memoryLimitKb: p.memoryLimitKb,
          seedHash, publishedAt: p.status === "PUBLISHED" ? new Date() : null,
          examples: { create: p.examples.map((e) => ({ ...e, input: jsonValue(e.input), output: jsonValue(e.output) })) },
          hints: { create: p.hints }, starterCode: { create: p.starterCode },
          testCases: { create: p.testCases.map((t) => ({ ...t, input: jsonValue(t.input), output: jsonValue(t.output) })) },
          solutions: { create: p.solutions.map((s) => ({ ...s, steps: { create: s.steps } })) },
          categories: { create: p.categories.map((slug) => ({ category: { connect: { slug } } })) },
          tags: { create: p.tags.map((slug) => ({ tag: { connect: { slug } } })) },
          interviewStyles: { create: p.interviewStyles.map((slug) => ({ style: { connect: { slug } } })) },
        } });
        created++;
      }
    }, { timeout: 60_000 });
  }
  // Resolve relations only after all new problems exist. Reruns repair a partial run.
  const ids = new Map((await db.problem.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));
  const relations = problems.flatMap((p) => p.relatedSlugs.map((related) => ({ problemId: ids.get(p.slug)!, relatedId: ids.get(related)! })));
  if (relations.length) await db.problemRelation.createMany({ data: relations, skipDuplicates: true });
  return { created, skipped };
}

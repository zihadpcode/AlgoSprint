import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrismaClient } from "../src/generated/prisma/client";
import { PYTHON_STARTERS_PATH, pythonStarterFileSchema, type PythonStarter } from "../scripts/lib/python-starters";

// Insert-only add-on layer: adds StarterCode rows in another language to problems that already exist. It never updates
// or deletes a row, never touches the Problem row (so its seedHash stays valid) and writes nothing if any existing row
// for the same problem and language differs.
//
// Wiring (deliberately not done in prisma/seed.ts yet): after `await seedProblems(db, problems)` add
//   console.log("Language starters:", await seedLanguageStarters(db, await loadPythonStarters()));
export async function loadPythonStarters(): Promise<PythonStarter[]> {
  return pythonStarterFileSchema.parse(JSON.parse(await readFile(join(process.cwd(), PYTHON_STARTERS_PATH), "utf8")));
}

type Existing = { language: string; entryPoint: string; code: string };
const same = (row: Existing, entry: PythonStarter) => row.language === entry.language && row.entryPoint === entry.entryPoint && row.code === entry.code;

export async function seedLanguageStarters(db: PrismaClient, input: unknown) {
  const entries = pythonStarterFileSchema.parse(input);
  return db.$transaction(async (tx) => {
    const problems = await tx.problem.findMany({ where: { slug: { in: entries.map((e) => e.slug) } },
      select: { id: true, slug: true, starterCode: { select: { language: true, entryPoint: true, code: true } } } });
    const bySlug = new Map(problems.map((p) => [p.slug, p]));
    const toCreate: { problemId: string; language: "PYTHON"; entryPoint: string; code: string }[] = [];
    let present = 0, missingProblems = 0;
    // Check everything before the first write so a conflict leaves the database untouched.
    for (const entry of entries) {
      const problem = bySlug.get(entry.slug);
      if (!problem) { missingProblems++; continue; }
      const row = problem.starterCode.find((s) => s.language === entry.language);
      if (!row) { toCreate.push({ problemId: problem.id, language: entry.language, entryPoint: entry.entryPoint, code: entry.code }); continue; }
      if (!same(row, entry)) throw new Error(`Starter conflict for ${entry.slug} (${entry.language}): existing row differs. No starter code was changed.`);
      present++;
    }
    if (toCreate.length) {
      await tx.starterCode.createMany({ data: toCreate, skipDuplicates: true });
      // A concurrent writer could have inserted a different row between the check and the insert; roll back if so.
      const stored = await tx.starterCode.findMany({ where: { problemId: { in: toCreate.map((r) => r.problemId) }, language: "PYTHON" },
        select: { problemId: true, language: true, entryPoint: true, code: true } });
      const expected = new Map(toCreate.map((r) => [r.problemId, r]));
      for (const row of stored) {
        const wanted = expected.get(row.problemId);
        if (wanted && (row.entryPoint !== wanted.entryPoint || row.code !== wanted.code)) throw new Error("Concurrent starter conflict. No starter code was changed.");
      }
    }
    return { created: toCreate.length, skipped: present, missingProblems };
  }, { timeout: 30_000 });
}

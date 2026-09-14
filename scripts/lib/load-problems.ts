import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { problemBatchSchema } from "../../src/lib/validators/problem";
import { validateProblemSemantics } from "./reference-problems";

export async function loadProblems(directory = join(process.cwd(), "src/data/seeds/problems")) {
  async function visit(folder: string): Promise<string[]> {
    const entries = await readdir(folder, { withFileTypes: true });
    const groups = await Promise.all(entries.map((entry) => {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) return visit(path);
      return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
    }));
    return groups.flat();
  }
  const files = (await visit(directory)).sort();
  if (files.length > 1000) throw new Error("A seed run supports at most 1,000 problem files.");
  const data: unknown[] = [];
  for (const file of files) {
    if ((await stat(file)).size > 1_000_000) throw new Error(`Seed file exceeds 1 MB: ${file}`);
    data.push(JSON.parse(await readFile(file, "utf8")));
  }
  const problems = problemBatchSchema.parse(data);
  for (const problem of problems) validateProblemSemantics(problem);
  return problems;
}

import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { generateProblems, generationSchema, type GenerationOptions } from "./generate";
import { GENERATOR_VERSION } from "./registry";

export function generatedFiles(options: GenerationOptions) {
  const parsed = generationSchema.parse(options);
  const problems = generateProblems(parsed);
  const files = new Map(problems.map((problem) => [`${problem.slug}.json`, JSON.stringify(problem, null, 2) + "\n"]));
  files.set("manifest.txt", `AlgoSprint generator v${GENERATOR_VERSION}\nOptions: ${JSON.stringify(parsed)}\nStatus: DRAFT; human review required. Seed variants reuse five authored templates.\nFiles:\n${[...files.keys()].join("\n")}\n`);
  return files;
}

export async function writeGeneratedFiles(directory: string, options: GenerationOptions, check = false) {
  const files = generatedFiles(options); // Validate the entire batch before touching disk.
  const destination = resolve(directory);
  if (check) {
    const actual = (await readdir(destination)).sort();
    if (JSON.stringify(actual) !== JSON.stringify([...files.keys()].sort())) throw new Error("Generated file set differs; inspect added or missing files.");
    for (const [name, content] of files) {
      if (await readFile(join(destination, name), "utf8") !== content) throw new Error(`Generated content differs: ${name}`);
    }
    return files.size - 1;
  }
  // Exclusive sibling lock serializes this CLI. Never replace an existing destination,
  // even when it is empty. Write into staging so invalid/failed batches leave no partial set.
  await mkdir(dirname(destination), { recursive: true });
  const lock = `${destination}.generator-lock`;
  await mkdir(lock);
  const stage = join(dirname(destination), `.generator-${randomUUID()}`);
  try {
    try { await readdir(destination); throw new Error("Output directory already exists; use --check or choose a new directory."); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await mkdir(stage);
    for (const [name, content] of files) await writeFile(join(stage, name), content, { flag: "wx" });
    await rename(stage, destination);
  } finally {
    await rm(stage, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
  return files.size - 1;
}

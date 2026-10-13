import { z } from "zod";
import { SIGNATURES } from "../../src/features/submissions/signatures";
import { isPythonIdentifier, pythonEntryPoint, toSnakeCase } from "../../src/features/submissions/python-names";

// Add-on starter layer: Python starter stubs for problems that already exist. It never touches seeded problem JSON,
// so the content hashes used by insert-only problem seeding stay valid. Generated from SIGNATURES, the single source of
// truth for entry points and argument order.

export const pythonStarterSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  language: z.literal("PYTHON"),
  entryPoint: z.string().max(100).refine(isPythonIdentifier, "Entry point must be a valid Python identifier and not a keyword"),
  code: z.string().min(1).max(20_000).refine((code) => !code.includes("\0")),
});
export const pythonStarterFileSchema = z.array(pythonStarterSchema).min(1).max(1000).superRefine((entries, ctx) => {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.slug)) ctx.addIssue({ code: "custom", path: [index, "slug"], message: `Duplicate starter for ${entry.slug}` });
    seen.add(entry.slug);
  });
});
export type PythonStarter = z.infer<typeof pythonStarterSchema>;

export function pythonStub(entryPoint: string, keys: string[]) {
  return `def ${entryPoint}(${keys.map(toSnakeCase).join(", ")}):\n    # Write your solution here.\n    pass`;
}

export function buildPythonStarters(signatures: Record<string, { entryPoint: string; keys: string[] }> = SIGNATURES): PythonStarter[] {
  return Object.entries(signatures).map(([slug, { entryPoint, keys }]) => {
    const name = pythonEntryPoint(entryPoint);
    return { slug, language: "PYTHON" as const, entryPoint: name, code: pythonStub(name, keys) };
  });
}

// Stricter than the schema: parameters must be valid, unique identifiers and the file must match the signature table.
export function validatePythonStarters(input: unknown, problemSlugs: ReadonlySet<string>, signatures: Record<string, { entryPoint: string; keys: string[] }> = SIGNATURES): PythonStarter[] {
  const entries = pythonStarterFileSchema.parse(input);
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  for (const slug of Object.keys(signatures)) if (!bySlug.has(slug)) throw new Error(`Missing Python starter for runnable problem ${slug}.`);
  for (const entry of entries) {
    if (!problemSlugs.has(entry.slug)) throw new Error(`Python starter ${entry.slug} has no matching problem.`);
    const signature = Object.hasOwn(signatures, entry.slug) ? signatures[entry.slug] : undefined;
    if (!signature) throw new Error(`Python starter ${entry.slug} has no runner signature.`);
    const parameters = signature.keys.map(toSnakeCase);
    for (const parameter of parameters) if (!isPythonIdentifier(parameter)) throw new Error(`${entry.slug}: "${parameter}" is not a usable Python parameter name.`);
    if (new Set(parameters).size !== parameters.length) throw new Error(`${entry.slug}: parameter names collide after snake_case conversion.`);
    if (entry.entryPoint !== pythonEntryPoint(signature.entryPoint)) throw new Error(`${entry.slug}: entry point must be ${pythonEntryPoint(signature.entryPoint)}.`);
    if (entry.code !== pythonStub(entry.entryPoint, signature.keys)) throw new Error(`${entry.slug}: stub differs from the generated stub; run npm run starters:python.`);
  }
  return entries;
}

export const PYTHON_STARTERS_PATH = "src/data/seeds/languages/python-starters.json";
export function renderPythonStarters(entries: PythonStarter[]) { return JSON.stringify(entries, null, 2) + "\n"; }

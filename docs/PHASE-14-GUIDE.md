# Phase 14 — Original problem generator system

Phase 14 adds a developer-run generator for five original algorithm exercises, complete draft seed objects and independently checked answers. [PR #15](https://github.com/zihadpcode/AlgoSprint/pull/15) records the exact implementation, CI results and merge state. Phase 13 was merged in [PR #14](https://github.com/zihadpcode/AlgoSprint/pull/14). Phase 15 mock interviews are not included.

## 🟦 What we are building and why

A generator is a controlled authoring pipeline: an original problem template defines the rules, a seeded stream chooses small inputs, two independently written algorithms agree on the answers, and the existing Zod schema checks the complete problem object. Finally, the CLI saves draft JSON seed files for review.

This is a template system, not an AI service. It needs no API key or database connection. Different numeric seeds create exercise sets with different test data; they do not represent newly invented problem concepts. There are five authored concepts in this phase, using standard algorithms with original wording and explanations.

| Template ID | Pattern | Result | Optimized approach |
| --- | --- | --- | --- |
| `supply-pairs` | Two pointers | Count pack index pairs within a weight budget | Count all partners for a fitting left endpoint; otherwise discard the right endpoint |
| `signal-burst` | Sliding window | Maximum count of clear readings in an exact-width block | Remove one departing contribution and add one arriving contribution |
| `reservoir-spans` | Prefix sum | Net signed change for each half-open ledger span | Subtract prefix totals in request order |
| `tide-marker` | Binary search | First height strictly above water level | Find the first true entry of a monotone predicate |
| `workshop-credits` | Dynamic programming | Maximum credits without adjacent workshop days | Compare skipping today with taking today plus the optimum two days back |

The taxonomy now supports `two-pointers` and `upper-bound` in addition to the five earlier pattern slugs. Categories and tags use existing entries; no database migration is needed. Existing admin controls derive pattern options from this shared taxonomy.

## 🟩 Run the generator

From the repository root, use Node.js 24 and the lockfile dependencies:

```bash
npm ci
npm run problems:generate -- --help
npm run problems:check
npm run seed:validate
```

`problems:check` regenerates the committed seed-1401 objects in memory and checks every byte and filename against `src/data/seeds/generated/`. It writes nothing. `seed:validate` checks those five drafts separately from the five existing published foundation problems and two roadmaps.

Generate a new set into a directory that does not already exist:

```bash
npm run problems:generate -- --seed 2027 --out src/data/seeds/generated-2027
```

Generate three exercise sets for only the binary-search template:

```bash
npm run problems:generate -- --template tide-marker --seed 2027 --count 3 --out src/data/seeds/tide-practice
npm run problems:generate -- --template tide-marker --seed 2027 --count 3 --out src/data/seeds/tide-practice --check
```

| Option | Meaning and bound |
| --- | --- |
| `--seed` | Unsigned decimal integer from 0 through 4294967295; default 1401 |
| `--count` | 1–10 consecutive seeds per selected template; default 1 |
| `--template` | `all` or one exact ID from the table; default `all` |
| `--out` | New destination directory; default `src/data/seeds/generated` |
| `--check` | Read-only comparison with the selected options; detects changed, missing and extra entries |
| `--help` | Print supported options and explain the default fixtures |

`--count 3 --seed 2027` uses seeds 2027, 2028 and 2029. With `all`, that produces fifteen JSON files. A request whose last seed exceeds uint32 fails. Unknown flags, positional arguments, unsupported templates, decimals, negative numbers and invalid counts fail before output is written.

The default output already exists in the repository. Running plain `npm run problems:generate` therefore refuses to replace it. Use `problems:check` for the committed fixtures or choose a new directory. This avoids accidentally destroying editorial changes.

## 🟨 How the pieces connect

1. `scripts/generate-problems.ts` reads strict CLI flags and validates the options.
2. `scripts/generator/registry.ts` chooses only checked-in, authored templates and fixes the generator version.
3. `random.ts` provides an isolated uint32 stream. The same seed and template version reproduce the same data without a clock, network or global random state.
4. Each template defines a strict input schema, hand-selected edge cases, bounded random inputs, two solvers, original statements, constraints, hints and solution explanations.
5. `generate.ts` checks each stored answer with both solvers, runs another 64 differential cases, then validates complete objects with the existing problem and batch schemas.
6. `files.ts` creates the JSON and a plain-text manifest. It validates the full batch before disk writes, serializes cooperating generator processes using an exclusive sibling directory, writes a staging directory, then renames it into place.
7. `reference-problems.ts` recognizes exact versioned generated slugs and uses the corresponding authored optimized solver when validating seed examples and tests. Unsupported versions and template IDs fail closed.
8. CI runs reproducibility checking, seed validation, unit tests, real PostgreSQL tests and the existing production gates.

All generated exercise inputs have at most fourteen elements or requests. The DP oracle enumerates at most 2^14 subsets. These intentional educational bounds keep brute-force validation predictable. Raising a limit, particularly a bit-mask or exponential solver's limit, requires revisiting its algorithm, numeric assumptions and tests.

Each seed object contains a versioned slug, a title identifying the exercise set, `DRAFT` status, an original statement, constraints, two examples, exactly five progressive hints, a JavaScript starter, visible and hidden cases, and brute-force/optimal solutions with code, explanations, complexity and steps. There are nine or ten stored cases per template: its five or six fixed edge cases plus four seeded cases. The first two cases are visible examples. The other cases stay hidden in the application; repository maintainers can of course read seed files.

## 🟨 Two concrete walkthroughs

For Supply Packs with weights `[1, 2, 3, 4]` and budget `5`, the valid index pairs have weights `(1,2)`, `(1,3)`, `(1,4)` and `(2,3)`: four pairs. The optimized solver begins with the endpoints 1 and 4. They fit, so every partner between them also fits with 1: add three pairs. Advance left to 2; 2+4 is too large, so move right to 3. Now 2+3 fits: add one and stop. Sorted order is the reason counting multiple pairs at once is sound.

For Workshop Credits `[5, 9, 5]`, selecting the largest individual workshop earns nine. Selecting days zero and two earns ten, so greedy selection fails. The dynamic program keeps the optimum for the previous prefix and the prefix before that. At each day, `max(oneBack, twoBack + credit)` covers the two possibilities: skip today or attend today. The exhaustive solver independently enumerates subsets and rejects those with adjacent bits. Agreement across explicit examples and bounded random cases gives useful evidence without claiming a formal proof for arbitrary future constraints.

## 🟦 Original-content and version rules

Write original domain rules, wording, hints and explanations. Standard algorithms are shared knowledge; do not scrape or paraphrase named platforms' content. Each template needs its own specification and worked cases. A different numeric seed changes fixtures, not the underlying puzzle. Keep that distinction clear when describing library size or portfolio work.

A generated slug looks like `gen-v1-supply-pairs-1401`. The version, template and numeric seed are explicit. Preserve old validators when introducing a future version so already saved data retains its meaning. Changing a v1 rule or solver can invalidate old fixtures; publish a new version for behavioral changes instead of silently reinterpreting old slugs.

Solution listings are authored static JavaScript strings alongside the typed solvers. This avoids serializing compiler-dependent `Function.toString()` output. Unit tests execute only those trusted checked-in literals, with bounded inputs and a timeout, and compare their answers to the typed functions. The generator and seed importer never execute solution strings from generated or imported JSON. A VM in a test is not an application sandbox and is not used for user submissions.

## 🟩 Review and use generated content

Generated files are intentionally outside `src/data/seeds/problems/`, so the ordinary database seed command continues to load the five original published foundation problems. Generation and verification do not connect to a database.

For the Phase 13 admin importer, supply an array of at most ten problem objects. You can obtain the five committed objects as a JSON array with this read-only command and paste its output into `/admin/import`:

```bash
node --input-type=module <<'JS'
import { readdir, readFile } from 'node:fs/promises';
const folder = 'src/data/seeds/generated';
const names = (await readdir(folder)).filter(name => name.endsWith('.json')).sort();
const problems = await Promise.all(names.map(async name => JSON.parse(await readFile(`${folder}/${name}`, 'utf8'))));
console.log(JSON.stringify(problems, null, 2));
JS
```

The array satisfies the existing administrator import boundary. Choose at most ten objects per batch and stay below its 400 KB limit. Import is create-only: an existing slug is rejected rather than updated. Review the statement, boundary meanings, examples, hints, code and originality, then publish explicitly through the editor when appropriate.

For a repository-managed seed workflow, review a selected JSON file, place it under a new subdirectory of `src/data/seeds/problems/`, run `npm run seed:validate`, and only then use the existing database seed command against your intended development database. The generated semantic validator checks the approved versioned slug and its inputs/answers. It does not establish that arbitrary later edits to prose or code are correct. Keep the slug's input contract intact and review changed content yourself.

The existing seed hash policy still applies: an identical rerun preserves IDs and user history; differing content causes a conflict instead of overwriting author edits. Database seed batches retain their earlier restartable transaction boundaries; do not assume a thousand-file database seed operation is one transaction. Admin imports have their own atomic batch behavior.

New generated problems have no runner contracts in this phase. They can be studied after publication, but cannot be submitted for automatic execution or verification. Adding a runner requires an explicit reviewed signature, bounded harness, provider coverage and integration tests. Generator validation does not confer runner support.

## 🟨 Tests and verification

```bash
npm run problems:check
npm run seed:validate
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
```

Run `npm run test:integration` only with `TEST_DATABASE_URL` targeting a dedicated empty PostgreSQL test database ending in `_test`, after applying migrations there. CI supplies PostgreSQL 17. New database tests insert the five drafts, check nested content and unpublished state, rerun without changing IDs or user progress, reject corrupted answers, and preserve editorial changes on a seed conflict.

Local results: **158 tests pass**, including thirteen new generator tests. Lint, typecheck, production build, signed-out HTTP smoke, exact fixture checking and seed validation pass. **All 64 PostgreSQL integration tests also pass (222 tests total).** [Implementation CI 35422991194](https://github.com/zihadpcode/AlgoSprint/actions/runs/35422991194) passed every step on `6ce30d9a8dbe76ef4c6548235e52e43e4bb3cb2a`: exact fixture/seed validation, migrations, tests, lint, types, build, seeding and both HTTP suites. PR #15 records final documentation-head CI and merge evidence.

The generator tests cover deterministic streams and seed bounds, independent known answers, optimized/brute agreement, trusted static listings, invalid inputs and options, administrator import compatibility, exact snapshots, corrupted expected values, no-overwrite behavior, concurrent writers and failed-batch cleanup. An initial test detected compiler-dependent listing formatting; static authored listings resolved it, with a dedicated equivalence test to prevent drift.

## 🟥 Common mistakes and practical limits

- Treating each seed as a new algorithm problem. These are five templates with reproducible exercise variants.
- Removing the fourteen-element limit while keeping the exponential or bitwise oracle unchanged.
- Accepting agreement between two algorithms as proof that a statement is correct. Review semantics and known answers as well.
- Running the generator into a reviewed directory. The CLI refuses existing output directories; use a new directory and review the diff.
- Editing fixtures without changing their generating template, then expecting `--check` to pass. Drift is intentionally reported.
- Expecting the JSON manifest to be a problem. `manifest.txt` records options; only individual `.json` objects are seed files.
- Confusing original seed files, generated draft files and published database content. File generation does not publish or execute anything.
- Treating the writer lock as a system-wide filesystem security boundary. It coordinates this CLI's cooperating processes. Use a repository-owned destination, avoid other writers there, and inspect a stale `.generator-lock` after a crashed process before manually removing it. Cleanup handles ordinary errors, not abrupt process termination or machine failure.
- Deleting curated data to resolve seed conflicts. Preserve author edits and learner history; resolve differences deliberately.

No schema or dependency change, production write, deployment or live authenticated account/provider check was performed in this phase. Earlier live Supabase/Judge0/browser checks remain pending. This phase is a CLI/seed workflow; it adds no generator webpage or asynchronous job service.

## 🟪 Extending the system

Add another original template with a strict bounded input schema, independent baseline and optimized solver, known edge cases, coherent explanations and trusted JavaScript listings. Register it, add semantic and lifecycle coverage, and use a new generator version when meanings change. Later work could add controlled parameterized statements, stronger property checks, reviewed language variants and an administrator preview workflow. A thousand high-quality problems requires original concepts and review, not multiplying seeds.

Phase 15 will build mock interviews separately. Phase 14 should be verified and merged first; stop after this phase as requested.

## 🟩 Complete changed source and fixture files

The following listings contain every changed implementation, configuration, test and generated fixture file in this phase. Documentation files are described above rather than recursively embedding this guide into itself.

### `.github/workflows/ci.yml`

```yaml
name: Validate AlgoSprint

on:
  pull_request:
  push:
    branches: [main, "algosprint/**"]

permissions:
  contents: read

concurrency:
  group: validate-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: algosprint_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres -d algosprint_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/algosprint_test
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/algosprint_test
      NEXT_TELEMETRY_DISABLED: "1"
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run db:generate
      - run: npm run db:validate
      - run: npm run db:deploy
      - run: npm run problems:check
      - run: npm run seed:validate
      - run: npm test
      - run: npm run test:integration
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm run test:smoke
      - run: npm run db:seed
      - run: node scripts/smoke-library.mjs
```

### `package.json`

```json
{
  "name": "algosprint",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "next typegen && tsc --noEmit",
    "db:generate": "prisma generate",
    "db:validate": "prisma validate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:local": "prisma dev --name algosprint",
    "seed:validate": "node --import tsx scripts/validate-seeds.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "prebuild": "prisma generate",
    "pretypecheck": "prisma generate",
    "predev": "prisma generate",
    "test:integration": "vitest run --config vitest.integration.config.mts",
    "user:role": "node --import tsx scripts/set-user-role.ts",
    "test:smoke": "node scripts/smoke-auth.mjs",
    "problems:generate": "node --import tsx scripts/generate-problems.ts",
    "problems:check": "npm run problems:generate -- --check"
  },
  "engines": {
    "node": ">=24 <25"
  },
  "dependencies": {
    "@next/env": "16.3.5",
    "@prisma/adapter-pg": "7.10.0",
    "@prisma/client": "7.10.0",
    "@supabase/ssr": "0.12.7",
    "@supabase/supabase-js": "2.116.0",
    "clsx": "2.1.1",
    "lucide-react": "1.45.0",
    "monaco-editor": "0.56.0",
    "next": "16.3.5",
    "pg": "8.23.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "server-only": "0.0.1",
    "tailwind-merge": "3.6.0",
    "zod": "4.6.4"
  },
  "devDependencies": {
    "@electric-sql/pglite": "0.4.3",
    "@tailwindcss/postcss": "^4",
    "@types/node": "24.13.4",
    "@types/pg": "8.23.1",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.5",
    "happy-dom": "20.14.5",
    "prisma": "7.10.0",
    "tailwindcss": "^4",
    "tsx": "4.23.13",
    "typescript": "^5",
    "vitest": "5.0.0"
  }
}
```

### `scripts/generate-problems.ts`

```ts
import { parseArgs } from "node:util";
import { generationSchema } from "./generator/generate";
import { writeGeneratedFiles } from "./generator/files";

async function main() {
  const { values } = parseArgs({ options: {
    seed: { type: "string", default: "1401" }, count: { type: "string", default: "1" },
    template: { type: "string", default: "all" }, out: { type: "string", default: "src/data/seeds/generated" },
    check: { type: "boolean", default: false }, help: { type: "boolean", default: false },
  }, strict: true, allowPositionals: false });
  if (values.help) {
    console.log("npm run problems:generate -- [--seed UINT32] [--count 1..10] [--template all|supply-pairs|signal-burst|reservoir-spans|tide-marker|workshop-credits] [--out NEW_DIRECTORY] [--check]");
    console.log("Default fixtures are checked in. Use --check to verify them or --out with a new directory. Generation never writes to a database.");
    return;
  }
  if (!/^\d+$/.test(values.seed!) || !/^\d+$/.test(values.count!)) throw new Error("Seed and count must be unsigned decimal integers.");
  const options = generationSchema.parse({ seed: Number(values.seed), count: Number(values.count), template: values.template });
  const count = await writeGeneratedFiles(values.out!, options, values.check);
  console.log(`${values.check ? "Verified" : "Generated"} ${count} draft seed files in ${values.out}. Human review is required before publication.`);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Generation failed.");
  process.exitCode = 1;
});
```

### `scripts/generator/files.ts`

```ts
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
```

### `scripts/generator/generate.ts`

```ts
import { z } from "zod";
import { problemBatchSchema, problemSchema, type ProblemSeed } from "../../src/lib/validators/problem";
import { createRandom, seedSchema } from "./random";
import { findTemplate, GENERATOR_VERSION, TEMPLATES } from "./registry";

export const generationSchema = z.strictObject({
  seed: seedSchema,
  count: z.int().min(1).max(10).default(1),
  template: z.string().refine((id) => id === "all" || TEMPLATES.some((t) => t.id === id), "Unknown template").default("all"),
}).refine((o) => o.seed + o.count - 1 <= 0xffffffff, "Seed range exceeds uint32");
export type GenerationOptions = z.input<typeof generationSchema>;

export function checkedOutput(template: ReturnType<typeof findTemplate>, input: unknown) {
  const optimal = template.evaluate(structuredClone(input), "optimal");
  const brute = template.evaluate(structuredClone(input), "brute");
  if (JSON.stringify(optimal) !== JSON.stringify(brute)) throw new Error(`${template.id}: reference/brute-force disagreement.`);
  return optimal;
}

export function generateProblem(templateId: string, seed: number): ProblemSeed {
  seedSchema.parse(seed);
  const template = findTemplate(templateId);
  const random = createRandom(seed);
  // Fixed examples remain pedagogical; four additional cases vary reproducibly by seed.
  const inputs: unknown[] = [...template.edges, ...Array.from({ length: 4 }, () => template.random(random))];
  const testCases = inputs.map((input, index) => ({
    position: index + 1, visibility: index < 2 ? "VISIBLE" as const : "HIDDEN" as const,
    input: z.json().parse(input), output: checkedOutput(template, input),
    explanation: `For ${JSON.stringify(input)}, the result is ${JSON.stringify(checkedOutput(template, input))}. ${index < 2 ? template.optimalApproach : "Checked by independent enumeration and the optimized reference."}`,
  }));
  // More differential checks than stored fixtures; these checks never evaluate code strings.
  for (let n = 0; n < 64; n++) checkedOutput(template, template.random(random));
  const entryPoint = template.optimal.name;
  const solution = (kind: "BRUTE_FORCE" | "OPTIMAL"): ProblemSeed["solutions"][number] => {
    const brute = kind === "BRUTE_FORCE";
    const approach = brute ? template.bruteApproach : template.optimalApproach;
    // Authored static listings are stable across tsx/Vitest compiler formatting.
    const code = (brute ? template.bruteCode : template.optimalCode).replace(/^function\s+[^(]+/, `function ${entryPoint}`);
    return {
      kind, language: "JAVASCRIPT", title: brute ? "Enumerate the candidates" : "Reuse the structure",
      intuition: brute ? "Enumerating all allowed choices gives a small-input correctness oracle." : template.invariant,
      approach, pseudocode: approach, code,
      timeComplexity: brute ? template.bruteTime : template.optimalTime,
      spaceComplexity: brute ? (template.id === "reservoir-spans" ? "O(q) output, O(1) auxiliary" : "O(1)") : template.optimalSpace,
      commonMistakes: template.mistakes,
      interviewExplanation: `${approach} ${brute ? "Use this bounded baseline to check the optimized strategy." : template.invariant}`,
      steps: [
        { position: 1, title: "Define the candidates", content: template.statement },
        { position: 2, title: "Compute the result", content: approach },
        { position: 3, title: "Check the argument", content: brute ? "Each permitted candidate is inspected, so taking the requested count, total or optimum is complete." : template.invariant },
      ],
    };
  };
  return problemSchema.parse({
    schemaVersion: 1, slug: `gen-v${GENERATOR_VERSION}-${template.id}-${seed}`, title: `${template.title} — Set ${seed}`,
    difficulty: "EASY", kind: "CODING", status: "DRAFT", pattern: template.pattern,
    statement: template.statement, constraints: template.constraints, estimatedMinutes: 20,
    timeLimitMs: 2000, memoryLimitKb: 262144, categories: template.categories, tags: template.tags,
    interviewStyles: ["general-software"], relatedSlugs: [],
    examples: testCases.slice(0, 2).map(({ position, input, output, explanation }) => ({ position, input, output, explanation })),
    hints: template.hints.map((content, n) => ({ position: n + 1, content })),
    starterCode: [{ language: "JAVASCRIPT", entryPoint, code: `function ${entryPoint}(input) {\n  // input is the object described in the statement.\n  throw new Error("Not implemented");\n}` }],
    testCases, solutions: [solution("BRUTE_FORCE"), solution("OPTIMAL")],
  });
}

export function generateProblems(input: GenerationOptions): ProblemSeed[] {
  const options = generationSchema.parse(input);
  const templates = options.template === "all" ? TEMPLATES : [findTemplate(options.template)];
  return problemBatchSchema.parse(templates.flatMap((t) => Array.from({ length: options.count }, (_, n) => generateProblem(t.id, options.seed + n))));
}
```

### `scripts/generator/random.ts`

```ts
import { z } from "zod";

export const seedSchema = z.int().min(0).max(0xffffffff);
export type Random = ReturnType<typeof createRandom>;

// A local uint32 stream: no global Math.random state, clock, or network inputs.
export function createRandom(seed: number) {
  let state = seedSchema.parse(seed);
  return {
    int(min: number, max: number) {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max || max - min > 1_000_000) {
        throw new Error("Invalid random integer bounds.");
      }
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return min + Math.floor((state / 0x100000000) * (max - min + 1));
    },
  };
}
```

### `scripts/generator/registry.ts`

```ts
import { twoPointers } from "./templates/two-pointers";
import { slidingWindow } from "./templates/sliding-window";
import { prefixSum } from "./templates/prefix-sum";
import { binarySearch } from "./templates/binary-search";
import { dynamicProgramming } from "./templates/dynamic-programming";

export const TEMPLATES = [twoPointers, slidingWindow, prefixSum, binarySearch, dynamicProgramming] as const;
export const GENERATOR_VERSION = 1;
export function findTemplate(id: string) {
  const template = TEMPLATES.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown template: ${id}`);
  return template;
}

// Only authored, versioned template IDs are trusted. Never derive executable code from JSON.
export function templateForSlug(slug: string) {
  const match = /^gen-v1-([a-z-]+)-(0|[1-9][0-9]{0,9})$/.exec(slug);
  if (!match || Number(match[2]) > 0xffffffff) return undefined;
  return TEMPLATES.find((item) => item.id === match[1]);
}
```

### `scripts/generator/template.ts`

```ts
import type { z } from "zod";
import type { ProblemSeed } from "../../src/lib/validators/problem";
import type { Random } from "./random";

export type Template<I> = {
  id: string;
  title: string;
  pattern: ProblemSeed["pattern"];
  categories: string[];
  tags: string[];
  statement: string;
  constraints: string[];
  input: z.ZodType<I>;
  edges: I[];
  random: (random: Random) => I;
  brute: (input: I) => number | number[];
  optimal: (input: I) => number | number[];
  bruteCode: string;
  optimalCode: string;
  hints: [string, string, string, string, string];
  bruteApproach: string;
  optimalApproach: string;
  invariant: string;
  bruteTime: string;
  optimalTime: string;
  optimalSpace: string;
  mistakes: string[];
};

// Erase heterogeneous input types only after binding their Zod parser.
export function defineTemplate<I>(template: Template<I>) {
  return {
    ...template,
    evaluate(input: unknown, strategy: "brute" | "optimal") {
      return template[strategy](template.input.parse(input));
    },
  };
}
```

### `scripts/generator/templates/binary-search.ts`

```ts
import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ marks: z.array(z.int().min(-20).max(20)).max(14), level: z.int().min(-20).max(20) })
  .refine((i) => i.marks.every((m, n) => n === 0 || m >= i.marks[n - 1]), "Marks must be sorted");
type Input = z.infer<typeof input>;
export function tideMarkerBrute({ marks, level }: Input) {
  for (let j = 0; j < marks.length; j++) if (marks[j] > level) return j;
  return -1;
}
export function tideMarker({ marks, level }: Input) {
  let left = 0, right = marks.length;
  while (left < right) {
    const middle = left + Math.floor((right - left) / 2);
    if (marks[middle] > level) right = middle;
    else left = middle + 1;
  }
  return left === marks.length ? -1 : left;
}
export const binarySearch = defineTemplate({
  id: "tide-marker", title: "First Dry Tide Marker", pattern: "upper-bound",
  categories: ["arrays", "binary-search"], tags: ["monotone-search"], input,
  statement: "A harbor's marker heights are listed in nondecreasing order as marks. A marker is dry only when its height is strictly greater than the current water level. Return the zero-based index of the first dry marker. If every marker is submerged or the list is empty, return -1. A marker exactly at the water level is not dry. The input is one object { marks, level }.",
  constraints: ["0 <= marks.length <= 14; marks are sorted in nondecreasing order.", "Marker heights and level are integers from -20 through 20."],
  edges: [{ marks: [1, 3, 3, 7], level: 3 }, { marks: [2, 2], level: 2 }, { marks: [], level: 0 }, { marks: [-4], level: -5 }, { marks: [-20, 0, 20], level: 20 }, { marks: [0, 0, 0, 1], level: 0 }],
  random(r) { return { marks: Array.from({ length: r.int(0, 14) }, () => r.int(-20, 20)).sort((a, b) => a - b), level: r.int(-20, 20) }; },
  brute: tideMarkerBrute, optimal: tideMarker,
  bruteCode: "function tideMarkerBrute({ marks, level }) {\n    for (let j = 0; j < marks.length; j++)\n        if (marks[j] > level)\n            return j;\n    return -1;\n}",
  optimalCode: "function tideMarker({ marks, level }) {\n    let left = 0, right = marks.length;\n    while (left < right) {\n        const middle = left + Math.floor((right - left) / 2);\n        if (marks[middle] > level)\n            right = middle;\n        else\n            left = middle + 1;\n    }\n    return left === marks.length ? -1 : left;\n}",
  hints: ["Dry markers form a suffix in the sorted list.", "Equality belongs to the submerged side.", "Search the half-open interval [left, right).", "A dry midpoint may be the first dry marker, so retain it as the right boundary.", "A submerged midpoint moves left to middle+1; translate an endpoint equal to length into -1."],
  bruteApproach: "Scan from the beginning and return the first index whose height is strictly greater than level.",
  optimalApproach: "Binary search the first true value of marks[i] > level with right initially equal to length.",
  invariant: "Every index before left is submerged, and every index at or after right is dry. The unknown interval shrinks each iteration.",
  bruteTime: "O(n)", optimalTime: "O(log(n + 1))", optimalSpace: "O(1)",
  mistakes: ["Using >= and accepting markers at water level.", "Returning any dry marker instead of the first.", "Returning length instead of -1 when no marker is dry."],
});
```

### `scripts/generator/templates/dynamic-programming.ts`

```ts
import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ credits: z.array(z.int().min(0).max(40)).max(14) });
type Input = z.infer<typeof input>;
export function workshopCreditsBrute({ credits }: Input) {
  let best = 0;
  for (let mask = 0; mask < 2 ** credits.length; mask++) {
    if ((mask & (mask << 1)) !== 0) continue;
    let total = 0;
    for (let j = 0; j < credits.length; j++) if ((mask & (1 << j)) !== 0) total += credits[j];
    best = Math.max(best, total);
  }
  return best;
}
export function workshopCredits({ credits }: Input) {
  let twoBack = 0, oneBack = 0;
  for (const credit of credits) {
    const current = Math.max(oneBack, twoBack + credit);
    twoBack = oneBack;
    oneBack = current;
  }
  return oneBack;
}
export const dynamicProgramming = defineTemplate({
  id: "workshop-credits", title: "Rest-Day Workshop Credits", pattern: "one-dimensional-dp",
  categories: ["arrays", "dynamic-programming"], tags: ["state-transition"], input,
  statement: "A community studio offers one workshop per day with the listed credits. Attending a workshop requires resting the following day, so no two selected day indices may be adjacent. Return the largest total credits you can earn. You may skip every workshop; an empty schedule earns zero. The input is one object { credits }.",
  constraints: ["0 <= credits.length <= 14.", "Each credit value is an integer from 0 through 40."],
  edges: [{ credits: [5, 9, 5] }, { credits: [0, 0] }, { credits: [] }, { credits: [7] }, { credits: [4, 4, 4, 4] }, { credits: [1, 10, 1, 10, 1] }],
  random(r) { return { credits: Array.from({ length: r.int(0, 14) }, () => r.int(0, 40)) }; },
  brute: workshopCreditsBrute, optimal: workshopCredits,
  bruteCode: "function workshopCreditsBrute({ credits }) {\n    let best = 0;\n    for (let mask = 0; mask < 2 ** credits.length; mask++) {\n        if ((mask & (mask << 1)) !== 0)\n            continue;\n        let total = 0;\n        for (let j = 0; j < credits.length; j++)\n            if ((mask & (1 << j)) !== 0)\n                total += credits[j];\n        best = Math.max(best, total);\n    }\n    return best;\n}",
  optimalCode: "function workshopCredits({ credits }) {\n    let twoBack = 0, oneBack = 0;\n    for (const credit of credits) {\n        const current = Math.max(oneBack, twoBack + credit);\n        twoBack = oneBack;\n        oneBack = current;\n    }\n    return oneBack;\n}",
  hints: ["Taking the largest single workshop first may block a better pair.", "At each day, compare attending with skipping.", "Attending uses the best total ending before the preceding day.", "Skipping retains the best total for all previous days.", "Use current = max(oneBack, twoBack + credit), then shift the two stored totals."],
  bruteApproach: "Enumerate every subset with a bit mask, reject adjacent selected bits, and maximize the selected credit sum. The fourteen-day bound keeps exhaustive validation small.",
  optimalApproach: "For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima.",
  invariant: "Before each day, oneBack is the optimum for all preceding days and twoBack excludes the immediately preceding day. The two choices cover every valid schedule.",
  bruteTime: "O(n × 2^n)", optimalTime: "O(n)", optimalSpace: "O(1)",
  mistakes: ["Greedily choosing the largest credit value.", "Updating twoBack before computing the current value.", "Forcing a workshop on an empty schedule."],
});
```

### `scripts/generator/templates/prefix-sum.ts`

```ts
import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ changes: z.array(z.int().min(-20).max(20)).max(14), spans: z.array(z.tuple([z.int().min(0).max(14), z.int().min(0).max(14)])).max(14) })
  .refine((i) => i.spans.every(([a, b]) => a <= b && b <= i.changes.length), "Invalid half-open span");
type Input = z.infer<typeof input>;
export function reservoirSpansBrute({ changes, spans }: Input) {
  const result = [];
  for (const [start, end] of spans) {
    let sum = 0;
    for (let j = start; j < end; j++) sum += changes[j];
    result.push(sum);
  }
  return result;
}
export function reservoirSpans({ changes, spans }: Input) {
  const prefix = [0];
  for (const value of changes) prefix.push(prefix[prefix.length - 1] + value);
  return spans.map(([start, end]) => prefix[end] - prefix[start]);
}
export const prefixSum = defineTemplate({
  id: "reservoir-spans", title: "Reservoir Ledger Spans", pattern: "prefix-sum",
  categories: ["arrays"], tags: ["prefix-sum"], input,
  statement: "A reservoir ledger records signed changes: inflow is positive and outflow is negative. For each requested span [start, end), return the net change from start inclusive to end exclusive. Keep answers in request order. An empty span has net change zero; no spans produces an empty answer array. The input is one object { changes, spans }.",
  constraints: ["0 <= changes.length <= 14; each change is an integer from -20 through 20.", "There are at most 14 spans; each has integer endpoints 0 <= start <= end <= changes.length."],
  edges: [{ changes: [5, -3, 2], spans: [[0, 3], [1, 2]] }, { changes: [4, -4], spans: [[0, 2], [1, 1]] }, { changes: [], spans: [[0, 0]] }, { changes: [-2], spans: [] }, { changes: [-20, -20], spans: [[0, 1], [0, 2], [0, 1]] }],
  random(r) { const changes = Array.from({ length: r.int(0, 14) }, () => r.int(-20, 20)); const spans: [number, number][] = Array.from({ length: r.int(0, 14) }, () => { const a = r.int(0, changes.length); return [a, r.int(a, changes.length)]; }); return { changes, spans }; },
  brute: reservoirSpansBrute, optimal: reservoirSpans,
  bruteCode: "function reservoirSpansBrute({ changes, spans }) {\n    const result = [];\n    for (const [start, end] of spans) {\n        let sum = 0;\n        for (let j = start; j < end; j++)\n            sum += changes[j];\n        result.push(sum);\n    }\n    return result;\n}",
  optimalCode: "function reservoirSpans({ changes, spans }) {\n    const prefix = [0];\n    for (const value of changes)\n        prefix.push(prefix[prefix.length - 1] + value);\n    return spans.map(([start, end]) => prefix[end] - prefix[start]);\n}",
  hints: ["Different requests may repeat many of the same ledger entries.", "Store the sum before each ledger position.", "Start with a zero prefix for the empty beginning.", "The net change before end includes the net change before start.", "Subtract prefix[start] from prefix[end] for each request in its original order."],
  bruteApproach: "Sum the entries from start up to but excluding end independently for each span.",
  optimalApproach: "Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals.",
  invariant: "prefix[k] equals the sum of the first k entries. Subtraction cancels exactly the entries before start.",
  bruteTime: "O(n × q)", optimalTime: "O(n + q)", optimalSpace: "O(n) auxiliary, O(q) output",
  mistakes: ["Treating end as inclusive.", "Dropping negative changes.", "Sorting requests and losing their original order."],
});
```

### `scripts/generator/templates/sliding-window.ts`

```ts
import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ readings: z.array(z.int().min(-20).max(20)).min(1).max(14), width: z.int().min(1).max(14), threshold: z.int().min(-20).max(20) })
  .refine((i) => i.width <= i.readings.length, "Window must fit readings");
type Input = z.infer<typeof input>;
export function signalBurstBrute({ readings, width, threshold }: Input) {
  let best = 0;
  for (let start = 0; start + width <= readings.length; start++) {
    let count = 0;
    for (let j = start; j < start + width; j++) if (readings[j] >= threshold) count++;
    best = Math.max(best, count);
  }
  return best;
}
export function signalBurst({ readings, width, threshold }: Input) {
  let count = 0;
  for (let j = 0; j < width; j++) if (readings[j] >= threshold) count++;
  let best = count;
  for (let j = width; j < readings.length; j++) {
    if (readings[j - width] >= threshold) count--;
    if (readings[j] >= threshold) count++;
    best = Math.max(best, count);
  }
  return best;
}
export const slidingWindow = defineTemplate({
  id: "signal-burst", title: "Beacon Signal Burst", pattern: "fixed-window",
  categories: ["arrays", "sliding-window"], tags: ["fixed-window"], input,
  statement: "A field beacon records integer signal readings in time order. A reading is clear when it is at least threshold. Among all contiguous blocks of exactly width readings, return the largest number of clear readings. Return a count, not a sum or the block position. The input is one object { readings, width, threshold }.",
  constraints: ["1 <= width <= readings.length <= 14.", "Readings and threshold are integers from -20 through 20."],
  edges: [{ readings: [4, -1, 6, 5], width: 2, threshold: 4 }, { readings: [2, 2, 1], width: 3, threshold: 2 }, { readings: [-20], width: 1, threshold: -20 }, { readings: [0, 0], width: 1, threshold: 1 }, { readings: [1, 0, 1], width: 2, threshold: 1 }],
  random(r) { const readings = Array.from({ length: r.int(1, 14) }, () => r.int(-20, 20)); return { readings, width: r.int(1, readings.length), threshold: r.int(-20, 20) }; },
  brute: signalBurstBrute, optimal: signalBurst,
  bruteCode: "function signalBurstBrute({ readings, width, threshold }) {\n    let best = 0;\n    for (let start = 0; start + width <= readings.length; start++) {\n        let count = 0;\n        for (let j = start; j < start + width; j++)\n            if (readings[j] >= threshold)\n                count++;\n        best = Math.max(best, count);\n    }\n    return best;\n}",
  optimalCode: "function signalBurst({ readings, width, threshold }) {\n    let count = 0;\n    for (let j = 0; j < width; j++)\n        if (readings[j] >= threshold)\n            count++;\n    let best = count;\n    for (let j = width; j < readings.length; j++) {\n        if (readings[j - width] >= threshold)\n            count--;\n        if (readings[j] >= threshold)\n            count++;\n        best = Math.max(best, count);\n    }\n    return best;\n}",
  hints: ["Convert each reading mentally to clear or not clear.", "Consecutive candidate blocks overlap in all but two positions.", "Count clear readings in the first complete block.", "Remove the departing reading's contribution and add the arriving reading's contribution.", "Record the maximum after each shift, including the initial block."],
  bruteApproach: "For every complete block, inspect its width readings and count those at least the threshold.",
  optimalApproach: "Count the first block, then update its count using the one departing and one arriving reading. Track the largest count.",
  invariant: "Before updating the best count, count equals the number of clear readings in the current complete block.",
  bruteTime: "O(n × width)", optimalTime: "O(n)", optimalSpace: "O(1)",
  mistakes: ["Summing readings instead of counting qualifying readings.", "Forgetting the first block.", "Excluding readings equal to threshold."],
});
```

### `scripts/generator/templates/two-pointers.ts`

```ts
import { z } from "zod";
import { defineTemplate } from "../template";

const input = z.strictObject({ weights: z.array(z.int().min(0).max(40)).max(14), budget: z.int().min(0).max(80) })
  .refine((i) => i.weights.every((w, n) => n === 0 || w >= i.weights[n - 1]), "Weights must be sorted");
type Input = z.infer<typeof input>;

export function supplyPairsBrute({ weights, budget }: Input) {
  let count = 0;
  for (let left = 0; left < weights.length; left++) {
    for (let right = left + 1; right < weights.length; right++) {
      if (weights[left] + weights[right] <= budget) count++;
    }
  }
  return count;
}
export function supplyPairs({ weights, budget }: Input) {
  let left = 0, right = weights.length - 1, count = 0;
  while (left < right) {
    if (weights[left] + weights[right] <= budget) {
      count += right - left;
      left++;
    } else right--;
  }
  return count;
}
export const twoPointers = defineTemplate({
  id: "supply-pairs", title: "Pairwise Supply Packs", pattern: "two-pointers",
  categories: ["arrays", "two-pointers"], tags: ["linear-scan"], input,
  statement: "A relief depot lists pack weights in nondecreasing order. A courier takes exactly two distinct packs whose combined weight is at most budget. Return the number of index pairs (i, j) with i < j that fit. Equal weights at different indices are different packs. Zero or one pack gives zero pairs. The input is one object { weights, budget }.",
  constraints: ["0 <= weights.length <= 14; weights are sorted in nondecreasing order.", "Every weight is an integer from 0 through 40; budget is an integer from 0 through 80."],
  edges: [{ weights: [1, 2, 3, 4], budget: 5 }, { weights: [2, 2, 2], budget: 4 }, { weights: [], budget: 0 }, { weights: [0], budget: 0 }, { weights: [0, 0], budget: 0 }, { weights: [8, 9], budget: 1 }],
  random(r) { return { weights: Array.from({ length: r.int(0, 14) }, () => r.int(0, 40)).sort((a, b) => a - b), budget: r.int(0, 80) }; },
  brute: supplyPairsBrute, optimal: supplyPairs,
  bruteCode: "function supplyPairsBrute({ weights, budget }) {\n    let count = 0;\n    for (let left = 0; left < weights.length; left++) {\n        for (let right = left + 1; right < weights.length; right++) {\n            if (weights[left] + weights[right] <= budget)\n                count++;\n        }\n    }\n    return count;\n}",
  optimalCode: "function supplyPairs({ weights, budget }) {\n    let left = 0, right = weights.length - 1, count = 0;\n    while (left < right) {\n        if (weights[left] + weights[right] <= budget) {\n            count += right - left;\n            left++;\n        }\n        else\n            right--;\n    }\n    return count;\n}",
  hints: ["Packs are distinguished by index, including duplicate weights.", "The sorted order lets you rule out several pairs together.", "Place one pointer at each end.", "If the endpoints fit, all pairs from left to every index up to right fit.", "Add right-left and advance left when they fit; otherwise decrease right. Stop when pointers meet."],
  bruteApproach: "Enumerate each pair of distinct indices once and count pairs within the budget.",
  optimalApproach: "Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint.",
  invariant: "Every pair outside the remaining interval has been counted or ruled out exactly once. Sorted weights justify counting or excluding an entire endpoint.",
  bruteTime: "O(n²)", optimalTime: "O(n)", optimalSpace: "O(1)",
  mistakes: ["Counting distinct weight values instead of index pairs.", "Using < instead of <= for the budget.", "Using the same pack twice."],
});
```

### `scripts/lib/reference-problems.ts`

```ts
import { z } from "zod";
import { templateForSlug } from "../generator/registry";
import type { ProblemSeed } from "../../src/lib/validators/problem";

const ints = z.array(z.int().min(-1_000_000).max(1_000_000)).max(100_000);
const relayInput = z.strictObject({ loads: ints.min(1), width: z.int().positive() })
  .refine((i) => i.width <= i.loads.length, "Window must fit the input");
const badgeInput = z.strictObject({ badges: z.string().max(100_000).regex(/^[a-z]*$/) });
const parcelInput = z.strictObject({ parcels: ints, ranges: z.array(z.tuple([z.int().nonnegative(), z.int().nonnegative()])).max(100_000) })
  .refine((i) => i.ranges.every(([a, b]) => a <= b && b <= i.parcels.length), "Invalid half-open range");
const dockInput = z.strictObject({ capacities: ints, load: z.int().min(-1_000_000).max(1_000_000) })
  .refine((i) => i.capacities.every((n, k) => k === 0 || n >= i.capacities[k - 1]), "Capacities must be sorted");
const lanternInput = z.strictObject({ costs: z.array(z.int().min(0).max(1000)).min(2).max(100_000) });

export function relayWindow(loads: number[], width: number) {
  let total = 0;
  for (let i = 0; i < width; i++) total += loads[i];
  let best = total;
  for (let i = width; i < loads.length; i++) {
    total += loads[i] - loads[i - width];
    best = Math.max(best, total);
  }
  return best;
}

export function relayWindowBrute(loads: number[], width: number) {
  let best = -Infinity;
  for (let start = 0; start + width <= loads.length; start++) {
    let total = 0;
    for (let i = start; i < start + width; i++) total += loads[i];
    best = Math.max(best, total);
  }
  return best;
}

export function quietBadge(badges: string) {
  const counts = new Map<string, number>();
  for (const badge of badges) counts.set(badge, (counts.get(badge) ?? 0) + 1);
  for (let i = 0; i < badges.length; i++) if (counts.get(badges[i]) === 1) return i;
  return -1;
}

export function quietBadgeBrute(badges: string) {
  for (let i = 0; i < badges.length; i++) {
    let count = 0;
    for (const badge of badges) if (badge === badges[i]) count++;
    if (count === 1) return i;
  }
  return -1;
}

export function parcelCheckpoints(parcels: number[], ranges: [number, number][]) {
  const prefix = [0];
  for (const count of parcels) prefix.push(prefix[prefix.length - 1] + count);
  return ranges.map(([start, end]) => prefix[end] - prefix[start]);
}

export function parcelCheckpointsBrute(parcels: number[], ranges: [number, number][]) {
  return ranges.map(([start, end]) => {
    let sum = 0;
    for (let i = start; i < end; i++) sum += parcels[i];
    return sum;
  });
}

export function dockThreshold(capacities: number[], load: number) {
  let left = 0;
  let right = capacities.length;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (capacities[mid] >= load) right = mid;
    else left = mid + 1;
  }
  return left === capacities.length ? -1 : left;
}

export function dockThresholdBrute(capacities: number[], load: number) {
  for (let i = 0; i < capacities.length; i++) if (capacities[i] >= load) return i;
  return -1;
}

export function lanternSteps(costs: number[]) {
  let twoBack = 0;
  let oneBack = 0;
  for (let step = 2; step <= costs.length; step++) {
    const current = Math.min(oneBack + costs[step - 1], twoBack + costs[step - 2]);
    twoBack = oneBack;
    oneBack = current;
  }
  return oneBack;
}

// Used only for bounded differential tests, never large imported fixtures.
export function lanternStepsBrute(costs: number[]) {
  function visit(step: number): number {
    if (step >= costs.length) return 0;
    return costs[step] + Math.min(visit(step + 1), visit(step + 2));
  }
  return Math.min(visit(0), visit(1));
}

// Allowlisted, authored reference code. JSON code strings are NEVER evaluated.
export function referenceResult(slug: string, input: unknown): number | number[] {
  switch (slug) {
    case "relay-window": { const i = relayInput.parse(input); return relayWindow(i.loads, i.width); }
    case "quiet-badge": { const i = badgeInput.parse(input); return quietBadge(i.badges); }
    case "parcel-checkpoints": { const i = parcelInput.parse(input); return parcelCheckpoints(i.parcels, i.ranges); }
    case "dock-threshold": { const i = dockInput.parse(input); return dockThreshold(i.capacities, i.load); }
    case "lantern-steps": { const i = lanternInput.parse(input); return lanternSteps(i.costs); }
    default: {
      const template = templateForSlug(slug);
      if (template) return template.evaluate(input, "optimal");
      throw new Error(`No trusted reference validator for ${slug}. Add one before seeding.`);
    }
  }
}

export function validateProblemSemantics(problem: ProblemSeed) {
  for (const [kind, cases] of [["example", problem.examples], ["test", problem.testCases]] as const) {
    for (const item of cases) {
      const expected = referenceResult(problem.slug, item.input);
      if (JSON.stringify(expected) !== JSON.stringify(item.output)) {
        throw new Error(`${problem.slug}: ${kind} ${item.position} has an incorrect expected output.`);
      }
    }
  }
}
```

### `scripts/validate-seeds.ts`

```ts
import { loadProblems } from "./lib/load-problems";
import { ROADMAPS } from "../src/data/seeds/roadmaps";
import { validateRoadmapReferences } from "../src/lib/validators/roadmap";

async function main() {
  const problems = await loadProblems();
  const generated = await loadProblems("src/data/seeds/generated");
  console.log(`Validated ${generated.length} generated draft fixtures separately from the published seed set.`);
  const roadmaps = validateRoadmapReferences(ROADMAPS, new Set(problems.filter((p) => p.status === "PUBLISHED").map((p) => p.slug)));
  console.log(`Validated ${problems.length} original problems, their examples, and all expected outputs.`);
  console.log(`Validated ${roadmaps.length} original roadmaps and their ordered problem references.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed validation failed.");
  process.exitCode = 1;
});
```

### `src/data/seeds/generated/gen-v1-reservoir-spans-1401.json`

```json
{
  "schemaVersion": 1,
  "slug": "gen-v1-reservoir-spans-1401",
  "title": "Reservoir Ledger Spans — Set 1401",
  "difficulty": "EASY",
  "kind": "CODING",
  "status": "DRAFT",
  "pattern": "prefix-sum",
  "statement": "A reservoir ledger records signed changes: inflow is positive and outflow is negative. For each requested span [start, end), return the net change from start inclusive to end exclusive. Keep answers in request order. An empty span has net change zero; no spans produces an empty answer array. The input is one object { changes, spans }.",
  "constraints": [
    "0 <= changes.length <= 14; each change is an integer from -20 through 20.",
    "There are at most 14 spans; each has integer endpoints 0 <= start <= end <= changes.length."
  ],
  "estimatedMinutes": 20,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "arrays"
  ],
  "tags": [
    "prefix-sum"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "changes": [
          5,
          -3,
          2
        ],
        "spans": [
          [
            0,
            3
          ],
          [
            1,
            2
          ]
        ]
      },
      "output": [
        4,
        -3
      ],
      "explanation": "For {\"changes\":[5,-3,2],\"spans\":[[0,3],[1,2]]}, the result is [4,-3]. Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals."
    },
    {
      "position": 2,
      "input": {
        "changes": [
          4,
          -4
        ],
        "spans": [
          [
            0,
            2
          ],
          [
            1,
            1
          ]
        ]
      },
      "output": [
        0,
        0
      ],
      "explanation": "For {\"changes\":[4,-4],\"spans\":[[0,2],[1,1]]}, the result is [0,0]. Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "Different requests may repeat many of the same ledger entries."
    },
    {
      "position": 2,
      "content": "Store the sum before each ledger position."
    },
    {
      "position": 3,
      "content": "Start with a zero prefix for the empty beginning."
    },
    {
      "position": 4,
      "content": "The net change before end includes the net change before start."
    },
    {
      "position": 5,
      "content": "Subtract prefix[start] from prefix[end] for each request in its original order."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "reservoirSpans",
      "code": "function reservoirSpans(input) {\n  // input is the object described in the statement.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "changes": [
          5,
          -3,
          2
        ],
        "spans": [
          [
            0,
            3
          ],
          [
            1,
            2
          ]
        ]
      },
      "output": [
        4,
        -3
      ],
      "explanation": "For {\"changes\":[5,-3,2],\"spans\":[[0,3],[1,2]]}, the result is [4,-3]. Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "changes": [
          4,
          -4
        ],
        "spans": [
          [
            0,
            2
          ],
          [
            1,
            1
          ]
        ]
      },
      "output": [
        0,
        0
      ],
      "explanation": "For {\"changes\":[4,-4],\"spans\":[[0,2],[1,1]]}, the result is [0,0]. Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "changes": [],
        "spans": [
          [
            0,
            0
          ]
        ]
      },
      "output": [
        0
      ],
      "explanation": "For {\"changes\":[],\"spans\":[[0,0]]}, the result is [0]. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "changes": [
          -2
        ],
        "spans": []
      },
      "output": [],
      "explanation": "For {\"changes\":[-2],\"spans\":[]}, the result is []. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "changes": [
          -20,
          -20
        ],
        "spans": [
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            0,
            1
          ]
        ]
      },
      "output": [
        -20,
        -40,
        -20
      ],
      "explanation": "For {\"changes\":[-20,-20],\"spans\":[[0,1],[0,2],[0,1]]}, the result is [-20,-40,-20]. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "changes": [
          -6,
          -17,
          1,
          -16,
          -14,
          -11,
          -14,
          -12,
          -18,
          -1,
          -14
        ],
        "spans": [
          [
            4,
            11
          ],
          [
            6,
            7
          ]
        ]
      },
      "output": [
        -84,
        -14
      ],
      "explanation": "For {\"changes\":[-6,-17,1,-16,-14,-11,-14,-12,-18,-1,-14],\"spans\":[[4,11],[6,7]]}, the result is [-84,-14]. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 7,
      "visibility": "HIDDEN",
      "input": {
        "changes": [
          8,
          -19,
          10,
          -18,
          -4,
          9,
          -1,
          -11,
          6
        ],
        "spans": [
          [
            0,
            9
          ],
          [
            5,
            6
          ],
          [
            9,
            9
          ],
          [
            7,
            8
          ]
        ]
      },
      "output": [
        -20,
        9,
        0,
        -11
      ],
      "explanation": "For {\"changes\":[8,-19,10,-18,-4,9,-1,-11,6],\"spans\":[[0,9],[5,6],[9,9],[7,8]]}, the result is [-20,9,0,-11]. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 8,
      "visibility": "HIDDEN",
      "input": {
        "changes": [
          12,
          8,
          14,
          -2,
          -2,
          3,
          3,
          -13,
          17,
          -9
        ],
        "spans": [
          [
            6,
            8
          ],
          [
            6,
            9
          ],
          [
            6,
            8
          ],
          [
            7,
            9
          ],
          [
            6,
            7
          ],
          [
            0,
            3
          ],
          [
            6,
            8
          ],
          [
            5,
            5
          ],
          [
            2,
            6
          ],
          [
            4,
            4
          ],
          [
            9,
            10
          ],
          [
            0,
            5
          ],
          [
            10,
            10
          ]
        ]
      },
      "output": [
        -10,
        7,
        -10,
        4,
        3,
        34,
        -10,
        0,
        13,
        0,
        -9,
        30,
        0
      ],
      "explanation": "For {\"changes\":[12,8,14,-2,-2,3,3,-13,17,-9],\"spans\":[[6,8],[6,9],[6,8],[7,9],[6,7],[0,3],[6,8],[5,5],[2,6],[4,4],[9,10],[0,5],[10,10]]}, the result is [-10,7,-10,4,3,34,-10,0,13,0,-9,30,0]. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 9,
      "visibility": "HIDDEN",
      "input": {
        "changes": [
          -20,
          11,
          -2,
          -20,
          17,
          2,
          -13,
          7,
          4,
          -17,
          -10,
          5,
          7
        ],
        "spans": [
          [
            8,
            13
          ],
          [
            8,
            12
          ]
        ]
      },
      "output": [
        -11,
        -18
      ],
      "explanation": "For {\"changes\":[-20,11,-2,-20,17,2,-13,7,4,-17,-10,5,7],\"spans\":[[8,13],[8,12]]}, the result is [-11,-18]. Checked by independent enumeration and the optimized reference."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Enumerate the candidates",
      "intuition": "Enumerating all allowed choices gives a small-input correctness oracle.",
      "approach": "Sum the entries from start up to but excluding end independently for each span.",
      "pseudocode": "Sum the entries from start up to but excluding end independently for each span.",
      "code": "function reservoirSpans({ changes, spans }) {\n    const result = [];\n    for (const [start, end] of spans) {\n        let sum = 0;\n        for (let j = start; j < end; j++)\n            sum += changes[j];\n        result.push(sum);\n    }\n    return result;\n}",
      "timeComplexity": "O(n × q)",
      "spaceComplexity": "O(q) output, O(1) auxiliary",
      "commonMistakes": [
        "Treating end as inclusive.",
        "Dropping negative changes.",
        "Sorting requests and losing their original order."
      ],
      "interviewExplanation": "Sum the entries from start up to but excluding end independently for each span. Use this bounded baseline to check the optimized strategy.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A reservoir ledger records signed changes: inflow is positive and outflow is negative. For each requested span [start, end), return the net change from start inclusive to end exclusive. Keep answers in request order. An empty span has net change zero; no spans produces an empty answer array. The input is one object { changes, spans }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "Sum the entries from start up to but excluding end independently for each span."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "Each permitted candidate is inspected, so taking the requested count, total or optimum is complete."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Reuse the structure",
      "intuition": "prefix[k] equals the sum of the first k entries. Subtraction cancels exactly the entries before start.",
      "approach": "Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals.",
      "pseudocode": "Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals.",
      "code": "function reservoirSpans({ changes, spans }) {\n    const prefix = [0];\n    for (const value of changes)\n        prefix.push(prefix[prefix.length - 1] + value);\n    return spans.map(([start, end]) => prefix[end] - prefix[start]);\n}",
      "timeComplexity": "O(n + q)",
      "spaceComplexity": "O(n) auxiliary, O(q) output",
      "commonMistakes": [
        "Treating end as inclusive.",
        "Dropping negative changes.",
        "Sorting requests and losing their original order."
      ],
      "interviewExplanation": "Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals. prefix[k] equals the sum of the first k entries. Subtraction cancels exactly the entries before start.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A reservoir ledger records signed changes: inflow is positive and outflow is negative. For each requested span [start, end), return the net change from start inclusive to end exclusive. Keep answers in request order. An empty span has net change zero; no spans produces an empty answer array. The input is one object { changes, spans }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "Build n+1 prefix totals starting at zero. Answer each span by subtracting its two endpoint totals."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "prefix[k] equals the sum of the first k entries. Subtraction cancels exactly the entries before start."
        }
      ]
    }
  ]
}
```

### `src/data/seeds/generated/gen-v1-signal-burst-1401.json`

```json
{
  "schemaVersion": 1,
  "slug": "gen-v1-signal-burst-1401",
  "title": "Beacon Signal Burst — Set 1401",
  "difficulty": "EASY",
  "kind": "CODING",
  "status": "DRAFT",
  "pattern": "fixed-window",
  "statement": "A field beacon records integer signal readings in time order. A reading is clear when it is at least threshold. Among all contiguous blocks of exactly width readings, return the largest number of clear readings. Return a count, not a sum or the block position. The input is one object { readings, width, threshold }.",
  "constraints": [
    "1 <= width <= readings.length <= 14.",
    "Readings and threshold are integers from -20 through 20."
  ],
  "estimatedMinutes": 20,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "arrays",
    "sliding-window"
  ],
  "tags": [
    "fixed-window"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "readings": [
          4,
          -1,
          6,
          5
        ],
        "width": 2,
        "threshold": 4
      },
      "output": 2,
      "explanation": "For {\"readings\":[4,-1,6,5],\"width\":2,\"threshold\":4}, the result is 2. Count the first block, then update its count using the one departing and one arriving reading. Track the largest count."
    },
    {
      "position": 2,
      "input": {
        "readings": [
          2,
          2,
          1
        ],
        "width": 3,
        "threshold": 2
      },
      "output": 2,
      "explanation": "For {\"readings\":[2,2,1],\"width\":3,\"threshold\":2}, the result is 2. Count the first block, then update its count using the one departing and one arriving reading. Track the largest count."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "Convert each reading mentally to clear or not clear."
    },
    {
      "position": 2,
      "content": "Consecutive candidate blocks overlap in all but two positions."
    },
    {
      "position": 3,
      "content": "Count clear readings in the first complete block."
    },
    {
      "position": 4,
      "content": "Remove the departing reading's contribution and add the arriving reading's contribution."
    },
    {
      "position": 5,
      "content": "Record the maximum after each shift, including the initial block."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "signalBurst",
      "code": "function signalBurst(input) {\n  // input is the object described in the statement.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "readings": [
          4,
          -1,
          6,
          5
        ],
        "width": 2,
        "threshold": 4
      },
      "output": 2,
      "explanation": "For {\"readings\":[4,-1,6,5],\"width\":2,\"threshold\":4}, the result is 2. Count the first block, then update its count using the one departing and one arriving reading. Track the largest count."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "readings": [
          2,
          2,
          1
        ],
        "width": 3,
        "threshold": 2
      },
      "output": 2,
      "explanation": "For {\"readings\":[2,2,1],\"width\":3,\"threshold\":2}, the result is 2. Count the first block, then update its count using the one departing and one arriving reading. Track the largest count."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "readings": [
          -20
        ],
        "width": 1,
        "threshold": -20
      },
      "output": 1,
      "explanation": "For {\"readings\":[-20],\"width\":1,\"threshold\":-20}, the result is 1. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "readings": [
          0,
          0
        ],
        "width": 1,
        "threshold": 1
      },
      "output": 0,
      "explanation": "For {\"readings\":[0,0],\"width\":1,\"threshold\":1}, the result is 0. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "readings": [
          1,
          0,
          1
        ],
        "width": 2,
        "threshold": 1
      },
      "output": 1,
      "explanation": "For {\"readings\":[1,0,1],\"width\":2,\"threshold\":1}, the result is 1. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "readings": [
          -6,
          -17,
          1,
          -16,
          -14,
          -11,
          -14,
          -12,
          -18,
          -1,
          -14
        ],
        "width": 3,
        "threshold": -5
      },
      "output": 1,
      "explanation": "For {\"readings\":[-6,-17,1,-16,-14,-11,-14,-12,-18,-1,-14],\"width\":3,\"threshold\":-5}, the result is 1. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 7,
      "visibility": "HIDDEN",
      "input": {
        "readings": [
          1,
          -9,
          4,
          8,
          -19,
          10,
          -18,
          -4,
          9,
          -1,
          -11,
          6,
          -9
        ],
        "width": 1,
        "threshold": 20
      },
      "output": 0,
      "explanation": "For {\"readings\":[1,-9,4,8,-19,10,-18,-4,9,-1,-11,6,-9],\"width\":1,\"threshold\":20}, the result is 0. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 8,
      "visibility": "HIDDEN",
      "input": {
        "readings": [
          -6,
          19,
          18,
          9,
          -4,
          7,
          12,
          8,
          14
        ],
        "width": 5,
        "threshold": -2
      },
      "output": 4,
      "explanation": "For {\"readings\":[-6,19,18,9,-4,7,12,8,14],\"width\":5,\"threshold\":-2}, the result is 4. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 9,
      "visibility": "HIDDEN",
      "input": {
        "readings": [
          3,
          -13,
          17,
          -9,
          16,
          4,
          4,
          3,
          11
        ],
        "width": 6,
        "threshold": 1
      },
      "output": 5,
      "explanation": "For {\"readings\":[3,-13,17,-9,16,4,4,3,11],\"width\":6,\"threshold\":1}, the result is 5. Checked by independent enumeration and the optimized reference."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Enumerate the candidates",
      "intuition": "Enumerating all allowed choices gives a small-input correctness oracle.",
      "approach": "For every complete block, inspect its width readings and count those at least the threshold.",
      "pseudocode": "For every complete block, inspect its width readings and count those at least the threshold.",
      "code": "function signalBurst({ readings, width, threshold }) {\n    let best = 0;\n    for (let start = 0; start + width <= readings.length; start++) {\n        let count = 0;\n        for (let j = start; j < start + width; j++)\n            if (readings[j] >= threshold)\n                count++;\n        best = Math.max(best, count);\n    }\n    return best;\n}",
      "timeComplexity": "O(n × width)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Summing readings instead of counting qualifying readings.",
        "Forgetting the first block.",
        "Excluding readings equal to threshold."
      ],
      "interviewExplanation": "For every complete block, inspect its width readings and count those at least the threshold. Use this bounded baseline to check the optimized strategy.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A field beacon records integer signal readings in time order. A reading is clear when it is at least threshold. Among all contiguous blocks of exactly width readings, return the largest number of clear readings. Return a count, not a sum or the block position. The input is one object { readings, width, threshold }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "For every complete block, inspect its width readings and count those at least the threshold."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "Each permitted candidate is inspected, so taking the requested count, total or optimum is complete."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Reuse the structure",
      "intuition": "Before updating the best count, count equals the number of clear readings in the current complete block.",
      "approach": "Count the first block, then update its count using the one departing and one arriving reading. Track the largest count.",
      "pseudocode": "Count the first block, then update its count using the one departing and one arriving reading. Track the largest count.",
      "code": "function signalBurst({ readings, width, threshold }) {\n    let count = 0;\n    for (let j = 0; j < width; j++)\n        if (readings[j] >= threshold)\n            count++;\n    let best = count;\n    for (let j = width; j < readings.length; j++) {\n        if (readings[j - width] >= threshold)\n            count--;\n        if (readings[j] >= threshold)\n            count++;\n        best = Math.max(best, count);\n    }\n    return best;\n}",
      "timeComplexity": "O(n)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Summing readings instead of counting qualifying readings.",
        "Forgetting the first block.",
        "Excluding readings equal to threshold."
      ],
      "interviewExplanation": "Count the first block, then update its count using the one departing and one arriving reading. Track the largest count. Before updating the best count, count equals the number of clear readings in the current complete block.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A field beacon records integer signal readings in time order. A reading is clear when it is at least threshold. Among all contiguous blocks of exactly width readings, return the largest number of clear readings. Return a count, not a sum or the block position. The input is one object { readings, width, threshold }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "Count the first block, then update its count using the one departing and one arriving reading. Track the largest count."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "Before updating the best count, count equals the number of clear readings in the current complete block."
        }
      ]
    }
  ]
}
```

### `src/data/seeds/generated/gen-v1-supply-pairs-1401.json`

```json
{
  "schemaVersion": 1,
  "slug": "gen-v1-supply-pairs-1401",
  "title": "Pairwise Supply Packs — Set 1401",
  "difficulty": "EASY",
  "kind": "CODING",
  "status": "DRAFT",
  "pattern": "two-pointers",
  "statement": "A relief depot lists pack weights in nondecreasing order. A courier takes exactly two distinct packs whose combined weight is at most budget. Return the number of index pairs (i, j) with i < j that fit. Equal weights at different indices are different packs. Zero or one pack gives zero pairs. The input is one object { weights, budget }.",
  "constraints": [
    "0 <= weights.length <= 14; weights are sorted in nondecreasing order.",
    "Every weight is an integer from 0 through 40; budget is an integer from 0 through 80."
  ],
  "estimatedMinutes": 20,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "arrays",
    "two-pointers"
  ],
  "tags": [
    "linear-scan"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "weights": [
          1,
          2,
          3,
          4
        ],
        "budget": 5
      },
      "output": 4,
      "explanation": "For {\"weights\":[1,2,3,4],\"budget\":5}, the result is 4. Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint."
    },
    {
      "position": 2,
      "input": {
        "weights": [
          2,
          2,
          2
        ],
        "budget": 4
      },
      "output": 3,
      "explanation": "For {\"weights\":[2,2,2],\"budget\":4}, the result is 3. Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "Packs are distinguished by index, including duplicate weights."
    },
    {
      "position": 2,
      "content": "The sorted order lets you rule out several pairs together."
    },
    {
      "position": 3,
      "content": "Place one pointer at each end."
    },
    {
      "position": 4,
      "content": "If the endpoints fit, all pairs from left to every index up to right fit."
    },
    {
      "position": 5,
      "content": "Add right-left and advance left when they fit; otherwise decrease right. Stop when pointers meet."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "supplyPairs",
      "code": "function supplyPairs(input) {\n  // input is the object described in the statement.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "weights": [
          1,
          2,
          3,
          4
        ],
        "budget": 5
      },
      "output": 4,
      "explanation": "For {\"weights\":[1,2,3,4],\"budget\":5}, the result is 4. Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "weights": [
          2,
          2,
          2
        ],
        "budget": 4
      },
      "output": 3,
      "explanation": "For {\"weights\":[2,2,2],\"budget\":4}, the result is 3. Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "weights": [],
        "budget": 0
      },
      "output": 0,
      "explanation": "For {\"weights\":[],\"budget\":0}, the result is 0. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "weights": [
          0
        ],
        "budget": 0
      },
      "output": 0,
      "explanation": "For {\"weights\":[0],\"budget\":0}, the result is 0. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "weights": [
          0,
          0
        ],
        "budget": 0
      },
      "output": 1,
      "explanation": "For {\"weights\":[0,0],\"budget\":0}, the result is 1. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "weights": [
          8,
          9
        ],
        "budget": 1
      },
      "output": 0,
      "explanation": "For {\"weights\":[8,9],\"budget\":1}, the result is 0. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 7,
      "visibility": "HIDDEN",
      "input": {
        "weights": [
          2,
          3,
          4,
          6,
          6,
          6,
          8,
          9,
          14,
          19,
          21
        ],
        "budget": 15
      },
      "output": 27,
      "explanation": "For {\"weights\":[2,3,4,6,6,6,8,9,14,19,21],\"budget\":15}, the result is 27. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 8,
      "visibility": "HIDDEN",
      "input": {
        "weights": [
          11,
          21,
          24,
          28,
          36
        ],
        "budget": 1
      },
      "output": 0,
      "explanation": "For {\"weights\":[11,21,24,28,36],\"budget\":1}, the result is 0. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 9,
      "visibility": "HIDDEN",
      "input": {
        "weights": [
          2,
          2,
          9,
          11,
          14,
          16,
          19,
          23,
          26,
          29,
          40
        ],
        "budget": 78
      },
      "output": 55,
      "explanation": "For {\"weights\":[2,2,9,11,14,16,19,23,26,29,40],\"budget\":78}, the result is 55. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 10,
      "visibility": "HIDDEN",
      "input": {
        "weights": [
          7,
          11,
          16,
          18,
          18,
          23,
          23,
          27,
          28,
          29,
          32,
          34,
          37
        ],
        "budget": 72
      },
      "output": 78,
      "explanation": "For {\"weights\":[7,11,16,18,18,23,23,27,28,29,32,34,37],\"budget\":72}, the result is 78. Checked by independent enumeration and the optimized reference."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Enumerate the candidates",
      "intuition": "Enumerating all allowed choices gives a small-input correctness oracle.",
      "approach": "Enumerate each pair of distinct indices once and count pairs within the budget.",
      "pseudocode": "Enumerate each pair of distinct indices once and count pairs within the budget.",
      "code": "function supplyPairs({ weights, budget }) {\n    let count = 0;\n    for (let left = 0; left < weights.length; left++) {\n        for (let right = left + 1; right < weights.length; right++) {\n            if (weights[left] + weights[right] <= budget)\n                count++;\n        }\n    }\n    return count;\n}",
      "timeComplexity": "O(n²)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Counting distinct weight values instead of index pairs.",
        "Using < instead of <= for the budget.",
        "Using the same pack twice."
      ],
      "interviewExplanation": "Enumerate each pair of distinct indices once and count pairs within the budget. Use this bounded baseline to check the optimized strategy.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A relief depot lists pack weights in nondecreasing order. A courier takes exactly two distinct packs whose combined weight is at most budget. Return the number of index pairs (i, j) with i < j that fit. Equal weights at different indices are different packs. Zero or one pack gives zero pairs. The input is one object { weights, budget }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "Enumerate each pair of distinct indices once and count pairs within the budget."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "Each permitted candidate is inspected, so taking the requested count, total or optimum is complete."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Reuse the structure",
      "intuition": "Every pair outside the remaining interval has been counted or ruled out exactly once. Sorted weights justify counting or excluding an entire endpoint.",
      "approach": "Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint.",
      "pseudocode": "Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint.",
      "code": "function supplyPairs({ weights, budget }) {\n    let left = 0, right = weights.length - 1, count = 0;\n    while (left < right) {\n        if (weights[left] + weights[right] <= budget) {\n            count += right - left;\n            left++;\n        }\n        else\n            right--;\n    }\n    return count;\n}",
      "timeComplexity": "O(n)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Counting distinct weight values instead of index pairs.",
        "Using < instead of <= for the budget.",
        "Using the same pack twice."
      ],
      "interviewExplanation": "Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint. Every pair outside the remaining interval has been counted or ruled out exactly once. Sorted weights justify counting or excluding an entire endpoint.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A relief depot lists pack weights in nondecreasing order. A courier takes exactly two distinct packs whose combined weight is at most budget. Return the number of index pairs (i, j) with i < j that fit. Equal weights at different indices are different packs. Zero or one pack gives zero pairs. The input is one object { weights, budget }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "Keep two endpoints. If their sum fits, count all right-left partners for the left pack and advance left. Otherwise discard the right endpoint."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "Every pair outside the remaining interval has been counted or ruled out exactly once. Sorted weights justify counting or excluding an entire endpoint."
        }
      ]
    }
  ]
}
```

### `src/data/seeds/generated/gen-v1-tide-marker-1401.json`

```json
{
  "schemaVersion": 1,
  "slug": "gen-v1-tide-marker-1401",
  "title": "First Dry Tide Marker — Set 1401",
  "difficulty": "EASY",
  "kind": "CODING",
  "status": "DRAFT",
  "pattern": "upper-bound",
  "statement": "A harbor's marker heights are listed in nondecreasing order as marks. A marker is dry only when its height is strictly greater than the current water level. Return the zero-based index of the first dry marker. If every marker is submerged or the list is empty, return -1. A marker exactly at the water level is not dry. The input is one object { marks, level }.",
  "constraints": [
    "0 <= marks.length <= 14; marks are sorted in nondecreasing order.",
    "Marker heights and level are integers from -20 through 20."
  ],
  "estimatedMinutes": 20,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "arrays",
    "binary-search"
  ],
  "tags": [
    "monotone-search"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "marks": [
          1,
          3,
          3,
          7
        ],
        "level": 3
      },
      "output": 3,
      "explanation": "For {\"marks\":[1,3,3,7],\"level\":3}, the result is 3. Binary search the first true value of marks[i] > level with right initially equal to length."
    },
    {
      "position": 2,
      "input": {
        "marks": [
          2,
          2
        ],
        "level": 2
      },
      "output": -1,
      "explanation": "For {\"marks\":[2,2],\"level\":2}, the result is -1. Binary search the first true value of marks[i] > level with right initially equal to length."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "Dry markers form a suffix in the sorted list."
    },
    {
      "position": 2,
      "content": "Equality belongs to the submerged side."
    },
    {
      "position": 3,
      "content": "Search the half-open interval [left, right)."
    },
    {
      "position": 4,
      "content": "A dry midpoint may be the first dry marker, so retain it as the right boundary."
    },
    {
      "position": 5,
      "content": "A submerged midpoint moves left to middle+1; translate an endpoint equal to length into -1."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "tideMarker",
      "code": "function tideMarker(input) {\n  // input is the object described in the statement.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "marks": [
          1,
          3,
          3,
          7
        ],
        "level": 3
      },
      "output": 3,
      "explanation": "For {\"marks\":[1,3,3,7],\"level\":3}, the result is 3. Binary search the first true value of marks[i] > level with right initially equal to length."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "marks": [
          2,
          2
        ],
        "level": 2
      },
      "output": -1,
      "explanation": "For {\"marks\":[2,2],\"level\":2}, the result is -1. Binary search the first true value of marks[i] > level with right initially equal to length."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "marks": [],
        "level": 0
      },
      "output": -1,
      "explanation": "For {\"marks\":[],\"level\":0}, the result is -1. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "marks": [
          -4
        ],
        "level": -5
      },
      "output": 0,
      "explanation": "For {\"marks\":[-4],\"level\":-5}, the result is 0. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "marks": [
          -20,
          0,
          20
        ],
        "level": 20
      },
      "output": -1,
      "explanation": "For {\"marks\":[-20,0,20],\"level\":20}, the result is -1. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "marks": [
          0,
          0,
          0,
          1
        ],
        "level": 0
      },
      "output": 3,
      "explanation": "For {\"marks\":[0,0,0,1],\"level\":0}, the result is 3. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 7,
      "visibility": "HIDDEN",
      "input": {
        "marks": [
          -18,
          -17,
          -16,
          -14,
          -14,
          -14,
          -12,
          -11,
          -6,
          -1,
          1
        ],
        "level": -12
      },
      "output": 7,
      "explanation": "For {\"marks\":[-18,-17,-16,-14,-14,-14,-12,-11,-6,-1,1],\"level\":-12}, the result is 7. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 8,
      "visibility": "HIDDEN",
      "input": {
        "marks": [
          -9,
          1,
          4,
          8,
          16
        ],
        "level": -19
      },
      "output": 0,
      "explanation": "For {\"marks\":[-9,1,4,8,16],\"level\":-19}, the result is 0. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 9,
      "visibility": "HIDDEN",
      "input": {
        "marks": [
          -18,
          -18,
          -11,
          -9,
          -6,
          -4,
          -1,
          3,
          6,
          9,
          20
        ],
        "level": 19
      },
      "output": 10,
      "explanation": "For {\"marks\":[-18,-18,-11,-9,-6,-4,-1,3,6,9,20],\"level\":19}, the result is 10. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 10,
      "visibility": "HIDDEN",
      "input": {
        "marks": [
          -13,
          -9,
          -4,
          -2,
          -2,
          3,
          3,
          7,
          8,
          9,
          12,
          14,
          17
        ],
        "level": 16
      },
      "output": 12,
      "explanation": "For {\"marks\":[-13,-9,-4,-2,-2,3,3,7,8,9,12,14,17],\"level\":16}, the result is 12. Checked by independent enumeration and the optimized reference."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Enumerate the candidates",
      "intuition": "Enumerating all allowed choices gives a small-input correctness oracle.",
      "approach": "Scan from the beginning and return the first index whose height is strictly greater than level.",
      "pseudocode": "Scan from the beginning and return the first index whose height is strictly greater than level.",
      "code": "function tideMarker({ marks, level }) {\n    for (let j = 0; j < marks.length; j++)\n        if (marks[j] > level)\n            return j;\n    return -1;\n}",
      "timeComplexity": "O(n)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Using >= and accepting markers at water level.",
        "Returning any dry marker instead of the first.",
        "Returning length instead of -1 when no marker is dry."
      ],
      "interviewExplanation": "Scan from the beginning and return the first index whose height is strictly greater than level. Use this bounded baseline to check the optimized strategy.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A harbor's marker heights are listed in nondecreasing order as marks. A marker is dry only when its height is strictly greater than the current water level. Return the zero-based index of the first dry marker. If every marker is submerged or the list is empty, return -1. A marker exactly at the water level is not dry. The input is one object { marks, level }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "Scan from the beginning and return the first index whose height is strictly greater than level."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "Each permitted candidate is inspected, so taking the requested count, total or optimum is complete."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Reuse the structure",
      "intuition": "Every index before left is submerged, and every index at or after right is dry. The unknown interval shrinks each iteration.",
      "approach": "Binary search the first true value of marks[i] > level with right initially equal to length.",
      "pseudocode": "Binary search the first true value of marks[i] > level with right initially equal to length.",
      "code": "function tideMarker({ marks, level }) {\n    let left = 0, right = marks.length;\n    while (left < right) {\n        const middle = left + Math.floor((right - left) / 2);\n        if (marks[middle] > level)\n            right = middle;\n        else\n            left = middle + 1;\n    }\n    return left === marks.length ? -1 : left;\n}",
      "timeComplexity": "O(log(n + 1))",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Using >= and accepting markers at water level.",
        "Returning any dry marker instead of the first.",
        "Returning length instead of -1 when no marker is dry."
      ],
      "interviewExplanation": "Binary search the first true value of marks[i] > level with right initially equal to length. Every index before left is submerged, and every index at or after right is dry. The unknown interval shrinks each iteration.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A harbor's marker heights are listed in nondecreasing order as marks. A marker is dry only when its height is strictly greater than the current water level. Return the zero-based index of the first dry marker. If every marker is submerged or the list is empty, return -1. A marker exactly at the water level is not dry. The input is one object { marks, level }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "Binary search the first true value of marks[i] > level with right initially equal to length."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "Every index before left is submerged, and every index at or after right is dry. The unknown interval shrinks each iteration."
        }
      ]
    }
  ]
}
```

### `src/data/seeds/generated/gen-v1-workshop-credits-1401.json`

```json
{
  "schemaVersion": 1,
  "slug": "gen-v1-workshop-credits-1401",
  "title": "Rest-Day Workshop Credits — Set 1401",
  "difficulty": "EASY",
  "kind": "CODING",
  "status": "DRAFT",
  "pattern": "one-dimensional-dp",
  "statement": "A community studio offers one workshop per day with the listed credits. Attending a workshop requires resting the following day, so no two selected day indices may be adjacent. Return the largest total credits you can earn. You may skip every workshop; an empty schedule earns zero. The input is one object { credits }.",
  "constraints": [
    "0 <= credits.length <= 14.",
    "Each credit value is an integer from 0 through 40."
  ],
  "estimatedMinutes": 20,
  "timeLimitMs": 2000,
  "memoryLimitKb": 262144,
  "categories": [
    "arrays",
    "dynamic-programming"
  ],
  "tags": [
    "state-transition"
  ],
  "interviewStyles": [
    "general-software"
  ],
  "relatedSlugs": [],
  "examples": [
    {
      "position": 1,
      "input": {
        "credits": [
          5,
          9,
          5
        ]
      },
      "output": 10,
      "explanation": "For {\"credits\":[5,9,5]}, the result is 10. For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima."
    },
    {
      "position": 2,
      "input": {
        "credits": [
          0,
          0
        ]
      },
      "output": 0,
      "explanation": "For {\"credits\":[0,0]}, the result is 0. For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima."
    }
  ],
  "hints": [
    {
      "position": 1,
      "content": "Taking the largest single workshop first may block a better pair."
    },
    {
      "position": 2,
      "content": "At each day, compare attending with skipping."
    },
    {
      "position": 3,
      "content": "Attending uses the best total ending before the preceding day."
    },
    {
      "position": 4,
      "content": "Skipping retains the best total for all previous days."
    },
    {
      "position": 5,
      "content": "Use current = max(oneBack, twoBack + credit), then shift the two stored totals."
    }
  ],
  "starterCode": [
    {
      "language": "JAVASCRIPT",
      "entryPoint": "workshopCredits",
      "code": "function workshopCredits(input) {\n  // input is the object described in the statement.\n  throw new Error(\"Not implemented\");\n}"
    }
  ],
  "testCases": [
    {
      "position": 1,
      "visibility": "VISIBLE",
      "input": {
        "credits": [
          5,
          9,
          5
        ]
      },
      "output": 10,
      "explanation": "For {\"credits\":[5,9,5]}, the result is 10. For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima."
    },
    {
      "position": 2,
      "visibility": "VISIBLE",
      "input": {
        "credits": [
          0,
          0
        ]
      },
      "output": 0,
      "explanation": "For {\"credits\":[0,0]}, the result is 0. For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima."
    },
    {
      "position": 3,
      "visibility": "HIDDEN",
      "input": {
        "credits": []
      },
      "output": 0,
      "explanation": "For {\"credits\":[]}, the result is 0. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 4,
      "visibility": "HIDDEN",
      "input": {
        "credits": [
          7
        ]
      },
      "output": 7,
      "explanation": "For {\"credits\":[7]}, the result is 7. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 5,
      "visibility": "HIDDEN",
      "input": {
        "credits": [
          4,
          4,
          4,
          4
        ]
      },
      "output": 8,
      "explanation": "For {\"credits\":[4,4,4,4]}, the result is 8. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 6,
      "visibility": "HIDDEN",
      "input": {
        "credits": [
          1,
          10,
          1,
          10,
          1
        ]
      },
      "output": 20,
      "explanation": "For {\"credits\":[1,10,1,10,1]}, the result is 20. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 7,
      "visibility": "HIDDEN",
      "input": {
        "credits": [
          14,
          3,
          21,
          4,
          6,
          9,
          6,
          8,
          2,
          19,
          6
        ]
      },
      "output": 71,
      "explanation": "For {\"credits\":[14,3,21,4,6,9,6,8,2,19,6]}, the result is 71. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 8,
      "visibility": "HIDDEN",
      "input": {
        "credits": [
          15,
          36
        ]
      },
      "output": 36,
      "explanation": "For {\"credits\":[15,36]}, the result is 36. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 9,
      "visibility": "HIDDEN",
      "input": {
        "credits": [
          11,
          24,
          28,
          1,
          30,
          2,
          16
        ]
      },
      "output": 85,
      "explanation": "For {\"credits\":[11,24,28,1,30,2,16]}, the result is 85. Checked by independent enumeration and the optimized reference."
    },
    {
      "position": 10,
      "visibility": "HIDDEN",
      "input": {
        "credits": [
          19,
          9,
          26,
          11,
          2,
          40,
          23,
          14,
          39,
          38
        ]
      },
      "output": 137,
      "explanation": "For {\"credits\":[19,9,26,11,2,40,23,14,39,38]}, the result is 137. Checked by independent enumeration and the optimized reference."
    }
  ],
  "solutions": [
    {
      "kind": "BRUTE_FORCE",
      "language": "JAVASCRIPT",
      "title": "Enumerate the candidates",
      "intuition": "Enumerating all allowed choices gives a small-input correctness oracle.",
      "approach": "Enumerate every subset with a bit mask, reject adjacent selected bits, and maximize the selected credit sum. The fourteen-day bound keeps exhaustive validation small.",
      "pseudocode": "Enumerate every subset with a bit mask, reject adjacent selected bits, and maximize the selected credit sum. The fourteen-day bound keeps exhaustive validation small.",
      "code": "function workshopCredits({ credits }) {\n    let best = 0;\n    for (let mask = 0; mask < 2 ** credits.length; mask++) {\n        if ((mask & (mask << 1)) !== 0)\n            continue;\n        let total = 0;\n        for (let j = 0; j < credits.length; j++)\n            if ((mask & (1 << j)) !== 0)\n                total += credits[j];\n        best = Math.max(best, total);\n    }\n    return best;\n}",
      "timeComplexity": "O(n × 2^n)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Greedily choosing the largest credit value.",
        "Updating twoBack before computing the current value.",
        "Forcing a workshop on an empty schedule."
      ],
      "interviewExplanation": "Enumerate every subset with a bit mask, reject adjacent selected bits, and maximize the selected credit sum. The fourteen-day bound keeps exhaustive validation small. Use this bounded baseline to check the optimized strategy.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A community studio offers one workshop per day with the listed credits. Attending a workshop requires resting the following day, so no two selected day indices may be adjacent. Return the largest total credits you can earn. You may skip every workshop; an empty schedule earns zero. The input is one object { credits }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "Enumerate every subset with a bit mask, reject adjacent selected bits, and maximize the selected credit sum. The fourteen-day bound keeps exhaustive validation small."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "Each permitted candidate is inspected, so taking the requested count, total or optimum is complete."
        }
      ]
    },
    {
      "kind": "OPTIMAL",
      "language": "JAVASCRIPT",
      "title": "Reuse the structure",
      "intuition": "Before each day, oneBack is the optimum for all preceding days and twoBack excludes the immediately preceding day. The two choices cover every valid schedule.",
      "approach": "For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima.",
      "pseudocode": "For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima.",
      "code": "function workshopCredits({ credits }) {\n    let twoBack = 0, oneBack = 0;\n    for (const credit of credits) {\n        const current = Math.max(oneBack, twoBack + credit);\n        twoBack = oneBack;\n        oneBack = current;\n    }\n    return oneBack;\n}",
      "timeComplexity": "O(n)",
      "spaceComplexity": "O(1)",
      "commonMistakes": [
        "Greedily choosing the largest credit value.",
        "Updating twoBack before computing the current value.",
        "Forcing a workshop on an empty schedule."
      ],
      "interviewExplanation": "For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima. Before each day, oneBack is the optimum for all preceding days and twoBack excludes the immediately preceding day. The two choices cover every valid schedule.",
      "steps": [
        {
          "position": 1,
          "title": "Define the candidates",
          "content": "A community studio offers one workshop per day with the listed credits. Attending a workshop requires resting the following day, so no two selected day indices may be adjacent. Return the largest total credits you can earn. You may skip every workshop; an empty schedule earns zero. The input is one object { credits }."
        },
        {
          "position": 2,
          "title": "Compute the result",
          "content": "For each day compare skipping it with adding its credits to the optimum from two days back. Keep only the two previous optima."
        },
        {
          "position": 3,
          "title": "Check the argument",
          "content": "Before each day, oneBack is the optimum for all preceding days and twoBack excludes the immediately preceding day. The two choices cover every valid schedule."
        }
      ]
    }
  ]
}
```

### `src/data/seeds/generated/manifest.txt`

```text
AlgoSprint generator v1
Options: {"seed":1401,"count":1,"template":"all"}
Status: DRAFT; human review required. Seed variants reuse five authored templates.
Files:
gen-v1-supply-pairs-1401.json
gen-v1-signal-burst-1401.json
gen-v1-reservoir-spans-1401.json
gen-v1-tide-marker-1401.json
gen-v1-workshop-credits-1401.json
```

### `src/data/seeds/taxonomy.ts`

```ts
// Stable slugs are shared by validation, imports, and the future filter UI.
export const CATEGORIES = [
  ["arrays", "Arrays"], ["strings", "Strings"], ["hash-maps", "Hash Maps"],
  ["two-pointers", "Two Pointers"], ["sliding-window", "Sliding Window"],
  ["stack", "Stack"], ["queue", "Queue"], ["linked-list", "Linked List"],
  ["trees", "Trees"], ["binary-search-trees", "Binary Search Trees"],
  ["heaps", "Heaps / Priority Queues"], ["graphs", "Graphs"],
  ["bfs", "BFS"], ["dfs", "DFS"], ["backtracking", "Backtracking"],
  ["dynamic-programming", "Dynamic Programming"], ["greedy", "Greedy Algorithms"],
  ["binary-search", "Binary Search"], ["intervals", "Intervals"],
  ["sorting", "Sorting"], ["recursion", "Recursion"], ["bit-manipulation", "Bit Manipulation"],
  ["math", "Math"], ["tries", "Tries"], ["union-find", "Union Find"],
  ["topological-sort", "Topological Sort"], ["design", "Design Problems"],
  ["system-design", "System Design Basics"], ["sql", "SQL Problems"],
  ["object-oriented", "Object-Oriented Programming Interview Problems"],
] as const;

export const TAGS = [
  ["prefix-sum", "Prefix Sum"], ["frequency-count", "Frequency Count"],
  ["fixed-window", "Fixed Window"], ["monotone-search", "Monotone Search"],
  ["state-transition", "State Transition"], ["linear-scan", "Linear Scan"],
] as const;

export const INTERVIEW_STYLES = [["general-software", "General Software Interview"]] as const;
export const PATTERNS = ["prefix-sum", "frequency-count", "fixed-window", "lower-bound", "one-dimensional-dp", "two-pointers", "upper-bound"] as const;
```

### `tests/generator.test.ts`

```ts
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "node:vm";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { checkedOutput, generateProblem, generateProblems } from "../scripts/generator/generate";
import { generatedFiles, writeGeneratedFiles } from "../scripts/generator/files";
import { createRandom } from "../scripts/generator/random";
import { TEMPLATES, templateForSlug } from "../scripts/generator/registry";
import { referenceResult, validateProblemSemantics } from "../scripts/lib/reference-problems";
import { loadProblems } from "../scripts/lib/load-problems";
import { parseAdminProblems } from "@/features/admin/contracts";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function temporary() { const root = await mkdtemp(join(tmpdir(), "algosprint-generator-")); roots.push(root); return root; }

describe("original deterministic problem generation", () => {
  it("reproduces the checked-in fixtures exactly and keeps them outside default seeds", async () => {
    expect(await writeGeneratedFiles("src/data/seeds/generated", { seed: 1401 }, true)).toBe(5);
    expect((await loadProblems()).map((p) => p.slug).some((slug) => slug.startsWith("gen-"))).toBe(false);
    expect(await loadProblems("src/data/seeds/generated")).toHaveLength(5);
  });
  it("produces valid draft objects that can pass the existing administrator import boundary", () => {
    const problems = generateProblems({ seed: 1401 });
    expect(new Set(problems.map((p) => p.pattern)).size).toBe(5);
    expect(parseAdminProblems(JSON.stringify(problems), true)).toEqual(problems);
    for (const p of problems) {
      expect(p.status).toBe("DRAFT"); expect(p.hints).toHaveLength(5);
      validateProblemSemantics(p);
      for (const item of [...p.starterCode, ...p.solutions]) {
        expect(() => new Script(item.code)).not.toThrow();
        expect(item.code).toContain(`function ${p.starterCode[0].entryPoint}(`);
        expect(item.code).not.toMatch(/__name|\[native code\]/);
      }
    }
  });
  it("authored static solution listings agree with their trusted functions", () => {
    // Execute only checked-in template literals here, never imported/generated JSON code.
    for (const template of TEMPLATES) {
      const random = createRandom(17);
      const inputs = [...template.edges, ...Array.from({ length: 12 }, () => template.random(random))];
      for (const strategy of ["brute", "optimal"] as const) {
        const code = strategy === "brute" ? template.bruteCode : template.optimalCode;
        const name = /^function ([^(]+)/.exec(code)![1];
        const script = new Script(`${code}; ${name}(input)`);
        for (const input of inputs) {
          const actual = script.runInNewContext({ input: structuredClone(input) }, { timeout: 1000 });
          expect(JSON.stringify(actual)).toBe(JSON.stringify(template.evaluate(input, strategy)));
        }
      }
    }
  });
  it("uses isolated repeatable streams and varies stored cases across seeds", () => {
    const a = createRandom(0), b = createRandom(0);
    expect(Array.from({ length: 20 }, () => a.int(-20, 20))).toEqual(Array.from({ length: 20 }, () => b.int(-20, 20)));
    const before = generatedFiles({ seed: 42 });
    generateProblems({ seed: 9 });
    expect(generatedFiles({ seed: 42 })).toEqual(before);
    for (const t of TEMPLATES) expect(generateProblem(t.id, 42).testCases).not.toEqual(generateProblem(t.id, 43).testCases);
  });
  it("differentially checks all five patterns for boundary seeds and randomized inputs", () => {
    for (const seed of [0, 1, 1401, 0xffffffff]) {
      for (const p of generateProblems({ seed })) validateProblemSemantics(p);
    }
  });
  it("has independently known answers for equality, empty inputs, duplicates and greedy traps", () => {
    const cases: [string, unknown, number | number[]][] = [
      ["supply-pairs", { weights: [2, 2, 2], budget: 4 }, 3],
      ["supply-pairs", { weights: [], budget: 0 }, 0],
      ["signal-burst", { readings: [4, -1, 6, 5], width: 2, threshold: 4 }, 2],
      ["signal-burst", { readings: [2, 2, 1], width: 3, threshold: 2 }, 2],
      ["reservoir-spans", { changes: [5, -3, 2], spans: [[0, 3], [1, 2], [2, 2]] }, [4, -3, 0]],
      ["reservoir-spans", { changes: [], spans: [] }, []],
      ["tide-marker", { marks: [1, 3, 3, 7], level: 3 }, 3],
      ["tide-marker", { marks: [2, 2], level: 2 }, -1],
      ["workshop-credits", { credits: [5, 9, 5] }, 10],
      ["workshop-credits", { credits: [] }, 0],
    ];
    for (const [id, input, output] of cases) {
      const t = TEMPLATES.find((t) => t.id === id)!;
      expect(t.evaluate(input, "brute")).toEqual(output);
      expect(t.evaluate(input, "optimal")).toEqual(output);
    }
  });
  it("rejects invalid options and prevents seed overflow or unknown versions", () => {
    for (const options of [{ seed: -1 }, { seed: 1.5 }, { seed: 0, count: 11 }, { seed: 0, count: 0 }, { seed: 0xffffffff, count: 2 }, { seed: 0, template: "missing" }]) {
      expect(() => generateProblems(options)).toThrow();
    }
    expect(() => generateProblem("supply-pairs", 0x100000000)).toThrow();
    expect(templateForSlug("gen-v2-supply-pairs-1")).toBeUndefined();
    expect(templateForSlug("gen-v1-supply-pairs-4294967296")).toBeUndefined();
    expect(templateForSlug("gen-v1-supply-pairs-01")).toBeUndefined();
    expect(() => referenceResult("gen-v1-untrusted-1", {})).toThrow(/No trusted/);
    expect(() => createRandom(1).int(9, 2)).toThrow();
  });
  it("bounds brute-force work and rejects malformed algorithm inputs", () => {
    for (const [id, input] of [
      ["workshop-credits", { credits: Array(15).fill(1) }],
      ["supply-pairs", { weights: [2, 1], budget: 4 }],
      ["signal-burst", { readings: [1], width: 2, threshold: 0 }],
      ["reservoir-spans", { changes: [1], spans: [[0, 2]] }],
      ["tide-marker", { marks: [2, 1], level: 0 }],
    ] as const) expect(() => referenceResult(`gen-v1-${id}-1`, input)).toThrow();
  });
  it("rejects corrupted expected values and aborts reference disagreements", () => {
    const p = generateProblem("workshop-credits", 1); p.testCases[0].output = 9;
    expect(() => validateProblemSemantics(p)).toThrow(/incorrect expected/);
    const t = { ...TEMPLATES[0], evaluate: (_input: unknown, strategy: "brute" | "optimal") => strategy === "brute" ? 1 : 2 };
    expect(() => checkedOutput(t, {})).toThrow(/disagreement/);
  });
  it("supports selected templates and consecutive seeds without duplicate slugs", () => {
    const problems = generateProblems({ seed: 12, count: 3, template: "tide-marker" });
    expect(problems.map((p) => p.slug)).toEqual([12, 13, 14].map((n) => `gen-v1-tide-marker-${n}`));
  });
  it("writes complete batches, refuses overwrite, detects drift and preserves edited files", async () => {
    const root = await temporary(), directory = join(root, "output");
    expect(await writeGeneratedFiles(directory, { seed: 1 })).toBe(5);
    expect(await writeGeneratedFiles(directory, { seed: 1 }, true)).toBe(5);
    const name = "gen-v1-supply-pairs-1.json";
    await writeFile(join(directory, name), "editor changes\n");
    await expect(writeGeneratedFiles(directory, { seed: 1 }, true)).rejects.toThrow(/differs/);
    await expect(writeGeneratedFiles(directory, { seed: 2 })).rejects.toThrow(/already exists/);
    expect(await readFile(join(directory, name), "utf8")).toBe("editor changes\n");
    await writeFile(join(directory, "extra.json"), "{}");
    await expect(writeGeneratedFiles(directory, { seed: 1 }, true)).rejects.toThrow(/file set differs/);
    expect(await readdir(root)).toEqual(["output"]);
  });
  it("leaves no output for invalid batches and only one concurrent writer succeeds", async () => {
    const root = await temporary(), directory = join(root, "output");
    await expect(writeGeneratedFiles(directory, { seed: -1 })).rejects.toThrow();
    expect(await readdir(root)).toEqual([]);
    const results = await Promise.allSettled([writeGeneratedFiles(directory, { seed: 2 }), writeGeneratedFiles(directory, { seed: 2 })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await writeGeneratedFiles(directory, { seed: 2 }, true)).toBe(5);
    expect(await readdir(root)).toEqual(["output"]);
  });
  it("the CLI rejects unexpected flags, fractional seeds and invalid counts without files", async () => {
    const root = await temporary();
    for (const args of [["--seed", "1.5"], ["--count", "0"], ["--publish"], ["--seed", ""], ["--template", "unknown"]]) {
      expect(() => execFileSync(process.execPath, ["--import", "tsx", "scripts/generate-problems.ts", "--out", join(root, "new"), ...args], { stdio: "pipe" })).toThrow();
    }
    expect(await readdir(root)).toEqual([]);
  });
});
```

### `tests/integration/generator.test.ts`

```ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/db/client";
import { generateProblems } from "../../scripts/generator/generate";
import { seedProblems } from "../../prisma/seed-data";

let db: ReturnType<typeof createDatabaseClient>;
let ownsFixtures = false;
const problems = generateProblems({ seed: 1401 });
const userId = randomUUID();
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Generator integration tests require an empty problem collection.");
  ownsFixtures = true;
});
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: userId } });
    await db.problem.deleteMany({ where: { slug: { in: problems.map((p) => p.slug) } } });
  }
  await db?.$disconnect();
});
describe("generated draft seed lifecycle", () => {
  it("seeds the five drafts with complete content and never publishes them automatically", async () => {
    expect(await seedProblems(db, problems)).toEqual({ created: 5, skipped: 0 });
    expect(await db.problem.count({ where: { status: "PUBLISHED" } })).toBe(0);
    expect(await db.problem.count({ where: { status: "DRAFT", publishedAt: null } })).toBe(5);
    expect(await db.problemHint.count()).toBe(25);
    expect(await db.problemSolution.count()).toBe(10);
  });
  it("reruns preserve identifiers and saved learner progress", async () => {
    const before = await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } });
    await db.user.create({ data: { id: userId } });
    await db.userProgress.create({ data: { userId, problemId: before[0].id, bookmarked: true } });
    expect(await seedProblems(db, problems)).toEqual({ created: 0, skipped: 5 });
    expect(await db.problem.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true, updatedAt: true } })).toEqual(before);
    expect(await db.userProgress.count({ where: { userId, bookmarked: true } })).toBe(1);
  });
  it("rejects corrupted outputs before writes and preserves subsequent editorial changes", async () => {
    const corrupt = structuredClone(problems); corrupt[0].testCases[0].output = 999;
    await expect(seedProblems(db, corrupt)).rejects.toThrow(/incorrect expected/);
    await db.problem.update({ where: { slug: problems[0].slug }, data: { title: "Reviewed editorial title", seedHash: null } });
    await expect(seedProblems(db, problems)).rejects.toThrow(/Seed conflict/);
    expect((await db.problem.findUniqueOrThrow({ where: { slug: problems[0].slug } })).title).toBe("Reviewed editorial title");
    expect(await db.userProgress.count({ where: { userId, bookmarked: true } })).toBe(1);
  });
});
```


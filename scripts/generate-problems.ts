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

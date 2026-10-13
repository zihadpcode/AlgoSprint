import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { buildPythonStarters, PYTHON_STARTERS_PATH, renderPythonStarters } from "./lib/python-starters";

async function main() {
  const { values } = parseArgs({ options: { check: { type: "boolean", default: false } }, strict: true, allowPositionals: false });
  const path = join(process.cwd(), PYTHON_STARTERS_PATH);
  const rendered = renderPythonStarters(buildPythonStarters());
  if (values.check) {
    const current = await readFile(path, "utf8").catch(() => "");
    if (current !== rendered) throw new Error(`${PYTHON_STARTERS_PATH} is out of date. Run npm run starters:python.`);
    console.log(`Verified ${PYTHON_STARTERS_PATH}.`);
    return;
  }
  await writeFile(path, rendered);
  console.log(`Wrote ${PYTHON_STARTERS_PATH}. Generation never writes to a database.`);
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Python starter generation failed.");
  process.exitCode = 1;
});

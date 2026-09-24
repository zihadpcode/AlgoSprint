import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { executeSandbox } from "../src/features/submissions/sandbox";
import { makeProgram, makeStdin } from "../src/features/submissions/harness";

// Vercel ships each function with only the files in its build trace, while local `next start` sees all of
// node_modules. The sandbox worker requires QuickJS from a source string that tracing cannot follow, so this check
// rebuilds the problem page's traced node_modules in an empty directory and runs a real submission from there.
// Run after `next build`.
async function main() {
  const root = process.cwd();
  const tracePath = path.join(root, ".next/server/app/problems/[slug]/page.js.nft.json");
  const traced = (JSON.parse(readFileSync(tracePath, "utf8")) as { files: string[] }).files
    .map((file) => path.relative(root, path.resolve(path.dirname(tracePath), file)))
    .filter((file) => file.startsWith("node_modules/"));
  for (const name of ["quickjs-emscripten-core", "@jitl/quickjs-singlefile-cjs-release-sync", "@jitl/quickjs-ffi-types"]) {
    assert.ok(traced.includes(`node_modules/${name}/package.json`), `The problem page trace does not include ${name}; check outputFileTracingIncludes in next.config.ts.`);
  }
  const bundle = mkdtempSync(path.join(tmpdir(), "algosprint-trace-"));
  try {
    for (const file of traced) cpSync(path.join(root, file), path.join(bundle, file));
    // The worker resolves its requires from the working directory, which is the function root on Vercel.
    process.chdir(bundle);
    const program = makeProgram("relay-window", "relayWindow", "function relayWindow(loads, width) { let best = -Infinity; for (let s = 0; s + width <= loads.length; s++) { let t = 0; for (let i = s; i < s + width; i++) t += loads[i]; best = Math.max(best, t); } return best; }");
    const [outcome] = await executeSandbox(program, [{ stdin: makeStdin("relay-window", { loads: [4, 5, 1], width: 2 }), expected: 9 }], { timeMs: 2000, memoryKb: 262144 });
    assert.equal(outcome.status, "ACCEPTED", `The sandbox could not run from the traced files: ${outcome.status} ${outcome.diagnostic}`);
    console.log(`Sandbox ran a submission from the problem page's ${traced.length} traced node_modules files.`);
  } finally {
    process.chdir(root);
    rmSync(bundle, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Sandbox trace check failed.");
  process.exitCode = 1;
});

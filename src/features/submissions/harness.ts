import "server-only";

// Explicit argument order: PostgreSQL JSONB object key order is not a function signature.
const signatures: Record<string, { entryPoint: string; keys: string[] }> = {
  "relay-window": { entryPoint: "relayWindow", keys: ["loads", "width"] },
  "quiet-badge": { entryPoint: "quietBadge", keys: ["badges"] },
  "parcel-checkpoints": { entryPoint: "parcelCheckpoints", keys: ["parcels", "ranges"] },
  "dock-threshold": { entryPoint: "dockThreshold", keys: ["capacities", "load"] },
  "lantern-steps": { entryPoint: "lanternSteps", keys: ["costs"] },
};
export function runnerSupports(slug: string) { return Object.hasOwn(signatures, slug); }
export function makeProgram(slug: string, entryPoint: string, code: string) {
  const signature = Object.hasOwn(signatures, slug) ? signatures[slug] : undefined;
  if (!signature || signature.entryPoint !== entryPoint) throw new Error("Unsupported runner signature");
  // This is text sent to Judge0. Never evaluate it inside Next.js, Node vm, or a local child process.
  return `const __asArgs = JSON.parse(require("fs").readFileSync(0, "utf8"));
const __asWrite = process.stdout.write.bind(process.stdout);
const __asJSON = JSON.stringify.bind(JSON);
console.log = (...args) => process.stderr.write(args.map(String).join(" ") + "\\n");
const __asSolve = (() => {
${code}
;return ${signature.entryPoint};
})();
Promise.resolve(__asSolve(...__asArgs)).then(value => {
  const json = __asJSON(value);
  if (json === undefined) throw new Error("Return a JSON value from your function.");
  __asWrite(json);
}).catch(error => { console.error(error); process.exitCode = 1; });
`;
}
export function makeStdin(slug: string, input: unknown) {
  const signature = Object.hasOwn(signatures, slug) ? signatures[slug] : undefined;
  if (!signature || !input || typeof input !== "object" || Array.isArray(input)) throw new Error("Unsupported test input");
  const record = input as Record<string, unknown>;
  if (signature.keys.some((key) => !Object.hasOwn(record, key))) throw new Error("Missing test argument");
  const result = JSON.stringify(signature.keys.map((key) => record[key]));
  if (Buffer.byteLength(result) > 64_000) throw new Error("Test input exceeds MVP limit");
  return result;
}

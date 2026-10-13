import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadProblems } from "../scripts/lib/load-problems";
import { buildPythonStarters, PYTHON_STARTERS_PATH, pythonStub, renderPythonStarters, validatePythonStarters } from "../scripts/lib/python-starters";
import { SIGNATURES } from "@/features/submissions/signatures";

const read = async () => JSON.parse(await readFile(join(process.cwd(), PYTHON_STARTERS_PATH), "utf8")) as ReturnType<typeof buildPythonStarters>;
const slugs = async () => new Set((await loadProblems()).map((p) => p.slug));

it("generates one short stub per signature, in snake_case, and the checked-in file is up to date", async () => {
  const built = buildPythonStarters();
  expect(built.map((e) => e.slug).sort()).toEqual(Object.keys(SIGNATURES).sort());
  expect(built.find((e) => e.slug === "relay-window")).toEqual({ slug: "relay-window", language: "PYTHON", entryPoint: "relay_window",
    code: "def relay_window(loads, width):\n    # Write your solution here.\n    pass" });
  expect(built.find((e) => e.slug === "drop-nth-car")?.code.startsWith("def drop_nth_car(next, head, k):")).toBe(true);
  expect(await readFile(join(process.cwd(), PYTHON_STARTERS_PATH), "utf8")).toBe(renderPythonStarters(built));
});
it("validates against the signatures and the existing problems", async () => {
  expect(validatePythonStarters(await read(), await slugs())).toHaveLength(Object.keys(SIGNATURES).length);
});
it("rejects missing, unknown, duplicate, keyword and drifted entries", async () => {
  const entries = await read(); const known = await slugs();
  expect(() => validatePythonStarters(entries.slice(1), known)).toThrow("Missing Python starter");
  expect(() => validatePythonStarters([...entries, { ...entries[0], slug: "no-such-problem" }], known)).toThrow("no matching problem");
  expect(() => validatePythonStarters(entries, new Set([...known].filter((s) => s !== entries[0].slug)))).toThrow("no matching problem");
  expect(() => validatePythonStarters([...entries, entries[0]], known)).toThrow("Duplicate starter");
  expect(() => validatePythonStarters([{ ...entries[0], entryPoint: "class" }, ...entries.slice(1)], known)).toThrow("valid Python identifier");
  expect(() => validatePythonStarters([{ ...entries[0], entryPoint: "relayWindow" }, ...entries.slice(1)], known)).toThrow("entry point must be relay_window");
  expect(() => validatePythonStarters([{ ...entries[0], code: "def relay_window(loads):\n    pass" }, ...entries.slice(1)], known)).toThrow("differs from the generated stub");
  expect(() => validatePythonStarters([{ ...entries[0], language: "JAVASCRIPT" }, ...entries.slice(1)], known)).toThrow();
  expect(() => validatePythonStarters([{ ...entries[0], extra: 1 }, ...entries.slice(1)], known)).toThrow();
});
it("refuses signatures whose parameters are not usable Python names", () => {
  // A keyword parameter would produce an unparseable stub; the generator output is then rejected by validation.
  expect(pythonStub("f", ["from", "x"])).toContain("def f(from, x)");
  const keyword = { "bad-one": { entryPoint: "badOne", keys: ["from", "x"] } };
  expect(() => validatePythonStarters(buildPythonStarters(keyword), new Set(["bad-one"]), keyword)).toThrow('"from" is not a usable Python parameter name');
  const collide = { "bad-two": { entryPoint: "badTwo", keys: ["newSlot", "new_slot"] } };
  expect(() => validatePythonStarters(buildPythonStarters(collide), new Set(["bad-two"]), collide)).toThrow("collide");
});

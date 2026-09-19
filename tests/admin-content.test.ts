import { expect, it } from "vitest";
import { adminCommand, parseAdminJson, parseAdminProblems } from "@/features/admin/contracts";
import { fromForm, toForm, problemFields, roadmapFields } from "@/features/admin/form-model";
import { loadProblems } from "../scripts/lib/load-problems";
import { ROADMAPS } from "@/data/seeds/roadmaps";
it("round-trips the full original content through structured fields", async () => {
  for (const problem of await loadProblems()) expect(fromForm(toForm(problem, problemFields), problemFields)).toEqual(problem);
  for (const roadmap of ROADMAPS) expect(fromForm(toForm(roadmap, roadmapFields), roadmapFields)).toEqual(roadmap);
});
it("reindexes reordered cases and reports the exact JSON field without executing code", async () => {
  const problem = (await loadProblems())[0]; const form = toForm(problem, problemFields);
  const examples = form.examples as Record<string, unknown>[]; form.examples = [...examples].reverse();
  const output = fromForm(form, problemFields); expect((output.examples as { position: number }[]).map((e) => e.position)).toEqual([1, 2]);
  examples[0].input = "function evil() {}"; form.examples = examples;
  expect(() => fromForm(form, problemFields)).toThrow("Invalid JSON at examples.1.input");
});
it("rejects oversized/deep/null JSON, duplicate imports and untrusted command fields", async () => {
  expect(() => parseAdminJson(JSON.stringify("x".repeat(400001)))).toThrow(/400 KB/);
  expect(() => parseAdminJson('"\\u0000"')).toThrow(/null characters/);
  expect(() => parseAdminJson('['.repeat(26)+'0'+']'.repeat(26))).toThrow(/deeply/);
  const p = (await loadProblems())[0]; expect(() => parseAdminProblems(JSON.stringify([p, p]), true)).toThrow(/unique/);
  expect(() => parseAdminProblems(JSON.stringify(Array(11).fill(p)), true)).toThrow();
  expect(adminCommand.safeParse({ operation: "delete", slug: p.slug, revision: 1, confirmation: p.slug, userId: "forged" }).success).toBe(false);
});

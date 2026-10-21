import { expect, it } from "vitest";
import { selectStarters } from "../prisma/seed-language-starters";
import type { PythonStarter } from "../scripts/lib/python-starters";

const entry = (slug: string): PythonStarter => ({ slug, language: "PYTHON", entryPoint: slug.replace(/-/g, "_"), code: `def ${slug.replace(/-/g, "_")}():\n    pass` });
const all = [entry("alpha-one"), entry("beta-two"), entry("gamma-three")];

it("returns everything when no slug is given", () => { expect(selectStarters(all, [])).toEqual(all); });
it("narrows to the named slugs, keeping file order", () => {
  expect(selectStarters(all, ["gamma-three", "alpha-one"]).map((e) => e.slug)).toEqual(["alpha-one", "gamma-three"]);
});
it("rejects unknown slugs instead of silently seeding nothing", () => {
  expect(() => selectStarters(all, ["alpha-one", "alpha-oen"])).toThrow("No Python starter for: alpha-oen");
});

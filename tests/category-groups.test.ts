import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_GROUPS } from "@/data/seeds/taxonomy";
import { validateCategoryGroups } from "@/lib/validators/category-groups";

const leaves = [["a", "A"], ["b", "B"], ["c", "C"]] as const;
const group = (over: Record<string, unknown> = {}) => ({ slug: "g", name: "G", position: 1, children: ["a"], ...over });

describe("category group seed data", () => {
  it("is valid and places every current leaf in exactly one group", () => {
    const groups = validateCategoryGroups(CATEGORY_GROUPS, CATEGORIES);
    expect(groups.map((g) => g.slug)).toEqual(["data-structures", "algorithms", "design-and-systems", "databases"]);
    expect(groups.flatMap((g) => g.children).sort()).toEqual(CATEGORIES.map(([slug]) => slug).sort());
  });
  it("does not change any existing leaf slug or name", () => {
    expect(CATEGORIES).toHaveLength(30);
    expect(CATEGORIES.find(([slug]) => slug === "heaps")).toEqual(["heaps", "Heaps / Priority Queues"]);
    expect(CATEGORIES.find(([slug]) => slug === "object-oriented")).toEqual(["object-oriented", "Object-Oriented Programming Interview Problems"]);
  });
  it("rejects structural mistakes before anything can be written", () => {
    expect(() => validateCategoryGroups([group({ children: ["missing"] })], leaves)).toThrow(/unknown leaf/);
    expect(() => validateCategoryGroups([group({ children: ["a", "b"] }), group({ slug: "h", name: "H", children: ["b"] })], leaves)).toThrow(/two groups/);
    expect(() => validateCategoryGroups([group({ children: ["a", "a"] })], leaves)).toThrow(/twice/);
    expect(() => validateCategoryGroups([group({ slug: "a" })], leaves)).toThrow(/collides with a leaf/);
    expect(() => validateCategoryGroups([group({ name: "a" })], leaves)).toThrow(/leaf category name/);
    expect(() => validateCategoryGroups([group(), group({ name: "Other" })], leaves)).toThrow(/Duplicate category group slug/);
    expect(() => validateCategoryGroups([group(), group({ slug: "h", name: "g" })], leaves)).toThrow(/Duplicate category group name/);
    expect(() => validateCategoryGroups([group({ slug: "Bad Slug" })], leaves)).toThrow();
    expect(() => validateCategoryGroups([group({ children: [] })], leaves)).toThrow();
    expect(() => validateCategoryGroups([group({ extra: 1 })], leaves)).toThrow();
  });
});

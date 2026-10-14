import { describe, expect, it } from "vitest";
import { buildCategoryTree, type PublishedCategoryRow } from "@/features/problems/category-tree";

const group = (slug: string, name: string, position: number) => ({ slug, name, position });
const ds = group("data-structures", "Data Structures", 1);
const alg = group("algorithms", "Algorithms", 2);
const leaf = (slug: string, name: string, position: number, parent: PublishedCategoryRow["parent"]): PublishedCategoryRow => ({ slug, name, position, parent });

describe("category facet tree", () => {
  it("returns null when no published category has a parent, so the UI renders the flat list", () => {
    expect(buildCategoryTree([])).toBeNull();
    expect(buildCategoryTree([leaf("arrays", "Arrays", 0, null), leaf("sql", "SQL Problems", 0, null)])).toBeNull();
  });
  it("groups children by group position, then child position, then name", () => {
    const tree = buildCategoryTree([
      leaf("two-pointers", "Two Pointers", 0, alg), leaf("strings", "Strings", 1, ds),
      leaf("arrays", "Arrays", 0, ds), leaf("bfs", "BFS", 0, alg),
    ]);
    expect(tree).toEqual({
      groups: [
        { slug: "data-structures", name: "Data Structures", children: [{ slug: "arrays", name: "Arrays" }, { slug: "strings", name: "Strings" }] },
        { slug: "algorithms", name: "Algorithms", children: [{ slug: "bfs", name: "BFS" }, { slug: "two-pointers", name: "Two Pointers" }] },
      ],
      ungrouped: [],
    });
  });
  it("never invents empty groups or children: only parents of published categories appear", () => {
    // The caller supplies only categories with a published problem; databases has none, so it cannot appear.
    const tree = buildCategoryTree([leaf("arrays", "Arrays", 0, ds)]);
    expect(tree?.groups.map((g) => g.slug)).toEqual(["data-structures"]);
    expect(tree?.groups[0].children.map((c) => c.slug)).toEqual(["arrays"]);
  });
  it("keeps published categories that have no group selectable while others are grouped", () => {
    const tree = buildCategoryTree([leaf("arrays", "Arrays", 0, ds), leaf("zeta", "Zeta", 0, null), leaf("alpha", "Alpha", 0, null)]);
    expect(tree?.ungrouped).toEqual([{ slug: "alpha", name: "Alpha" }, { slug: "zeta", name: "Zeta" }]);
  });
  it("does not list a group row that has its own problems as an ungrouped category", () => {
    const tree = buildCategoryTree([leaf("arrays", "Arrays", 0, ds), leaf("data-structures", "Data Structures", 1, null)]);
    expect(tree?.ungrouped).toEqual([]);
  });
});

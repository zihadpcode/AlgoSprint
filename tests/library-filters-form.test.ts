// @vitest-environment happy-dom
import { act, createElement, forwardRef, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// next/form needs the app router; a plain GET form is what it renders without JavaScript.
vi.mock("next/form", () => ({
  default: forwardRef<HTMLFormElement, ComponentProps<"form"> & { replace?: boolean; scroll?: boolean; prefetch?: boolean }>(
    function Form(props, ref) {
      const { replace, scroll, prefetch, ...rest } = props;
      void [replace, scroll, prefetch];
      return createElement("form", { method: "get", ...rest, ref });
    }),
}));
import { LibraryFiltersForm } from "@/components/problems/library-filters";
import { parseLibraryFilters } from "@/features/problems/filters";
import { buildCategoryTree } from "@/features/problems/category-tree";

const ds = { slug: "data-structures", name: "Data Structures", position: 1 };
const alg = { slug: "algorithms", name: "Algorithms", position: 2 };
const published = [
  { slug: "arrays", name: "Arrays", position: 0, parent: ds }, { slug: "trees", name: "Trees", position: 1, parent: ds },
  { slug: "bfs", name: "BFS", position: 0, parent: alg },
];
const flat = { categories: [{ slug: "arrays", name: "Arrays" }, { slug: "sql", name: "SQL Problems" }], categoryTree: null, tags: [], patterns: [] };
const grouped = { categories: published.map(({ slug, name }) => ({ slug, name })), categoryTree: buildCategoryTree(published), tags: [], patterns: [] };

let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const render = (facets: typeof flat | typeof grouped, params: Record<string, string> = {}) =>
  act(() => root.render(createElement(LibraryFiltersForm, { filters: parseLibraryFilters(params), facets, signedIn: false })));
const category = () => host.querySelector<HTMLSelectElement>('select[name="category"]')!;

it("renders exactly the old flat list when nothing is grouped", async () => {
  await render(flat);
  expect(category().querySelectorAll("optgroup")).toHaveLength(0);
  expect([...category().options].map((o) => [o.value, o.textContent])).toEqual([["", "All"], ["arrays", "Arrays"], ["sql", "SQL Problems"]]);
});
it("renders one optgroup per group with an All option, then the leaves in order", async () => {
  await render(grouped);
  const groups = [...category().querySelectorAll("optgroup")];
  expect(groups.map((g) => g.label)).toEqual(["Data Structures", "Algorithms"]);
  expect([...groups[0].querySelectorAll("option")].map((o) => [o.value, o.textContent])).toEqual([
    ["group:data-structures", "All Data Structures"], ["arrays", "Arrays"], ["trees", "Trees"],
  ]);
  expect([...groups[1].querySelectorAll("option")].map((o) => o.value)).toEqual(["group:algorithms", "bfs"]);
});
it("keeps an accessible label and submits through a plain GET form to /problems", async () => {
  await render(grouped);
  const form = host.querySelector("form")!;
  expect(form.getAttribute("action")).toBe("/problems");
  expect(form.getAttribute("method")).toBe("get");
  expect(form.getAttribute("aria-label")).toBe("Filter problems");
  expect(category().closest("label")?.textContent).toContain("Category");
  expect(host.querySelectorAll('select[name="group"]')).toHaveLength(0);
});
it("preselects a leaf or a whole group from the current URL", async () => {
  await render(grouped, { category: "trees" });
  expect(category().value).toBe("trees");
  await render(grouped, { group: "algorithms" });
  expect(category().value).toBe("group:algorithms");
});
it("keeps a selected group or leaf that has no published matches visible instead of silently resetting", async () => {
  await render(grouped, { group: "databases" });
  expect(category().value).toBe("group:databases");
  expect(category().selectedOptions[0].textContent).toBe("databases (no published matches)");
  await render(flat, { group: "databases" });
  expect(category().selectedOptions[0].textContent).toBe("databases (no published matches)");
});

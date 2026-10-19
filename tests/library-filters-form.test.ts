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
const render = (facets: typeof flat | typeof grouped, params: Record<string, string | string[]> = {}) =>
  act(() => root.render(createElement(LibraryFiltersForm, { filters: parseLibraryFilters(params), facets, signedIn: false })));
const topics = () => [...host.querySelectorAll<HTMLInputElement>('input[name="category"]')];
const checked = (name: string) => [...host.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((input) => input.value);
const labelOf = (input: HTMLInputElement) => input.closest("label")?.textContent;

it("renders exactly the old flat list of topics when nothing is grouped", async () => {
  await render(flat);
  expect(host.querySelectorAll('[role="group"]')).toHaveLength(0);
  expect(topics().map((input) => [input.value, labelOf(input)])).toEqual([["arrays", "Arrays"], ["sql", "SQL Problems"]]);
});
it("renders one labelled group per category group with its leaves in order", async () => {
  await render(grouped);
  const groups = [...host.querySelectorAll('[role="group"]')];
  expect(groups.map((g) => g.getAttribute("aria-label"))).toEqual(["Data Structures", "Algorithms"]);
  expect([...groups[0].querySelectorAll("input")].map((o) => [o.value, labelOf(o)])).toEqual([["arrays", "Arrays"], ["trees", "Trees"]]);
  expect([...groups[1].querySelectorAll("input")].map((o) => o.value)).toEqual(["bfs"]);
});
it("keeps an accessible label and submits through a plain GET form to /problems", async () => {
  await render(grouped);
  const form = host.querySelector("form")!;
  expect(form.getAttribute("action")).toBe("/problems");
  expect(form.getAttribute("method")).toBe("get");
  expect(form.getAttribute("aria-label")).toBe("Filter problems");
  expect(host.querySelector("#library-q")?.getAttribute("name")).toBe("q");
  expect(host.querySelector('label[for="library-q"]')?.textContent).toBe("Search problems by title");
  expect(host.querySelector("button[type=submit]")?.textContent).toBe("Apply");
  expect(host.querySelectorAll('select[name="group"]')).toHaveLength(0);
});
it("preselects several difficulties and topics from the current URL", async () => {
  await render(grouped, { difficulty: ["EASY", "HARD"], category: ["trees", "bfs"] });
  expect(checked("difficulty")).toEqual(["EASY", "HARD"]);
  expect(checked("category")).toEqual(["trees", "bfs"]);
  expect([...host.querySelectorAll("summary")].map((summary) => summary.textContent)).toEqual(["Difficulty2", "Topics2", "More"]);
});
it("keeps a whole group selected from the URL as a hidden category value that still submits", async () => {
  await render(grouped, { group: "algorithms" });
  const hidden = host.querySelector<HTMLInputElement>('input[type="hidden"][name="category"]');
  expect(hidden?.value).toBe("group:algorithms");
  expect(checked("category")).toEqual([]);
});
it("keeps a selected topic that has no published matches visible instead of silently resetting", async () => {
  await render(grouped, { category: "databases" });
  expect(checked("category")).toEqual(["databases"]);
  expect(topics().find((input) => input.value === "databases")?.closest("label")?.textContent).toBe("databases (no published matches)");
  await render(flat, { category: "databases" });
  expect(checked("category")).toEqual(["databases"]);
});
it("asks guests to sign in for status filters instead of offering a disabled menu", async () => {
  await render(flat, { category: "arrays" });
  expect(host.querySelectorAll('input[name="completion"], input[name="review"]')).toHaveLength(0);
  const link = [...host.querySelectorAll("a")].find((anchor) => anchor.textContent?.startsWith("Status"));
  expect(link?.getAttribute("href")).toBe("/login?next=" + encodeURIComponent("/problems?category=arrays"));
});
it("offers status filters to signed in viewers, preselected from the URL", async () => {
  await act(() => root.render(createElement(LibraryFiltersForm, { filters: parseLibraryFilters({ completion: ["SOLVED", "ATTEMPTED"], review: "1" }), facets: flat, signedIn: true })));
  expect(checked("completion")).toEqual(["ATTEMPTED", "SOLVED"]);
  expect(checked("review")).toEqual(["1"]);
});

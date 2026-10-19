import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/features/problems/detail-actions", () => ({ updateProblem: vi.fn() }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: unknown }) => createElement("div", null, children as never) }));
import { SavedCollectionPage } from "@/components/saved/saved-collection";
import type { SavedCollection } from "@/features/saved/query";

const progress = { status: "ATTEMPTED" as const, selfMarked: false, reviewLater: true, verification: null };
const collection = (changes: Partial<SavedCollection> = {}): SavedCollection => ({ total: 1, pages: 1, page: 1, q: "", items: [
  { slug: "relay-window", title: "Relay <b>Window</b>", difficulty: "HARD", progress, bookmarked: true, note: "my <i>note</i>" }], ...changes });
const render = (kind: "notes" | "bookmarks" | "review", c = collection()) => renderToStaticMarkup(createElement(SavedCollectionPage, { kind, admin: false, collection: c }));

it("lists saved problems as a semantic list with search, tabs, escaped titles and flags", () => {
  const html = render("bookmarks");
  for (const text of ['aria-label="Saved practice collections"', 'aria-current="page"', 'role="search"', 'name="q"', "Relay &lt;b&gt;Window&lt;/b&gt;", "Hard", "Attempted", "Remove bookmark", "Remove from review", "1 saved problem"]) expect(html).toContain(text);
  expect(html).not.toContain("<b>Window"); expect(html).not.toContain("Edit note");
});
it("shows an editable, escaped note preview only on the notes tab", () => {
  const html = render("notes");
  expect(html).toContain("my &lt;i&gt;note&lt;/i&gt;"); expect(html).toContain("Edit note"); expect(html).toContain("Save note");
});
it("explains empty collections and empty searches", () => {
  expect(render("review", collection({ total: 0, items: [] }))).toContain("Nothing saved here yet");
  const searched = render("notes", collection({ total: 0, items: [], q: "zzz" }));
  expect(searched).toContain("No matching saved problems"); expect(searched).toContain("Clear search");
});

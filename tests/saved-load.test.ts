import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ requireViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/saved/query", () => ({ querySaved: f.query }));
import { loadSaved } from "@/features/saved/load";
import { parseSavedFilters, savedHref } from "@/features/saved/filters";
import { safeReturnTo } from "@/features/auth/validation";
beforeEach(() => { vi.resetAllMocks(); f.viewer.mockResolvedValue({ id: "owner", role: "ADMIN" }); f.db.mockReturnValue("db"); f.query.mockResolvedValue({ items: [] }); });
it("normalizes bounded search and rejects array, negative, decimal and oversized pages", () => {
  for (const page of [["2"], "-1", "0", "1.5", "9999999", "NaN"]) expect(parseSavedFilters({ page }).page).toBe(1);
  expect(parseSavedFilters({ q: " x\u0000 ", page: "2" })).toEqual({ q: "x", page: 2 });
  expect(parseSavedFilters({ q: "x".repeat(101) }).q).toHaveLength(100);
});
it("keeps all saved destinations local and preserves valid return/search URLs", () => {
  for (const kind of ["notes", "bookmarks", "review"] as const) {
    const url = savedHref(kind, { q: "a & b", page: 2 });
    expect(safeReturnTo(url)).toBe(url);
  }
  expect(safeReturnTo("/progress")).toBe("/progress");
  expect(safeReturnTo("//evil.test/bookmarks")).toBe("/dashboard");
});
it("uses only the authenticated owner's data even for admins and ignores supplied IDs", async () => {
  expect(await loadSaved("bookmarks", { userId: "other", q: "Relay", page: "2" })).toEqual({ admin: true, collection: { items: [] } });
  expect(f.viewer).toHaveBeenCalledWith("/bookmarks?q=Relay&page=2");
  expect(f.query).toHaveBeenCalledWith("db", "owner", "bookmarks", { q: "Relay", page: 2 });
});
it("never touches the database after a guest redirect or identity failure", async () => {
  f.viewer.mockRejectedValue(new Error("redirect"));
  await expect(loadSaved("notes", {})).rejects.toThrow(); expect(f.db).not.toHaveBeenCalled(); expect(f.query).not.toHaveBeenCalled();
});

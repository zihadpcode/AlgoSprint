import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isMissingCategoryColumn, libraryWhere, orderBy, queryLibrary } from "@/features/problems/query";
import { parseLibraryFilters } from "@/features/problems/filters";

// Shape recorded from Prisma 7 when Category.parentId does not exist (migration not applied).
const missingColumn = Object.assign(new Error("column Category.parentId does not exist"), { code: "P2022", meta: { modelName: "Category" } });
const categorySelects: unknown[] = [];
function fakeDb(failFirst: unknown) {
  let calls = 0;
  const run = async (callback: (tx: unknown) => unknown) => {
    if (calls++ === 0 && failFirst) throw failFirst;
    return callback({
      problem: { count: async () => 0, findMany: async () => [] },
      userProgress: { findMany: async () => [] },
      category: { findMany: async (args: { select: unknown }) => { categorySelects.push(args.select); return [{ slug: "arrays", name: "Arrays" }]; } },
      tag: { findMany: async () => [] },
    });
  };
  return { db: { $transaction: run } as never, calls: () => calls };
}
beforeEach(() => { categorySelects.length = 0; });

it("recognises only a missing Category column", () => {
  expect(isMissingCategoryColumn(missingColumn)).toBe(true);
  // The group filter's join fails on a Problem query (recorded from Prisma 7 against a database without the migration).
  const joined = { code: "P2022", meta: { modelName: "Problem", driverAdapterError: { cause: { column: "j1.parentId" } } } };
  expect(isMissingCategoryColumn(joined)).toBe(true);
  expect(isMissingCategoryColumn({ code: "P2022", meta: { modelName: "Problem" } })).toBe(false);
  expect(isMissingCategoryColumn({ code: "P2022", meta: { modelName: "Problem", driverAdapterError: { cause: { column: "ProblemHint.position" } } } })).toBe(false);
  expect(isMissingCategoryColumn({ code: "P2002", meta: { modelName: "Category" } })).toBe(false);
  expect(isMissingCategoryColumn(new Error("boom"))).toBe(false);
  expect(isMissingCategoryColumn(null)).toBe(false);
});
it("serves the flat library when the hierarchy columns are missing, without querying them again", async () => {
  const { db, calls } = fakeDb(missingColumn);
  const result = await queryLibrary(db, parseLibraryFilters({ category: "arrays" }), null);
  expect(calls()).toBe(2);
  expect(result.facets.categoryTree).toBeNull();
  expect(result.facets.categories).toEqual([{ slug: "arrays", name: "Arrays" }]);
  expect(categorySelects).toEqual([{ slug: true, name: true }]);
});
it("uses the hierarchy when the columns exist", async () => {
  const { db, calls } = fakeDb(null);
  await queryLibrary(db, parseLibraryFilters({}), null);
  expect(calls()).toBe(1);
  expect(categorySelects[0]).toMatchObject({ parent: { select: { slug: true, name: true, position: true } } });
});
it("never swallows other database failures", async () => {
  await expect(queryLibrary(fakeDb(new Error("connection lost")).db, parseLibraryFilters({}), null)).rejects.toThrow("connection lost");
});
it("matches no problems for a group filter when the hierarchy is unavailable", () => {
  const filters = parseLibraryFilters({ group: "algorithms" });
  expect(JSON.stringify(libraryWhere(filters, null, false))).toContain('"slug":""');
  expect(JSON.stringify(libraryWhere(filters, null, true))).toContain('"parent":{"slug":{"in":["algorithms"]}}');
});
it("builds an IN filter for several difficulties and categories, and ORs several statuses for the verified viewer", () => {
  const where = JSON.stringify(libraryWhere(parseLibraryFilters({ difficulty: ["EASY", "HARD"], category: ["arrays", "trees"], completion: ["NOT_STARTED", "SOLVED"] }), "viewer-1"));
  expect(where).toContain('"difficulty":{"in":["EASY","HARD"]}');
  expect(where).toContain('"slug":{"in":["arrays","trees"]}');
  expect(where).toContain('"OR":[{"progress":{"none":{"userId":"viewer-1","status":{"in":["ATTEMPTED","SOLVED"]}}}},{"progress":{"some":{"userId":"viewer-1","status":{"in":["SOLVED"]}}}}]');
  expect(() => libraryWhere(parseLibraryFilters({ completion: ["SOLVED"] }), null)).toThrow("Verified viewer");
});
it("orders by the validated sort and direction with a stable ascending slug tie-breaker", () => {
  expect(orderBy("title", "asc")).toEqual([{ title: "asc" }, { slug: "asc" }]);
  expect(orderBy("title", "desc")).toEqual([{ title: "desc" }, { slug: "asc" }]);
  expect(orderBy("difficulty", "desc")).toEqual([{ difficulty: "desc" }, { slug: "asc" }]);
  expect(orderBy("time", "asc")).toEqual([{ estimatedMinutes: "asc" }, { slug: "asc" }]);
  expect(orderBy("newest", "desc")).toEqual([{ publishedAt: { sort: "desc", nulls: "last" } }, { slug: "asc" }]);
});

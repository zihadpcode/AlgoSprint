import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { queryLibrary } from "@/features/problems/query";
import { parseLibraryFilters } from "@/features/problems/filters";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { seedCategoryGroups } from "../../prisma/seed-categories";
import { CATEGORY_GROUPS } from "@/data/seeds/taxonomy";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let seeds: ProblemSeed[] = [];
let ownsFixtures = false;
const users = [randomUUID(), randomUUID()];
const privateSlug = "qa-private-" + randomUUID();
const extraSlugs = ["qa-draft", "qa-archived", ...Array.from({ length: 14 }, (_, index) => "qa-page-" + String(index).padStart(2, "0"))];
const filters = parseLibraryFilters;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Library integration tests require an empty problem collection.");
  seeds = await loadProblems();
  ownsFixtures = true;
  await seedProblems(db, seeds);
  await db.user.createMany({ data: users.map((id) => ({ id })) });
  await db.category.create({ data: { slug: privateSlug, name: privateSlug } });
  await db.tag.create({ data: { slug: privateSlug, name: privateSlug } });
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    await db.problem.create({ data: {
      slug: "qa-" + status.toLowerCase(), title: "Private unpublished sentinel", difficulty: "HARD",
      status, pattern: privateSlug, statement: "Private statement sentinel", constraints: ["Only a fixture"],
      estimatedMinutes: 1,
      categories: { create: { category: { connect: { slug: privateSlug } } } },
      tags: { create: { tag: { connect: { slug: privateSlug } } } },
    } });
  }
}, 30_000);
afterAll(async () => {
  if (db && ownsFixtures) {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.problem.deleteMany({ where: { slug: { in: [...seeds.map((seed) => seed.slug), ...extraSlugs] } } });
    await db.category.deleteMany({ where: { slug: privateSlug } });
    await db.tag.deleteMany({ where: { slug: privateSlug } });
  }
  await db?.$disconnect();
});

describe("published library against PostgreSQL", () => {
  it("excludes draft/archive data and private-only facets from every public DTO", async () => {
    const result = await queryLibrary(db, filters({ status: "DRAFT" }), null);
    expect(result.total).toBe(seeds.length);
    expect(result.facets.categories.some((entry) => entry.slug === privateSlug)).toBe(false);
    expect(result.facets.tags.some((entry) => entry.slug === privateSlug)).toBe(false);
    expect(result.facets.patterns).not.toContain(privateSlug);
    expect(JSON.stringify(result)).not.toContain("sentinel");
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual(["slug", "title", "difficulty", "pattern", "estimatedMinutes", "categories", "tags", "progress"].sort());
      expect(item.progress).toBeNull();
    }
  });
  it("combines case-insensitive title, taxonomy, pattern, difficulty and time filters", async () => {
    const seed = seeds[0];
    const result = await queryLibrary(db, filters({
      q: seed.title.toUpperCase(), category: seed.categories[0], tag: seed.tags[0],
      pattern: seed.pattern, difficulty: seed.difficulty, maxMinutes: String(seed.estimatedMinutes),
    }), null);
    expect(result.items.map((item) => item.slug)).toEqual([seed.slug]);
    expect((await queryLibrary(db, filters({ q: seed.title, category: "not-a-category" }), null)).total).toBe(0);
    for (const q of ["%", "_", "\\"]) expect((await queryLibrary(db, filters({ q }), null)).total).toBe(0);
  });
  it("returns consistent ordering and keeps personal progress isolated by verified owner", async () => {
    const first = await db.problem.findUniqueOrThrow({ where: { slug: seeds[0].slug } });
    await db.userProgress.create({ data: { userId: users[0], problemId: first.id, status: "SOLVED", solvedAt: new Date(), reviewLater: true, selfMarked: true } });
    await db.userProgress.create({ data: { userId: users[1], problemId: first.id, status: "ATTEMPTED" } });
    const solved = await queryLibrary(db, filters({ completion: "SOLVED", review: "1" }), users[0]);
    expect(solved.items.map((item) => item.slug)).toEqual([first.slug]);
    expect(solved.items[0].progress).toEqual({ status: "SOLVED", reviewLater: true, selfMarked: true, verification: null });
    expect((await queryLibrary(db, filters({ completion: "SOLVED" }), users[1])).total).toBe(0);
    expect((await queryLibrary(db, filters({ review: "1" }), users[1])).total).toBe(0);
    expect((await queryLibrary(db, filters({ completion: "NOT_STARTED" }), users[1])).total).toBe(seeds.length - 1);
    expect((await queryLibrary(db, filters({ completion: "ATTEMPTED" }), users[1])).total).toBe(1);
    await expect(queryLibrary(db, filters({ completion: "SOLVED" }), null)).rejects.toThrow("Verified viewer");
    const shortest = await queryLibrary(db, filters({ sort: "time" }), null);
    expect(shortest.items.map((item) => item.estimatedMinutes)).toEqual([...shortest.items.map((item) => item.estimatedMinutes)].sort((a, b) => a - b));
    const difficulty = await queryLibrary(db, filters({ sort: "difficulty" }), null);
    const ranks = { EASY: 0, MEDIUM: 1, HARD: 2 };
    const values = difficulty.items.map((item) => ranks[item.difficulty]);
    expect(values).toEqual([...values].sort());
  });
  it("paginates equal sort values without duplicates and clamps out-of-range pages", async () => {
    await db.problem.createMany({ data: extraSlugs.filter((slug) => slug.startsWith("qa-page-")).map((slug) => ({
      slug, title: "Pagination fixture", difficulty: "EASY" as const, status: "PUBLISHED" as const,
      pattern: "linear-scan", statement: "Only test data", constraints: ["Fixture"], estimatedMinutes: 10,
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    })) });
    for (const sort of ["title", "newest", "difficulty", "time"]) {
      const first = await queryLibrary(db, filters({ q: "Pagination fixture", sort }), null);
      const last = await queryLibrary(db, filters({ q: "Pagination fixture", sort, page: "999" }), null);
      expect(first).toMatchObject({ total: 14, page: 1, pages: 2 });
      expect(first.items).toHaveLength(12);
      expect(last.page).toBe(2);
      expect(last.items).toHaveLength(2);
      expect(new Set([...first.items, ...last.items].map((item) => item.slug)).size).toBe(14);
    }
  });
});

async function everySlug(f: ReturnType<typeof parseLibraryFilters>) {
  const slugs: string[] = [];
  for (let page = 1; ; page++) {
    const result = await queryLibrary(db, { ...f, page }, null);
    slugs.push(...result.items.map((item) => item.slug));
    if (page >= result.pages) return slugs;
  }
}

describe("flat library before any category has a parent", () => {
  it("returns no tree and the same flat category facet as before", async () => {
    const result = await queryLibrary(db, filters({}), null);
    expect(result.facets.categoryTree).toBeNull();
    const used = new Set(seeds.filter((seed) => seed.status === "PUBLISHED").flatMap((seed) => seed.categories));
    expect(result.facets.categories.map((entry) => entry.slug).sort()).toEqual([...used].sort());
    // No group rows exist yet, so a group URL matches nothing rather than erroring or ignoring the filter.
    expect((await queryLibrary(db, filters({ group: "algorithms" }), null)).total).toBe(0);
  });
});

describe("category hierarchy against PostgreSQL", () => {
  const qaGroup = "qa-empty-group";
  beforeAll(async () => {
    await seedCategoryGroups(db);
    // A group whose only child has nothing published (the private fixture has only draft and archived problems).
    await db.category.create({ data: { slug: qaGroup, name: qaGroup } });
    await db.category.update({ where: { slug: privateSlug }, data: { parent: { connect: { slug: qaGroup } } } });
  });
  afterAll(async () => {
    await db.category.update({ where: { slug: privateSlug }, data: { parentId: null } });
    await db.category.deleteMany({ where: { slug: qaGroup } });
    await db.category.updateMany({ where: { slug: { in: CATEGORY_GROUPS.flatMap((group) => [...group.children]) } }, data: { parentId: null, position: 0 } });
    await db.category.deleteMany({ where: { slug: { in: CATEGORY_GROUPS.map((group) => group.slug) } } });
  });
  const published = () => seeds.filter((seed) => seed.status === "PUBLISHED");

  it("returns groups with only children that have a published problem, in configured order, hiding empty groups", async () => {
    const tree = (await queryLibrary(db, filters({}), null)).facets.categoryTree;
    const used = new Set(published().flatMap((seed) => seed.categories));
    const expected = CATEGORY_GROUPS.map((group) => ({ slug: group.slug, name: group.name, children: group.children.filter((child) => used.has(child)) })).filter((group) => group.children.length);
    expect(tree?.groups.map((group) => ({ slug: group.slug, name: group.name, children: group.children.map((child) => child.slug) }))).toEqual(expected);
    expect(tree?.groups.some((group) => group.slug === qaGroup)).toBe(false);
    expect(tree?.ungrouped).toEqual([]);
    expect(JSON.stringify(tree)).not.toContain(privateSlug);
  });
  it("keeps the flat category facet identical so existing consumers are unaffected", async () => {
    const result = await queryLibrary(db, filters({}), null);
    const used = new Set(published().flatMap((seed) => seed.categories));
    expect(result.facets.categories.map((entry) => entry.slug).sort()).toEqual([...used].sort());
  });
  it("filters by group as the union of its children, and excludes unpublished problems", async () => {
    let sawUnionLargerThanChild = false;
    for (const group of CATEGORY_GROUPS) {
      const expected = published().filter((seed) => seed.categories.some((slug) => (group.children as readonly string[]).includes(slug))).map((seed) => seed.slug).sort();
      const actual = await everySlug(filters({ group: group.slug }));
      expect([...actual].sort()).toEqual(expected);
      expect(new Set(actual).size).toBe(actual.length);
      expect((await queryLibrary(db, filters({ group: group.slug }), null)).total).toBe(expected.length);
      for (const child of group.children) {
        const own = published().filter((seed) => seed.categories.includes(child)).length;
        if (own && own < expected.length) sawUnionLargerThanChild = true;
      }
    }
    expect(sawUnionLargerThanChild).toBe(true);
    expect((await queryLibrary(db, filters({ group: qaGroup }), null)).total).toBe(0);
    expect((await queryLibrary(db, filters({ group: "no-such-group" }), null)).total).toBe(0);
  });
  it("leaves the existing leaf category filter unchanged, and a specific category wins over a group", async () => {
    const leaf = published()[0].categories[0];
    const expected = published().filter((seed) => seed.categories.includes(leaf)).map((seed) => seed.slug).sort();
    expect([...(await everySlug(filters({ category: leaf })))].sort()).toEqual(expected);
    const parent = CATEGORY_GROUPS.find((group) => (group.children as readonly string[]).includes(leaf))!;
    expect([...(await everySlug(filters({ category: leaf, group: parent.slug })))].sort()).toEqual(expected);
    // The select encodes a group as category=group:<slug>; both routes return the same union.
    expect(await everySlug(filters({ category: "group:" + parent.slug }))).toEqual(await everySlug(filters({ group: parent.slug })));
  });
  it("combines a group with other filters and keeps counts, sorting and pagination consistent", async () => {
    const group = CATEGORY_GROUPS[1];
    const all = await queryLibrary(db, filters({ group: group.slug, sort: "difficulty" }), null);
    const easy = await queryLibrary(db, filters({ group: group.slug, difficulty: "EASY" }), null);
    expect(easy.total).toBe(published().filter((seed) => seed.difficulty === "EASY" && seed.categories.some((slug) => (group.children as readonly string[]).includes(slug))).length);
    expect(all.pages).toBe(Math.max(1, Math.ceil(all.total / 12)));
  });
});

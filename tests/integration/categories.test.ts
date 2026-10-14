import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/db/client";
import { CATEGORIES, CATEGORY_GROUPS } from "@/data/seeds/taxonomy";
import { seedCategoryGroups } from "../../prisma/seed-categories";

let db: ReturnType<typeof createDatabaseClient>;
let preexisting: string[] = [];
const snapshot = async () => (await db.category.findMany({ select: { slug: true, name: true, parentId: true, position: true }, orderBy: { slug: "asc" } }));
const groupSlugs = CATEGORY_GROUPS.map((group) => group.slug);

async function reset() {
  await db.category.updateMany({ data: { parentId: null, position: 0 } });
  await db.category.deleteMany({ where: { slug: { notIn: preexisting } } });
}

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use TEST_DATABASE_URL pointing to a dedicated database ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Category integration tests require an empty problem collection.");
  // Never touch rows other suites own; restore exactly the starting categories afterwards.
  preexisting = (await db.category.findMany({ select: { slug: true } })).map((row) => row.slug);
  if (preexisting.some((slug) => groupSlugs.includes(slug as never))) throw new Error("Test database already has category groups.");
  await reset();
}, 30_000);
afterAll(async () => { if (db) { await reset(); await db.$disconnect(); } });

describe("category group seeding against PostgreSQL", () => {
  it("creates the groups and links every leaf in order, then reports no changes on rerun", async () => {
    const first = await seedCategoryGroups(db);
    expect(first).toEqual({ groupsCreated: 4, leavesCreated: CATEGORIES.length - preexisting.length, linked: preexisting.length, alreadyLinked: 0 });
    const groups = await db.category.findMany({ where: { slug: { in: groupSlugs } }, include: { children: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } });
    expect(groups.map((group) => [group.slug, group.position, group.parentId])).toEqual([
      ["data-structures", 1, null], ["algorithms", 2, null], ["design-and-systems", 3, null], ["databases", 4, null],
    ]);
    expect(groups.map((group) => group.children.map((child) => child.slug))).toEqual(CATEGORY_GROUPS.map((group) => [...group.children]));
    expect(await db.category.count()).toBe(CATEGORIES.length + 4);
    const before = await snapshot();
    expect(await seedCategoryGroups(db)).toEqual({ groupsCreated: 0, leavesCreated: 0, linked: 0, alreadyLinked: CATEGORIES.length });
    expect(await snapshot()).toEqual(before);
  });
  it("never moves a leaf that already has a parent: a different parent is a conflict that changes nothing", async () => {
    await db.category.update({ where: { slug: "arrays" }, data: { parent: { connect: { slug: "algorithms" } } } });
    const before = await snapshot();
    await expect(seedCategoryGroups(db)).rejects.toThrow(/Category conflict: arrays is already under algorithms, not data-structures/);
    expect(await snapshot()).toEqual(before);
  });
  it("detects the conflict before writing anything, even when earlier groups still have work to do", async () => {
    // Unlink everything but keep one conflicting leaf in the LAST group: the earlier groups would otherwise be linked first.
    await db.category.updateMany({ data: { parentId: null, position: 0 } });
    await db.category.deleteMany({ where: { slug: { in: groupSlugs } } });
    await db.category.create({ data: { slug: "other-group", name: "Other Group" } });
    await db.category.update({ where: { slug: "sql" }, data: { parent: { connect: { slug: "other-group" } } } });
    const before = await snapshot();
    await expect(seedCategoryGroups(db)).rejects.toThrow(/sql is already under other-group, not databases/);
    expect(await snapshot()).toEqual(before);
    expect(await db.category.count({ where: { slug: { in: groupSlugs } } })).toBe(0);
  });
  it("refuses a group slug that exists as a child, a mismatched group name, and a taken name", async () => {
    await reset();
    await db.category.create({ data: { slug: "databases", name: "Not Databases" } });
    const before = await snapshot();
    await expect(seedCategoryGroups(db)).rejects.toThrow(/group databases exists with the name "Not Databases"/);
    await db.category.delete({ where: { slug: "databases" } });
    await db.category.create({ data: { slug: "squatter", name: "Data Structures" } });
    await expect(seedCategoryGroups(db)).rejects.toThrow(/name "Data Structures" is already used by category squatter/);
    await db.category.delete({ where: { slug: "squatter" } });
    expect((await snapshot()).length).toBe(before.length - 1);
  });
  it("links only unparented leaves and leaves existing group positions alone", async () => {
    await reset();
    await seedCategoryGroups(db);
    await db.category.update({ where: { slug: "algorithms" }, data: { position: 9 } });
    await db.category.update({ where: { slug: "strings" }, data: { parentId: null, position: 0 } });
    expect(await seedCategoryGroups(db)).toEqual({ groupsCreated: 0, leavesCreated: 0, linked: 1, alreadyLinked: CATEGORIES.length - 1 });
    expect((await db.category.findUniqueOrThrow({ where: { slug: "algorithms" } })).position).toBe(9);
    const strings = await db.category.findUniqueOrThrow({ where: { slug: "strings" }, include: { parent: true } });
    expect([strings.parent?.slug, strings.position]).toEqual(["data-structures", 1]);
  });
  it("rejects invalid input without touching the database", async () => {
    await reset();
    const before = await snapshot();
    await expect(seedCategoryGroups(db, [{ slug: "g", name: "G", position: 1, children: ["not-a-leaf"] }])).rejects.toThrow(/unknown leaf/);
    expect(await snapshot()).toEqual(before);
  });
  it("lets the database refuse a second level even if application checks were bypassed", async () => {
    await reset();
    await seedCategoryGroups(db);
    await expect(db.category.update({ where: { slug: "trees" }, data: { parent: { connect: { slug: "arrays" } } } })).rejects.toThrow(/one level/);
    await expect(db.category.update({ where: { slug: "algorithms" }, data: { parent: { connect: { slug: "databases" } } } })).rejects.toThrow(/one level/);
  });
});

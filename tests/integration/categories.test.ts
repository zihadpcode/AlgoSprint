import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/db/client";
import { CATEGORIES, CATEGORY_GROUPS } from "@/data/seeds/taxonomy";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
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

// Pause after the real transaction's initial read, then let another connection commit before writes resume.
async function pausedSeed(groups: unknown, leaves: readonly (readonly [string, string])[]) {
  let read!: () => void, resume!: () => void;
  const readDone = new Promise<void>((resolve) => { read = resolve; });
  const gate = new Promise<void>((resolve) => { resume = resolve; });
  const gated = {
    $transaction: (callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: { timeout?: number }) =>
      db.$transaction(async (tx) => callback(new Proxy(tx, {
        get(target, key) {
          if (key !== "category") return Reflect.get(target, key);
          return new Proxy(tx.category, {
            get(category, operation) {
              if (operation !== "findMany") return Reflect.get(category, operation);
              return async (args: Parameters<typeof category.findMany>[0]) => {
                const rows = await category.findMany(args);
                read(); await gate; return rows;
              };
            },
          });
        },
      })), options),
  } as unknown as PrismaClient;
  const result = seedCategoryGroups(gated, groups, leaves);
  await readDone;
  return { result, resume };
}

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
  it("does not overwrite a concurrently committed placement and rolls back earlier seed writes", async () => {
    await reset();
    const first = await db.category.create({ data: { slug: "first-group", name: "First Group" } });
    const second = await db.category.create({ data: { slug: "second-group", name: "Second Group" } });
    await db.category.createMany({ data: [{ slug: "arrays", name: "Arrays" }, { slug: "strings", name: "Strings" }], skipDuplicates: true });
    const pending = await pausedSeed([
      { slug: "new-group", name: "New Group", position: 1, children: ["strings"] },
      { slug: first.slug, name: first.name, position: 2, children: ["arrays"] },
    ], [["arrays", "Arrays"], ["strings", "Strings"]]);
    // A separate pooled connection commits this while the seed transaction is paused.
    await db.category.update({ where: { slug: "arrays" }, data: { parentId: second.id, position: 7 } });
    const before = await db.category.findMany({ orderBy: { slug: "asc" } });
    pending.resume();
    await expect(pending.result).rejects.toThrow(/Category conflict: arrays changed during seeding \(now under second-group\)/);
    expect(await db.category.findMany({ orderBy: { slug: "asc" } })).toEqual(before);
    expect(await db.category.count({ where: { slug: "new-group" } })).toBe(0);
  });
  it("preserves a concurrently assigned position when the leaf was linked to the intended group", async () => {
    await reset();
    const first = await db.category.create({ data: { slug: "first-group", name: "First Group" } });
    await db.category.upsert({ where: { slug: "arrays" }, create: { slug: "arrays", name: "Arrays" }, update: {} });
    const pending = await pausedSeed([{ slug: first.slug, name: first.name, position: 1, children: ["arrays"] }], [["arrays", "Arrays"]]);
    await db.category.update({ where: { slug: "arrays" }, data: { parentId: first.id, position: 7 } });
    const before = await db.category.findMany({ orderBy: { slug: "asc" } });
    pending.resume();
    expect(await pending.result).toEqual({ groupsCreated: 0, leavesCreated: 0, linked: 0, alreadyLinked: 1 });
    expect(await db.category.findMany({ orderBy: { slug: "asc" } })).toEqual(before);
  });
  it("does not recreate a leaf deleted after the seed snapshot", async () => {
    await reset();
    const first = await db.category.create({ data: { slug: "first-group", name: "First Group" } });
    await db.category.upsert({ where: { slug: "qa-concurrent-leaf" }, create: { slug: "qa-concurrent-leaf", name: "Concurrent Leaf" }, update: {} });
    const pending = await pausedSeed([{ slug: first.slug, name: first.name, position: 1, children: ["qa-concurrent-leaf"] }], [["qa-concurrent-leaf", "Concurrent Leaf"]]);
    await db.category.delete({ where: { slug: "qa-concurrent-leaf" } });
    const before = await db.category.findMany({ orderBy: { slug: "asc" } });
    pending.resume();
    await expect(pending.result).rejects.toThrow(/Category conflict: qa-concurrent-leaf changed during seeding/);
    expect(await db.category.findMany({ orderBy: { slug: "asc" } })).toEqual(before);
  });

  it("refuses hierarchy writes in REPEATABLE READ, where the lock holder's commit would be invisible", async () => {
    await reset();
    const [a, b, c] = await Promise.all(["iso-a", "iso-b", "iso-c"].map((slug) => db.category.create({ data: { slug, name: slug } })));
    // Transaction 1 fixes its snapshot, then another connection nests b under a and commits. Validating against the old
    // snapshot would not see that a now has a child, so the trigger refuses to validate at all (not a retryable conflict).
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let snapshotReady!: () => void;
    const snapshotTaken = new Promise<void>((resolve) => { snapshotReady = resolve; });
    const stale = db.$transaction(async (tx) => {
      await tx.category.findMany({ select: { id: true } });
      snapshotReady();
      await gate;
      await tx.category.update({ where: { id: a.id }, data: { parentId: c.id } });
    }, { isolationLevel: "RepeatableRead" });
    const settled = stale.then(() => null, (error: unknown) => error);
    await snapshotTaken;
    try {
      await db.category.update({ where: { id: b.id }, data: { parentId: a.id } });
    } finally { release(); }
    expect(String(await settled)).toMatch(/require READ COMMITTED isolation/);
    const rows = await db.category.findMany({ where: { slug: { startsWith: "iso-" } }, select: { slug: true, parentId: true }, orderBy: { slug: "asc" } });
    expect(rows).toEqual([{ slug: "iso-a", parentId: null }, { slug: "iso-b", parentId: a.id }, { slug: "iso-c", parentId: null }]);
    // Control: the same isolation level is fine for writes that do not set a parent.
    await db.$transaction((tx) => tx.category.update({ where: { id: c.id }, data: { position: 4 } }), { isolationLevel: "RepeatableRead" });
    expect((await db.category.findUniqueOrThrow({ where: { id: c.id } })).position).toBe(4);
  });
  it("makes a second concurrent nesting wait for the first writer's commit and then fail", async () => {
    await reset();
    const [a, b, c] = await Promise.all(["iso-a", "iso-b", "iso-c"].map((slug) => db.category.create({ data: { slug, name: slug } })));
    // a under b and, concurrently, b under c: each alone is legal, together they make a two-level chain. Hold the first
    // writer open (it owns the advisory lock) until the second one is observed waiting on that lock, so the interleaving
    // is forced instead of left to timing.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let holding!: () => void;
    const held = new Promise<void>((resolve) => { holding = resolve; });
    const first = db.$transaction(async (tx) => {
      await tx.category.update({ where: { id: a.id }, data: { parentId: b.id } });
      holding();
      await gate;
    });
    await held;
    const second = db.category.update({ where: { id: b.id }, data: { parentId: c.id } }).then(() => null, (error: unknown) => error);
    let waiting = 0;
    for (let attempt = 0; attempt < 100 && waiting === 0; attempt++) {
      waiting = Number((await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`)[0].n);
      if (waiting === 0) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(waiting).toBe(1);
    release();
    await first;
    expect(String(await second)).toMatch(/already has children \(one level only\)/);
    const nested = await db.category.findMany({ where: { slug: { startsWith: "iso-" }, parentId: { not: null } }, select: { slug: true } });
    expect(nested).toEqual([{ slug: "iso-a" }]);
  });
});

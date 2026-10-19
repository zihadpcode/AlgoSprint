import type { PrismaClient } from "../src/generated/prisma/client";
import { CATEGORIES, CATEGORY_GROUPS } from "../src/data/seeds/taxonomy";
import { validateCategoryGroups } from "../src/lib/validators/category-groups";

export type CategorySeedResult = { groupsCreated: number; leavesCreated: number; linked: number; alreadyLinked: number };

// Insert-only, like every other seed: create missing group rows and link a leaf ONLY while it has no parent. Anything
// already placed (even in a different group, or with a different position) is never rewritten. A leaf that sits under a
// different parent than the seed says is a conflict: the whole step throws, and its transaction rolls back all seed
// writes. Concurrent placements are rechecked in the conditional UPDATE rather than trusted from the initial read.
export async function seedCategoryGroups(
  db: PrismaClient,
  groupsInput: unknown = CATEGORY_GROUPS,
  leaves: readonly (readonly [string, string])[] = CATEGORIES,
): Promise<CategorySeedResult> {
  const groups = validateCategoryGroups(groupsInput, leaves);
  const leafNames = new Map(leaves.map(([slug, name]) => [slug, name]));
  return db.$transaction(async (tx) => {
    const rows = await tx.category.findMany({ select: { id: true, slug: true, name: true, parentId: true } });
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    const byName = new Map(rows.map((row) => [row.name, row]));
    const hasChildren = new Set(rows.flatMap((row) => row.parentId ? [row.parentId] : []));

    // Phase 1: read-only conflict detection over the whole input.
    for (const group of groups) {
      const row = bySlug.get(group.slug);
      if (row) {
        if (row.parentId) throw new Error(`Category conflict: group ${group.slug} already exists as a child category. No categories were changed.`);
        if (row.name !== group.name) throw new Error(`Category conflict: group ${group.slug} exists with the name "${row.name}", not "${group.name}". No categories were changed.`);
      } else if (byName.has(group.name)) {
        throw new Error(`Category conflict: the name "${group.name}" is already used by category ${byName.get(group.name)!.slug}. No categories were changed.`);
      }
      for (const child of group.children) {
        const leaf = bySlug.get(child);
        if (!leaf) continue;
        if (hasChildren.has(leaf.id)) throw new Error(`Category conflict: ${child} already has children, so it cannot become a child of ${group.slug}. No categories were changed.`);
        if (leaf.parentId && leaf.parentId !== row?.id) {
          const parent = rows.find((candidate) => candidate.id === leaf.parentId);
          throw new Error(`Category conflict: ${child} is already under ${parent?.slug ?? "another category"}, not ${group.slug}. No categories were changed.`);
        }
      }
    }

    // Phase 2: writes. Nothing above can fail halfway, and a database error rolls the whole transaction back.
    const result: CategorySeedResult = { groupsCreated: 0, leavesCreated: 0, linked: 0, alreadyLinked: 0 };
    for (const group of groups) {
      let parent = bySlug.get(group.slug);
      if (!parent) {
        parent = { ...(await tx.category.create({ data: { slug: group.slug, name: group.name, position: group.position }, select: { id: true, slug: true, name: true, parentId: true } })) };
        bySlug.set(group.slug, parent);
        result.groupsCreated++;
      }
      for (const [index, child] of group.children.entries()) {
        const leaf = bySlug.get(child);
        if (!leaf) {
          const created = await tx.category.create({
            data: { slug: child, name: leafNames.get(child)!, parentId: parent.id, position: index },
            select: { id: true, slug: true, name: true, parentId: true },
          });
          bySlug.set(child, created);
          result.leavesCreated++;
        } else if (leaf.parentId === null) {
          // The preflight snapshot is not a write guard: another writer can place this leaf while we wait.
          // Recheck null in the UPDATE itself, so an existing placement/order is never overwritten.
          const linked = await tx.category.updateMany({ where: { id: leaf.id, parentId: null }, data: { parentId: parent.id, position: index } });
          if (linked.count) {
            result.linked++;
          } else {
            const current = await tx.category.findUnique({ where: { id: leaf.id }, select: { parentId: true, parent: { select: { slug: true } } } });
            if (!current || current.parentId !== parent.id) {
              throw new Error(`Category conflict: ${child} changed during seeding${current?.parent ? ` (now under ${current.parent.slug})` : ""}. No categories were changed.`);
            }
            // A cooperating or manual writer already linked it to this group. Keep its chosen position too.
            result.alreadyLinked++;
          }
        } else {
          result.alreadyLinked++;
        }
      }
    }
    return result;
  }, { timeout: 30_000, isolationLevel: "ReadCommitted" }); // the one-level trigger validates only under READ COMMITTED; do not rely on the session default
}

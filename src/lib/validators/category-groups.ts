import { z } from "zod";

const slug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const categoryGroupsSchema = z.array(z.object({
  slug, name: z.string().trim().min(1).max(100), position: z.number().int().min(0).max(1000),
  children: z.array(slug).min(1).max(100),
}).strict()).max(100);
export type CategoryGroupSeed = z.infer<typeof categoryGroupsSchema>[number];

// Pure and database-free: shared by `npm run seed:validate` and the seeding step, so a bad structure fails before any write.
export function validateCategoryGroups(
  input: unknown,
  leaves: readonly (readonly [string, string])[],
): CategoryGroupSeed[] {
  const groups = categoryGroupsSchema.parse(input);
  const leafSlugs = new Set(leaves.map(([leafSlug]) => leafSlug));
  const leafNames = new Set(leaves.map(([, name]) => name.toLowerCase()));
  const groupSlugs = new Set<string>();
  const groupNames = new Set<string>();
  const placed = new Map<string, string>();
  for (const group of groups) {
    if (groupSlugs.has(group.slug)) throw new Error(`Duplicate category group slug ${group.slug}.`);
    groupSlugs.add(group.slug);
    if (leafSlugs.has(group.slug)) throw new Error(`Category group slug ${group.slug} collides with a leaf category.`);
    const name = group.name.toLowerCase();
    if (groupNames.has(name)) throw new Error(`Duplicate category group name ${group.name}.`);
    groupNames.add(name);
    if (leafNames.has(name)) throw new Error(`Category group name ${group.name} collides with a leaf category name.`);
    for (const child of group.children) {
      if (!leafSlugs.has(child)) throw new Error(`Category group ${group.slug} lists unknown leaf category ${child}.`);
      const other = placed.get(child);
      if (other === group.slug) throw new Error(`Category group ${group.slug} lists ${child} twice.`);
      if (other) throw new Error(`Leaf category ${child} is in two groups: ${other} and ${group.slug}.`);
      placed.set(child, group.slug);
    }
  }
  return groups;
}

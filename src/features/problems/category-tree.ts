export type CategoryOption = { slug: string; name: string };
export type CategoryGroupFacet = CategoryOption & { children: CategoryOption[] };
export type CategoryTree = { groups: CategoryGroupFacet[]; ungrouped: CategoryOption[] };
export type PublishedCategoryRow = CategoryOption & {
  position: number;
  parent: (CategoryOption & { position: number }) | null;
};

const byPositionThenName = (a: { position: number; name: string }, b: { position: number; name: string }) =>
  a.position - b.position || a.name.localeCompare(b.name);
const option = ({ slug, name }: CategoryOption): CategoryOption => ({ slug, name });

// Input: only categories that have at least one PUBLISHED problem. Groups and children without one never appear,
// exactly as empty flat categories never did. Returns null when nothing is grouped, so callers render the old flat list.
export function buildCategoryTree(rows: readonly PublishedCategoryRow[]): CategoryTree | null {
  if (!rows.some((row) => row.parent)) return null;
  const groups = new Map<string, { slug: string; name: string; position: number; children: PublishedCategoryRow[] }>();
  for (const row of rows) {
    if (!row.parent) continue;
    const group = groups.get(row.parent.slug) ?? { ...row.parent, children: [] };
    group.children.push(row);
    groups.set(group.slug, group);
  }
  return {
    groups: [...groups.values()].sort(byPositionThenName).map((group) => ({
      ...option(group), children: group.children.sort(byPositionThenName).map(option),
    })),
    // A top-level category with its own problems that is not a group stays selectable. A group row that also has
    // problems is reached through its group option, which includes the group's own problems.
    ungrouped: rows.filter((row) => !row.parent && !groups.has(row.slug)).sort((a, b) => a.name.localeCompare(b.name)).map(option),
  };
}

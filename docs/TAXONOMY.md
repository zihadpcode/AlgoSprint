# Category taxonomy

Problems are tagged with **leaf categories** (Arrays, Two Pointers, SQL Problems, ...). Leaves are organised under
**category groups** (Data Structures, Algorithms, Design and Systems, Databases) so the library filter is not one flat
list of about 30 entries.

## Model

- One table, `app."Category"`, with a nullable self-reference `parentId` and an integer `position` (display order).
- A **group** is a category with no parent. A **leaf** is a category whose `parentId` points at a group.
- **Problems link to leaves only** (`ProblemCategory`, `CATEGORIES` in `src/data/seeds/taxonomy.ts`). Groups are never
  listed in `CATEGORIES`, so a problem seed cannot reference a group.
- **One level only.** A group has no parent, and a child's parent has no parent. The database enforces this: a CHECK
  rejects a category being its own parent, and a trigger rejects nesting under a child or turning a group that has
  children into a child (migration `202610140001_category_hierarchy`). Deleting a group that still has children is
  refused (`ON DELETE RESTRICT`).
- `parentId IS NULL` is a valid top-level category. Every row that existed before the migration is exactly that, so
  the migration changes no existing data. Existing leaf slugs and names never change: production rows and problem seeds
  reference them.
- Row level security stays on for the table, as for every `app` table.

The group structure lives in `CATEGORY_GROUPS` (`src/data/seeds/taxonomy.ts`): group slug, name, position, and the child
leaf slugs in display order. `npm run seed:validate` checks that every child is an existing leaf, no leaf is in two
groups, no group slug or name collides with a leaf, and group slugs/names are unique.

## How the library uses it

- Facets: when any category that has a published problem has a parent, `facets.categoryTree` holds the groups, each with
  only the children that have at least one **published** problem. Empty groups and empty children are hidden, as empty
  flat categories always were. Published categories without a group stay selectable under "Other".
- When nothing is grouped, `facets.categoryTree` is `null` and the select renders the old flat list unchanged.
- Filters: `category=<leaf>` is unchanged. `group=<group slug>` matches a problem in any child of the group. The category
  `<select>` also offers an "All <group>" option per group whose value is `group:<slug>`, so the form stays a plain GET
  form that works without JavaScript; the server turns it into the `group` filter. If a URL names both a leaf and a
  group, the leaf wins. Pagination links use the canonical `group=` form.
- Deploy order: the new code selects the hierarchy columns. If it runs before the migration is applied, the library
  query detects the missing `Category` column (Prisma `P2022`) and serves the flat library, so the page keeps working.
  A `group` URL matches nothing until the migration and seed exist.

## Seeding is insert-only

`npm run db:seed` runs `prisma/seed-categories.ts` after the problems are seeded. It, in one transaction:

1. creates missing group rows (and any missing leaf rows, exactly as problem seeding does);
2. sets a leaf's `parentId`/`position` **only while its `parentId` is NULL**;
3. throws a conflict error **before writing anything** if a leaf already sits under a *different* parent, if a group slug
   exists as a child or with a different name, or if a group name is taken by another category.

Rows that are already placed are never moved, renamed or re-ordered, so a rerun reports `groupsCreated: 0, linked: 0`.
To change an existing placement, do it deliberately with a reviewed one-off SQL/Prisma change; the seed will not.

## Adding a group or subcategory safely

1. **New leaf**: add it to `CATEGORIES` (slug and name never change afterwards) and add its slug to one group's `children`.
2. **New group**: add an entry to `CATEGORY_GROUPS` with a unique slug and name (neither may match any leaf) and a
   `position` after the existing ones.
3. Run `npm run seed:validate`, then the unit and integration tests.
4. Do not edit already-seeded problem JSON or roadmap rows to do this; problems keep referencing leaf slugs.
5. Do not nest a group under another group. If a deeper tree is ever wanted, that is a new migration and a redesign of
   the one-level trigger, not a data change.

## Production

Codex runs production steps. The order is: **deploy the migration** (`npm run db:deploy`), **then** `npm run db:seed`.
Until the migration is deployed the app works with the flat list; until the seed has run the migration is harmless and
the library still shows the flat list because no category has a parent.

## Planned, not implemented

Future groups are expected for **system design**, **programming languages** (other languages) and **data tools**. They
are not in `CATEGORY_GROUPS` today and nothing in the schema is specific to them: they are new groups with new leaves,
added with the steps above.

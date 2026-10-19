import Link from "next/link";
import { X } from "lucide-react";
import { libraryHref, type LibraryFilters } from "@/features/problems/filters";
import type { LibraryResult } from "@/features/problems/query";

const STATUS = { NOT_STARTED: "Not started", ATTEMPTED: "Attempted", SOLVED: "Solved" } as const;
const title = (value: string) => value[0] + value.slice(1).toLowerCase();

type Chip = { key: string; text: string; remove: Partial<LibraryFilters> };

/** One removable chip per active filter, each a plain link so it works without JavaScript. */
export function ActiveFilters({ filters, facets }: { filters: LibraryFilters; facets: LibraryResult["facets"] }) {
  const names = new Map<string, string>([
    ...facets.categories.map((c) => [c.slug, c.name] as [string, string]),
    ...(facets.categoryTree?.groups.map((g) => [g.slug, g.name] as [string, string]) ?? []),
  ]);
  const tags = new Map(facets.tags.map((t) => [t.slug, t.name]));
  const chips: Chip[] = [
    ...(filters.q ? [{ key: "q", text: `“${filters.q}”`, remove: { q: "" } }] : []),
    ...filters.difficulty.map((d) => ({ key: "d" + d, text: title(d), remove: { difficulty: filters.difficulty.filter((v) => v !== d) } })),
    ...filters.category.map((c) => ({ key: "c" + c, text: names.get(c) ?? c, remove: { category: filters.category.filter((v) => v !== c) } })),
    ...filters.group.map((g) => ({ key: "g" + g, text: "All " + (names.get(g) ?? g), remove: { group: filters.group.filter((v) => v !== g) } })),
    ...(filters.tag ? [{ key: "t", text: "Tag: " + (tags.get(filters.tag) ?? filters.tag), remove: { tag: "" } }] : []),
    ...(filters.pattern ? [{ key: "p", text: "Pattern: " + filters.pattern.replaceAll("-", " "), remove: { pattern: "" } }] : []),
    ...(filters.maxMinutes ? [{ key: "m", text: `≤ ${filters.maxMinutes} min`, remove: { maxMinutes: 0 } }] : []),
    ...filters.completion.map((s) => ({ key: "s" + s, text: STATUS[s], remove: { completion: filters.completion.filter((v) => v !== s) } })),
    ...(filters.review ? [{ key: "r", text: "Review later", remove: { review: false } }] : []),
  ];
  if (!chips.length) return null;
  return (
    <ul aria-label="Active filters" className="mb-3 flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link href={libraryHref({ ...filters, ...chip.remove, page: 1 })} scroll={false} replace
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface-raised pr-1.5 pl-2.5 text-xs text-ink transition-colors hover:border-line-strong hover:bg-surface-hover">
            {chip.text}
            <X aria-hidden="true" size={12} className="text-subtle" />
            <span className="sr-only">Remove filter</span>
          </Link>
        </li>
      ))}
      <li><Link href="/problems" scroll={false} replace className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted transition-colors hover:text-ink">Clear all</Link></li>
    </ul>
  );
}

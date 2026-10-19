import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Badge, difficultyText } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProblemStatus } from "./problem-status";
import { libraryHref, type LibraryFilters } from "@/features/problems/filters";
import type { LibraryResult } from "@/features/problems/query";

type Sortable = "title" | "difficulty" | "time";
const difficultyName = (value: string) => value[0] + value.slice(1).toLowerCase();

/** Header link for one sortable column. Clicking toggles direction; a new column starts ascending. The result is a
 *  plain URL, so sorting is handled by the server and works without JavaScript. */
function SortHeader({ column, label, filters, align }: { column: Sortable; label: string; filters: LibraryFilters; align?: "right" }) {
  const active = filters.sort === column;
  const nextDir = active && filters.dir === "asc" ? "desc" : "asc";
  const href = libraryHref({ ...filters, sort: column, dir: nextDir, page: 1 });
  const Icon = !active ? ChevronsUpDown : filters.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("h-9 px-3 font-medium", align === "right" && "text-right")}>
      <Link href={href} scroll={false} className={cn("-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors hover:text-ink", active ? "text-ink" : "text-muted")}>
        {label}<Icon aria-hidden="true" size={12} className={active ? "text-accent" : "text-subtle"} />
        <span className="sr-only">, sort {active ? (nextDir === "asc" ? "ascending" : "descending") : "ascending"}</span>
      </Link>
    </th>
  );
}

export function ProblemTable({ problems, filters }: { problems: LibraryResult["items"]; filters: LibraryFilters }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">Problems, sorted by {filters.sort} {filters.dir === "asc" ? "ascending" : "descending"}</caption>
        <thead className="border-b border-line bg-surface-raised/50 text-xs">
          <tr>
            <th scope="col" className="w-12 px-3 font-medium text-muted"><span className="sr-only">Status</span></th>
            <SortHeader column="title" label="Title" filters={filters} />
            <SortHeader column="difficulty" label="Difficulty" filters={filters} />
            <th scope="col" className="hidden h-9 px-3 font-medium text-muted lg:table-cell">Topics</th>
            <SortHeader column="time" label="Est. time" filters={filters} align="right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {problems.map((problem) => (
            <tr key={problem.slug} className="h-12 transition-colors hover:bg-surface-hover">
              <td className="px-3"><ProblemStatus progress={problem.progress} /></td>
              <td className="px-3">
                <Link href={`/problems/${problem.slug}`} className="font-medium [overflow-wrap:anywhere] hover:text-accent">{problem.title}</Link>
                {problem.progress?.reviewLater && <Badge tone="warm" className="ml-2 h-5 px-1.5">Review</Badge>}
              </td>
              <td className={cn("px-3 font-medium", difficultyText(problem.difficulty))}>{difficultyName(problem.difficulty)}</td>
              <td className="hidden px-3 lg:table-cell">
                <div className="flex flex-wrap items-center gap-1.5">
                  {problem.categories.slice(0, 2).map((category) => <Badge key={category.slug}>{category.name}</Badge>)}
                  {problem.categories.length > 2 && <span className="text-xs text-subtle" title={problem.categories.slice(2).map((c) => c.name).join(", ")}>+{problem.categories.length - 2}</span>}
                </div>
              </td>
              <td className="px-3 text-right text-muted tabular-nums">{problem.estimatedMinutes} min</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

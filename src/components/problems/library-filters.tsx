"use client";

import Form from "next/form";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Lock, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonStyles } from "@/components/ui/button";
import { CheckOption, FilterMenu } from "./filter-menu";
import { DIFFICULTIES, GROUP_PREFIX, defaultDirection, libraryHref, parseLibraryFilters, type LibraryFilters } from "@/features/problems/filters";
import type { LibraryResult } from "@/features/problems/query";

// What each named control should currently hold. Checkbox groups repeat the name, so every entry is a list.
function values(filters: LibraryFilters): Record<string, string[]> {
  const one = (value: string) => value ? [value] : [];
  return {
    q: one(filters.q), difficulty: filters.difficulty, category: filters.category, tag: one(filters.tag), pattern: one(filters.pattern),
    maxMinutes: one(filters.maxMinutes ? String(filters.maxMinutes) : ""), completion: filters.completion, review: filters.review ? ["1"] : [],
    sort: [filters.sort], dir: filters.dir === defaultDirection(filters.sort) ? [] : [filters.dir],
  };
}
function syncForm(form: HTMLFormElement, filters: LibraryFilters) {
  const wanted = values(filters);
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) || element.type === "hidden") continue;
    const list = wanted[element.name];
    if (!list) continue;
    if (element instanceof HTMLInputElement && element.type === "checkbox") element.checked = list.includes(element.value);
    else element.value = list[0] ?? "";
  }
}
function fingerprint(form: HTMLFormElement) {
  return JSON.stringify(Array.from(new FormData(form).entries()));
}

const label = (value: string) => value[0] + value.slice(1).toLowerCase();
const STATUS_LABELS = { NOT_STARTED: "Not started", ATTEMPTED: "Attempted", SOLVED: "Solved" } as const;
const unmatched = (slug: string) => slug.replace(GROUP_PREFIX, "") + " (no published matches)";

function TopicOptions({ facets, selected }: { facets: LibraryResult["facets"]; selected: string[] }) {
  const tree = facets.categoryTree;
  const known = new Set(tree
    ? [...tree.ungrouped.map((c) => c.slug), ...tree.groups.flatMap((g) => g.children.map((c) => c.slug))]
    : facets.categories.map((c) => c.slug));
  const check = (slug: string, name: string) => <CheckOption key={slug} name="category" value={slug} label={name} defaultChecked={selected.includes(slug)} />;
  return (
    <>
      {selected.filter((slug) => !known.has(slug)).map((slug) => check(slug, unmatched(slug)))}
      {tree ? (
        <>
          {tree.groups.map((group) => (
            <div key={group.slug} role="group" aria-label={group.name} className="py-1">
              <p className="px-2 pt-1 pb-0.5 text-[0.6875rem] font-semibold tracking-wide text-subtle uppercase">{group.name}</p>
              {group.children.map((child) => check(child.slug, child.name))}
            </div>
          ))}
          {tree.ungrouped.length > 0 && (
            <div role="group" aria-label="Other" className="py-1">
              <p className="px-2 pt-1 pb-0.5 text-[0.6875rem] font-semibold tracking-wide text-subtle uppercase">Other</p>
              {tree.ungrouped.map((child) => check(child.slug, child.name))}
            </div>
          )}
        </>
      ) : facets.categories.map((category) => check(category.slug, category.name))}
    </>
  );
}

export function LibraryFiltersForm({ filters, facets, signedIn }: {
  filters: LibraryFilters; facets: LibraryResult["facets"]; signedIn: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const submitted = useRef<string | null>(null);
  const composing = useRef(false);
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; };

  useEffect(() => {
    // Preserve typing that happened after submission while its response was pending.
    if (!form.current || timer.current !== undefined) return;
    if (submitted.current && submitted.current !== fingerprint(form.current)) return;
    syncForm(form.current, filters);
    submitted.current = null;
  }, [filters]);

  useEffect(() => {
    const restore = () => {
      clearTimeout(timer.current);
      timer.current = undefined;
      submitted.current = null;
      if (form.current) {
        syncForm(form.current, parseLibraryFilters(Object.fromEntries(new URLSearchParams(window.location.search))));
      }
    };
    const cancelForLink = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin === window.location.origin && target.pathname === "/problems") {
        clearTimeout(timer.current);
        timer.current = undefined;
        submitted.current = null;
      }
    };
    window.addEventListener("popstate", restore);
    window.addEventListener("click", cancelForLink, true);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("popstate", restore);
      window.removeEventListener("click", cancelForLink, true);
    };
  }, []);

  function schedule() {
    cancel();
    if (composing.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      form.current?.requestSubmit();
    }, 350);
  }

  const current = values(filters);
  const loginHref = "/login?next=" + encodeURIComponent(libraryHref(filters));
  const more = Number(Boolean(filters.tag)) + Number(Boolean(filters.pattern)) + Number(filters.maxMinutes > 0);
  const durations = [...new Set([15, 30, 45, 60, 120, 240, ...(filters.maxMinutes ? [filters.maxMinutes] : [])])].sort((a, b) => a - b);
  const selectedTag = facets.tags.some((tag) => tag.slug === filters.tag) || !filters.tag;
  return (
    <Form ref={form} action="/problems" replace scroll={false} prefetch={false}
      className="relative mb-3 flex flex-wrap items-center gap-2"
      aria-label="Filter problems"
      onChange={schedule}
      onCompositionStart={() => { composing.current = true; cancel(); }}
      onCompositionEnd={() => { composing.current = false; schedule(); }}
      onSubmit={() => { cancel(); if (form.current) submitted.current = fingerprint(form.current); }}>
      <div className="relative min-w-0 flex-1 basis-56">
        <label htmlFor="library-q" className="sr-only">Search problems by title</label>
        <Search aria-hidden="true" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
        <Input id="library-q" name="q" type="search" maxLength={100} defaultValue={current.q[0] ?? ""} className="h-9 pl-9"
          placeholder="Search problems" aria-describedby="search-help" />
        <p id="search-help" className="sr-only">Results update after a short pause. You can also press Enter or Apply.</p>
      </div>
      <FilterMenu label="Difficulty" count={filters.difficulty.length}>
        {DIFFICULTIES.map((value) => <CheckOption key={value} name="difficulty" value={value} label={label(value)} defaultChecked={filters.difficulty.includes(value)} />)}
      </FilterMenu>
      <FilterMenu label="Topics" count={filters.category.length + filters.group.length}>
        <TopicOptions facets={facets} selected={filters.category} />
      </FilterMenu>
      {filters.group.map((group) => <input key={group} type="hidden" name="category" value={GROUP_PREFIX + group} />)}
      {signedIn ? (
        <FilterMenu label="Status" count={filters.completion.length + Number(filters.review)}>
          {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((value) => <CheckOption key={value} name="completion" value={value} label={STATUS_LABELS[value]} defaultChecked={filters.completion.includes(value)} />)}
          <div role="separator" className="my-1 border-t border-line" />
          <CheckOption name="review" value="1" label="Review later" defaultChecked={filters.review} />
        </FilterMenu>
      ) : (
        <Link href={loginHref} title="Sign in to filter by your progress" className={buttonStyles("secondary", "md", "h-9 gap-1.5 text-muted")}>
          <Lock aria-hidden="true" size={13} />Status<span className="sr-only"> (sign in required)</span>
        </Link>
      )}
      <FilterMenu label="More" count={more + Number(filters.sort !== "title" || filters.dir !== defaultDirection(filters.sort))}>
        <div className="space-y-3 p-1.5">
          <label className="block space-y-1 text-xs text-muted"><span>Tag</span>
            <Select name="tag" defaultValue={current.tag[0] ?? ""}>
              <option value="">Any tag</option>
              {!selectedTag && <option value={filters.tag}>{filters.tag} (no published matches)</option>}
              {facets.tags.map((tag) => <option key={tag.slug} value={tag.slug}>{tag.name}</option>)}
            </Select></label>
          <label className="block space-y-1 text-xs text-muted"><span>Pattern</span>
            <Select name="pattern" defaultValue={current.pattern[0] ?? ""}>
              <option value="">Any pattern</option>
              {filters.pattern && !facets.patterns.includes(filters.pattern) && <option value={filters.pattern}>{filters.pattern.replaceAll("-", " ")} (no published matches)</option>}
              {facets.patterns.map((pattern) => <option key={pattern} value={pattern}>{pattern.replaceAll("-", " ")}</option>)}
            </Select></label>
          <label className="block space-y-1 text-xs text-muted"><span>Maximum time</span>
            <Select name="maxMinutes" defaultValue={current.maxMinutes[0] ?? ""}>
              <option value="">Any duration</option>
              {durations.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </Select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1 text-xs text-muted"><span>Sort by</span>
              <Select name="sort" defaultValue={filters.sort}><option value="title">Title</option><option value="newest">Newest</option><option value="difficulty">Difficulty</option><option value="time">Time</option></Select></label>
            <label className="block space-y-1 text-xs text-muted"><span>Order</span>
              <Select name="dir" defaultValue={current.dir[0] ?? ""}><option value="">Default</option><option value="asc">Ascending</option><option value="desc">Descending</option></Select></label>
          </div>
        </div>
      </FilterMenu>
      <SubmitButton variant="secondary" className="h-9" pendingLabel="Searching…">Apply</SubmitButton>
    </Form>
  );
}

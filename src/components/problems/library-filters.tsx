"use client";

import Form from "next/form";
import { useEffect, useRef } from "react";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { DIFFICULTIES, libraryHref, parseLibraryFilters, type LibraryFilters } from "@/features/problems/filters";
import type { LibraryResult } from "@/features/problems/query";

function values(filters: LibraryFilters) {
  return {
    q: filters.q, difficulty: filters.difficulty, category: filters.category,
    tag: filters.tag, pattern: filters.pattern, sort: filters.sort,
    maxMinutes: filters.maxMinutes ? String(filters.maxMinutes) : "",
    completion: filters.completion, review: filters.review ? "1" : "",
  };
}
function syncForm(form: HTMLFormElement, filters: LibraryFilters) {
  for (const [name, value] of Object.entries(values(filters))) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value;
  }
}
function fingerprint(form: HTMLFormElement) {
  return JSON.stringify(Array.from(new FormData(form).entries()));
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
  const facetOptions = (options: { slug: string; name: string }[], selected: string) => (
    <>
      <option value="">All</option>
      {selected && !options.some((option) => option.slug === selected) && <option value={selected}>{selected} (no published matches)</option>}
      {options.map((option) => <option key={option.slug} value={option.slug}>{option.name}</option>)}
    </>
  );
  return (
    <Form ref={form} action="/problems" replace scroll={false} prefetch={false}
      className="mb-8 space-y-5 rounded-2xl border border-line bg-surface p-5 sm:p-7"
      aria-label="Filter problems"
      onChange={schedule}
      onCompositionStart={() => { composing.current = true; cancel(); }}
      onCompositionEnd={() => { composing.current = false; schedule(); }}
      onSubmit={() => { cancel(); if (form.current) submitted.current = fingerprint(form.current); }}>
      <div>
        <label htmlFor="library-q" className="mb-2 block text-sm font-medium">Search by title</label>
        <Input id="library-q" name="q" type="search" maxLength={100} defaultValue={current.q}
          placeholder="Try Relay Window" aria-describedby="search-help" />
        <p id="search-help" className="mt-2 text-xs leading-6 text-muted">Results update after a short pause. You can also press Enter or Apply filters.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm"><span className="block">Difficulty</span><Select name="difficulty" defaultValue={current.difficulty}><option value="">All levels</option>{DIFFICULTIES.map((value) => <option key={value} value={value}>{value[0] + value.slice(1).toLowerCase()}</option>)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Category</span><Select name="category" defaultValue={current.category}>{facetOptions(facets.categories, current.category)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Tag</span><Select name="tag" defaultValue={current.tag}>{facetOptions(facets.tags, current.tag)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Pattern</span><Select name="pattern" defaultValue={current.pattern}>{facetOptions(facets.patterns.map((pattern) => ({ slug: pattern, name: pattern.replaceAll("-", " ") })), current.pattern)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Maximum time</span><Select name="maxMinutes" defaultValue={current.maxMinutes}><option value="">Any duration</option>{[...new Set([15, 30, 45, 60, 120, 240, ...(filters.maxMinutes ? [filters.maxMinutes] : [])])].sort((a, b) => a - b).map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</Select></label>
        <label className="space-y-2 text-sm"><span className="block">Completion</span><Select name="completion" defaultValue={current.completion} disabled={!signedIn}><option value="ALL">All problems</option><option value="NOT_STARTED">Not started</option><option value="ATTEMPTED">Attempted</option><option value="SOLVED">Solved</option></Select></label>
        <label className="space-y-2 text-sm"><span className="block">Review status</span><Select name="review" defaultValue={current.review} disabled={!signedIn}><option value="">Any review status</option><option value="1">Review later</option></Select></label>
        <label className="space-y-2 text-sm"><span className="block">Sort by</span><Select name="sort" defaultValue={current.sort}><option value="title">Title A–Z</option><option value="newest">Newest published</option><option value="difficulty">Difficulty: easy first</option><option value="time">Shortest time</option></Select></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Searching…">Apply filters</SubmitButton>
        <ButtonLink href="/problems" variant="quiet" onClick={() => { cancel(); submitted.current = null; if (form.current) syncForm(form.current, parseLibraryFilters({})); }}>Clear filters</ButtonLink>
        {!signedIn && <ButtonLink variant="quiet" href={"/login?next=" + encodeURIComponent(libraryHref(filters))}>Sign in for progress</ButtonLink>}
      </div>
    </Form>
  );
}

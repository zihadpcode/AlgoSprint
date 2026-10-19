"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, CornerDownLeft, FileCode2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { difficultyText } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { ACCOUNT_NAV, PRIMARY_NAV } from "./nav-config";

const OPEN_EVENT = "algosprint:command-palette";
export function openCommandPalette() { window.dispatchEvent(new Event(OPEN_EVENT)); }

type ProblemHit = { slug: string; title: string; difficulty: string; pattern: string };
type Entry = { id: string; label: string; hint?: string; href: string; group: "Problems" | "Go to"; difficulty?: string };

const PAGES: Entry[] = [...PRIMARY_NAV, ...ACCOUNT_NAV].map(({ href, label }) => ({ id: `page:${href}`, label, href, group: "Go to" }));

function editableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) || element.closest(".monaco-editor")));
}

/** Global Cmd/Ctrl+K palette (also "/" outside text fields): jump to a page or search published problems by title. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProblemHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const listId = useId();

  const show = useCallback(() => { returnFocus.current = document.activeElement as HTMLElement | null; setOpen(true); }, []);
  const close = useCallback(() => { setOpen(false); setQuery(""); setHits([]); setActive(0); returnFocus.current?.focus?.(); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Inside Monaco, Cmd/Ctrl+K starts the editor's own chords, so leave it alone there.
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k" && !(event.target as HTMLElement | null)?.closest?.(".monaco-editor")) {
        event.preventDefault(); if (open) close(); else show();
      } else if (open && event.key === "Escape") { event.preventDefault(); close(); }
      else if (event.key === "/" && !open && !event.metaKey && !event.ctrlKey && !event.altKey && !editableTarget(event.target)) { event.preventDefault(); show(); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_EVENT, show); };
  }, [open, show, close]);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  // Debounced title search; aborted when the query changes so stale responses never win.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/problem-search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : { items: [] })
        .then((data: { items?: ProblemHit[] }) => { setHits(Array.isArray(data.items) ? data.items : []); setLoading(false); })
        .catch(() => { if (!controller.signal.aborted) { setHits([]); setLoading(false); } });
    }, 140);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, open]);

  const searching = query.trim().length >= 2;
  const visibleHits = useMemo(() => searching ? hits : [], [searching, hits]);
  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const pages = PAGES.filter((page) => !q || page.label.toLowerCase().includes(q));
    const problems: Entry[] = visibleHits.map((hit) => ({ id: `problem:${hit.slug}`, label: hit.title, hint: hit.pattern.replaceAll("-", " "), href: `/problems/${hit.slug}`, group: "Problems", difficulty: hit.difficulty }));
    const all: Entry[] = q.length >= 2 ? [...problems, ...pages, { id: "search-all", label: `Search the library for “${query.trim()}”`, href: `/problems?q=${encodeURIComponent(query.trim())}`, group: "Go to" }] : pages;
    return all;
  }, [visibleHits, query]);
  const current = Math.min(active, Math.max(entries.length - 1, 0));

  const go = (entry: Entry | undefined) => { if (!entry) return; close(); router.push(entry.href); };

  if (!open) return null;
  return <div className="fixed inset-0 z-[55] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-[2px] animate-fade-in" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(event) => { if (event.target !== input.current) event.preventDefault(); }} className="w-full max-w-xl animate-slide-up overflow-hidden rounded-xl border border-line bg-surface-raised shadow-pop">
      <div className="flex items-center gap-2.5 border-b border-line px-3.5">
        <Search aria-hidden="true" size={16} className="shrink-0 text-subtle" />
        <input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} placeholder="Search problems or jump to a page…"
          role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={entries[current] ? `${listId}-${current}` : undefined} aria-autocomplete="list"
          onBlur={() => window.setTimeout(() => { if (input.current && document.activeElement === document.body) input.current.focus(); })}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive(Math.min(current + 1, entries.length - 1)); }
            else if (event.key === "ArrowUp") { event.preventDefault(); setActive(Math.max(current - 1, 0)); }
            else if (event.key === "Enter") { event.preventDefault(); go(entries[current]); }
            else if (event.key === "Tab") event.preventDefault();
          }}
          className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-subtle" />
        <Kbd>Esc</Kbd>
      </div>
      <ul id={listId} role="listbox" aria-label="Results" className="max-h-[min(60vh,26rem)] overflow-y-auto p-1.5">
        {entries.map((entry, index) => {
          const header = index === 0 || entries[index - 1].group !== entry.group;
          return <li key={entry.id} role="presentation">
            {header && <p role="presentation" className="px-2.5 pt-2 pb-1 text-[0.6875rem] font-medium tracking-wide text-subtle uppercase">{entry.group}</p>}
            <div id={`${listId}-${index}`} role="option" aria-selected={index === current} onMouseMove={() => setActive(index)} onClick={() => go(entry)}
              className={cn("flex h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-sm", index === current ? "bg-surface-hover text-ink" : "text-muted")}>
              {entry.group === "Problems" ? <FileCode2 aria-hidden="true" size={15} className="shrink-0 text-subtle" /> : <ArrowRight aria-hidden="true" size={15} className="shrink-0 text-subtle" />}
              <span className="min-w-0 flex-1 truncate">{entry.label}{entry.hint && <span className="ml-2 text-xs text-subtle">{entry.hint}</span>}</span>
              {entry.difficulty && <span className={cn("text-xs font-medium", difficultyText(entry.difficulty))}>{entry.difficulty[0] + entry.difficulty.slice(1).toLowerCase()}</span>}
              {index === current && <CornerDownLeft aria-hidden="true" size={13} className="text-subtle" />}
            </div>
          </li>;
        })}
        {!entries.length && <li className="px-3 py-8 text-center text-sm text-subtle">{searching && loading ? "Searching…" : "No matches. Try another word."}</li>}
      </ul>
      <div className="flex items-center gap-4 border-t border-line px-3.5 py-2 text-[0.6875rem] text-subtle">
        <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
        <span className="inline-flex items-center gap-1"><Kbd>↵</Kbd> open</span>
        <span role="status" aria-live="polite" className="ml-auto">{searching && loading ? "Searching…" : searching ? `${visibleHits.length} problem${visibleHits.length === 1 ? "" : "s"}` : ""}</span>
      </div>
    </div>
  </div>;
}

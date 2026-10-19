"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact popover menu built on <details>: it opens, closes and submits its checkboxes with the surrounding form
 * without JavaScript. Script only adds Escape and click-outside dismissal.
 */
export function FilterMenu({ label, count, hint, children, className }: {
  label: string; count: number; hint?: string; children: ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const node = ref.current;
      if (!node?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        node.open = false;
        node.querySelector("summary")?.focus();
        return;
      }
      if (event.target instanceof Node && !node.contains(event.target)) node.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  return (
    <details ref={ref} className={cn("group static sm:relative", className)}>
      <summary title={hint}
        className={cn("flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors select-none [&::-webkit-details-marker]:hidden",
          count ? "border-accent/40 bg-accent/10 text-accent" : "border-line bg-surface-raised text-ink hover:border-line-strong hover:bg-surface-hover")}>
        {label}
        {count > 0 && <span className="rounded bg-accent-solid/80 px-1.5 text-[0.6875rem] leading-4 font-semibold text-white tabular-nums">{count}</span>}
        <ChevronDown aria-hidden="true" size={14} className="text-subtle transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 left-0 z-30 mt-1.5 max-h-80 animate-fade-in overflow-y-auto rounded-lg border border-line bg-surface-raised p-1.5 shadow-pop sm:right-auto sm:w-64">
        {children}
      </div>
    </details>
  );
}

/** One checkbox row inside a FilterMenu. Native checkbox: label click, Space and form submission just work. */
export function CheckOption({ name, value, label, defaultChecked }: {
  name: string; value: string; label: string; defaultChecked: boolean;
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-sm hover:bg-surface-hover has-[:focus-visible]:bg-surface-hover">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked}
        className="size-3.5 shrink-0 rounded border-line-strong bg-canvas accent-accent-solid" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
    </label>
  );
}

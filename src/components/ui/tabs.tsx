"use client";

import { createContext, useContext, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: ReactNode; content: ReactNode; badge?: ReactNode };

const TabPanelActiveContext = createContext(true);
export function useTabPanelActive() { return useContext(TabPanelActiveContext); }

/** Accessible tabs (WAI-ARIA tabs pattern): arrow keys, Home and End move between tabs; panels stay mounted
 *  so editor state, drafts and scroll position inside a panel survive switching. */
export function Tabs({ items, label, defaultTab, className, listClassName, panelClassName, onChange }: {
  items: TabItem[]; label: string; defaultTab?: string; className?: string; listClassName?: string; panelClassName?: string; onChange?: (id: string) => void;
}) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const parentActive = useTabPanelActive();
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number) => {
    const item = items[(index + items.length) % items.length];
    setActive(item.id); onChange?.(item.id);
    refs.current[(index + items.length) % items.length]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === "ArrowRight") { event.preventDefault(); select(index + 1); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); select(index - 1); }
    else if (event.key === "Home") { event.preventDefault(); select(0); }
    else if (event.key === "End") { event.preventDefault(); select(items.length - 1); }
  };
  return <div className={cn("flex min-h-0 flex-col", className)}>
    <div role="tablist" aria-label={label} className={cn("flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2", listClassName)}>
      {items.map((item, index) => {
        const selected = item.id === active;
        return <button key={item.id} ref={(node) => { refs.current[index] = node; }} type="button" role="tab" id={`${base}-tab-${item.id}`} aria-selected={selected} aria-controls={`${base}-panel-${item.id}`} tabIndex={selected ? 0 : -1}
          onClick={() => { setActive(item.id); onChange?.(item.id); }} onKeyDown={(event) => onKeyDown(event, index)}
          className={cn("relative inline-flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-sm font-medium transition-colors", selected ? "text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent" : "text-muted hover:text-ink")}>
          {item.label}{item.badge}
        </button>;
      })}
    </div>
    {items.map((item) => <div key={item.id} role="tabpanel" id={`${base}-panel-${item.id}`} aria-labelledby={`${base}-tab-${item.id}`} hidden={item.id !== active} tabIndex={0} className={cn("min-h-0 flex-1 focus-visible:outline-offset-[-2px]", panelClassName)}>
      <TabPanelActiveContext.Provider value={parentActive && item.id === active}>{item.content}</TabPanelActiveContext.Provider>
    </div>)}
  </div>;
}

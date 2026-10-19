"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonStyles } from "@/components/ui/button";

/**
 * A small disclosure popover. The panel stays mounted while closed (hidden) so state and effects inside it, such as
 * device-draft persistence, keep running. Escape and outside clicks close it and return focus to the trigger.
 */
export function Popover({ label, icon, text, children, align = "end", direction = "down", className, panelClassName, badge }: {
  label: string; icon: ReactNode; text?: string; children: ReactNode; align?: "start" | "end"; direction?: "up" | "down"; className?: string; panelClassName?: string; badge?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div ref={root} className={cn("relative", className)} onKeyDown={(event) => {
    if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={id} aria-label={text ? undefined : label} title={label}
      onClick={() => setOpen((current) => !current)} className={buttonStyles("quiet", text ? "sm" : "icon", cn("relative", !text && "size-8", open && "bg-surface-hover text-ink"))}>
      {icon}{text && <span>{text}</span>}{badge}
    </button>
    <div id={id} role="group" aria-label={label} hidden={!open}
      className={cn("absolute z-30 w-[min(22rem,calc(100vw-2rem))] animate-fade-in rounded-lg border border-line bg-surface-raised p-3 shadow-pop", align === "end" ? "right-0" : "left-0", direction === "down" ? "top-full mt-1.5" : "bottom-full mb-1.5", panelClassName)}>
      {children}
    </div>
  </div>;
}

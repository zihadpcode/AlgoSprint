"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { openCommandPalette } from "./command-palette";
import { PRIMARY_NAV, isActive } from "./nav-config";

export function PrimaryLinks() {
  const pathname = usePathname();
  return <nav aria-label="Main navigation" className="hidden items-center gap-0.5 md:flex">
    {PRIMARY_NAV.map(({ href, label }) => {
      const active = isActive(pathname, href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={cn("relative inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors", active ? "text-ink" : "text-muted hover:bg-surface-hover hover:text-ink")}>
        {label}
        {active && <span aria-hidden="true" className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full bg-accent" />}
      </Link>;
    })}
  </nav>;
}

const noSubscription = () => () => {};

export function SearchTrigger() {
  const mac = useSyncExternalStore(noSubscription, () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), () => true);
  return <button type="button" onClick={openCommandPalette} aria-label="Search problems and pages" aria-keyshortcuts="Control+K Meta+K"
    className="group inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm text-subtle transition-colors hover:border-line-strong hover:text-muted sm:w-56 lg:w-64">
    <Search aria-hidden="true" size={15} />
    <span className="hidden flex-1 text-left sm:inline">Search…</span>
    <span className="hidden items-center gap-0.5 sm:inline-flex"><Kbd>{mac ? "⌘" : "Ctrl"}</Kbd><Kbd>K</Kbd></span>
  </button>;
}

/** Small-screen menu: the primary links in a sheet under the bar. */
export function MobileNav() {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- setOpen only closes
  return <div className="md:hidden">
    <button ref={trigger} type="button" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}
      className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-hover hover:text-ink">
      {open ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
    </button>
    {open && <nav id="mobile-nav" aria-label="Main navigation" className="fixed inset-x-0 top-14 z-40 animate-fade-in border-b border-line bg-canvas/95 p-3 backdrop-blur">
      <ul className="grid gap-1">{PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return <li key={href}><Link href={href} aria-current={active ? "page" : undefined} className={cn("flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium", active ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-hover hover:text-ink")}><Icon aria-hidden="true" size={17} />{label}</Link></li>;
      })}</ul>
    </nav>}
  </div>;
}

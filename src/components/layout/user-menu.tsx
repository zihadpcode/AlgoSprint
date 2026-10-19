"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutForm } from "@/components/auth/sign-out-form";
import { ACCOUNT_NAV, ADMIN_NAV, isActive } from "./nav-config";

function initials(name: string) {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Profile dropdown (menu button pattern): Escape and outside clicks close it, focus returns to the trigger. */
export function UserMenu({ name, email, admin = false }: { name: string; email?: string | null; admin?: boolean }) {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = admin ? [...ACCOUNT_NAV, ADMIN_NAV] : ACCOUNT_NAV;
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); return; }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const links = [...(root.current?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])];
      if (!links.length) return;
      event.preventDefault();
      const index = links.indexOf(document.activeElement as HTMLElement);
      links[(index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length]?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- setOpen is recreated per render but only closes
  return <div ref={root} className="relative">
    <button ref={trigger} type="button" aria-haspopup="true" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg pr-1.5 pl-1 text-muted transition-colors hover:bg-surface-hover hover:text-ink">
      <span aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-zinc-700 to-zinc-800 text-[0.6875rem] font-semibold text-ink ring-1 ring-line-strong">{initials(name)}</span>
      <span className="sr-only">Account menu for {name}</span>
      <ChevronDown aria-hidden="true" size={14} className={cn("transition-transform", open && "rotate-180")} />
    </button>
    {open && <div id={menuId} className="absolute right-0 z-50 mt-2 w-60 animate-slide-up rounded-xl border border-line bg-surface-raised p-1.5 shadow-pop">
      <div className="border-b border-line px-2.5 pt-1.5 pb-2.5"><p className="truncate text-sm font-medium">{name}</p>{email && <p className="truncate text-xs text-subtle">{email}</p>}</div>
      <ul className="py-1.5">{items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return <li key={href}><Link data-menu-item href={href} aria-current={active ? "page" : undefined} className={cn("flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm", active ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-hover hover:text-ink")}><Icon aria-hidden="true" size={15} />{label}</Link></li>;
      })}</ul>
      <div className="border-t border-line pt-1.5"><SignOutForm menuItem /></div>
    </div>}
  </div>;
}

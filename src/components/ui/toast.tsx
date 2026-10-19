"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "info" | "warning" | "error";
type ToastItem = { id: number; tone: ToastTone; title: string; description?: string };
const EVENT = "algosprint:toast";
let nextId = 1;

/** Show a short, non-blocking notification. Safe to call from any client component or event handler. */
export function toast(title: string, options: { tone?: ToastTone; description?: string } = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastItem>(EVENT, { detail: { id: nextId++, tone: options.tone ?? "info", title, description: options.description } }));
}

const icons = { success: CheckCircle2, info: Info, warning: TriangleAlert, error: XCircle };
const tones = { success: "text-success", info: "text-info", warning: "text-warm", error: "text-danger" };

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const add = (event: Event) => {
      const item = (event as CustomEvent<ToastItem>).detail;
      setItems((current) => [...current.slice(-3), item]);
      window.setTimeout(() => setItems((current) => current.filter((entry) => entry.id !== item.id)), item.tone === "error" ? 7000 : 4500);
    };
    window.addEventListener(EVENT, add);
    return () => window.removeEventListener(EVENT, add);
  }, []);
  // Polite live region: screen readers announce the toast without moving focus.
  return <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
    {items.map((item) => {
      const Icon = icons[item.tone];
      return <div key={item.id} role={item.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex animate-slide-up items-start gap-3 rounded-lg border border-line bg-surface-raised p-3 shadow-pop">
        <Icon aria-hidden="true" size={18} className={cn("mt-0.5 shrink-0", tones[item.tone])} />
        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title}</p>{item.description && <p className="mt-0.5 text-xs leading-5 text-muted">{item.description}</p>}</div>
        <button type="button" aria-label="Dismiss notification" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="rounded p-0.5 text-subtle hover:bg-surface-hover hover:text-ink"><X aria-hidden="true" size={14} /></button>
      </div>;
    })}
  </div>;
}

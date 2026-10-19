"use client";

import { useEffect, useRef, useState } from "react";
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
    const add = (event: Event) => setItems((current) => [...current.slice(-3), (event as CustomEvent<ToastItem>).detail]);
    window.addEventListener(EVENT, add);
    return () => window.removeEventListener(EVENT, add);
  }, []);
  const dismiss = (id: number) => setItems((current) => current.filter((entry) => entry.id !== id));
  // Each toast is its own status/alert region; the container is not a live region, so nothing is announced twice.
  return <div className="pointer-events-none fixed top-16 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
    {items.map((item) => <Toast key={item.id} item={item} onDismiss={() => dismiss(item.id)} />)}
  </div>;
}

/** Auto-dismisses after a few seconds, but the timer pauses while the pointer or keyboard focus is on the toast. */
function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.tone === "error" ? 8000 : 5000);
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => dismissRef.current(), remaining.current);
    return () => { window.clearTimeout(timer); remaining.current -= Date.now() - started; };
  }, [paused]);
  const Icon = icons[item.tone];
  return <div role={item.tone === "error" ? "alert" : "status"} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    className="pointer-events-auto flex animate-slide-up items-start gap-3 rounded-lg border border-line bg-surface-raised p-3 shadow-pop">
    <Icon aria-hidden="true" size={18} className={cn("mt-0.5 shrink-0", tones[item.tone])} />
    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title}</p>{item.description && <p className="mt-0.5 text-xs leading-5 text-muted">{item.description}</p>}</div>
    <button type="button" aria-label="Dismiss notification" onClick={onDismiss} className="rounded p-0.5 text-subtle hover:bg-surface-hover hover:text-ink"><X aria-hidden="true" size={14} /></button>
  </div>;
}

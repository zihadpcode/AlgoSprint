"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SPLIT_DEFAULT, SPLIT_MAX, SPLIT_MIN, ratioForKey, ratioForPointer, readStoredRatio, writeStoredRatio } from "./split-ratio";

type WorkspaceLayout = "split" | "editor";
type LayoutValue = { layout: WorkspaceLayout; toggleLayout: () => void };
const LayoutContext = createContext<LayoutValue | null>(null);
/** Layout controls for panels rendered inside a SplitPane. Returns null outside one (for example in unit tests). */
export function useWorkspaceLayout() { return useContext(LayoutContext); }

/**
 * Problem panel (left) and editor panel (right). From the lg breakpoint they sit side by side with a draggable,
 * keyboard-resizable divider; below it they stack and the page scrolls naturally.
 */
export function SplitPane({ left, right, leftLabel = "Problem", rightLabel = "Code editor and results" }: { left: ReactNode; right: ReactNode; leftLabel?: string; rightLabel?: string }) {
  const [ratio, setRatio] = useState(SPLIT_DEFAULT);
  const [layout, setLayout] = useState<WorkspaceLayout>("split");
  const [dragging, setDragging] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const leftId = useId();
  // Read the saved ratio after hydration so server and client markup agree.
  useEffect(() => {
    const saved = (() => { try { return window.localStorage; } catch { return null; } })();
    const next = readStoredRatio(saved);
    queueMicrotask(() => setRatio(next));
  }, []);
  const commit = useCallback((next: number) => {
    setRatio(next);
    try { writeStoredRatio(window.localStorage, next); } catch { /* Preference only. */ }
  }, []);
  const toggleLayout = useCallback(() => setLayout((current) => current === "split" ? "editor" : "split"), []);
  const value = useMemo(() => ({ layout, toggleLayout }), [layout, toggleLayout]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = ratioForKey(event.key, ratio, event.shiftKey);
    if (next === null) return;
    event.preventDefault(); commit(next);
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); setDragging(true);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging || !container.current) return;
    const rect = container.current.getBoundingClientRect();
    setRatio(ratioForPointer(event.clientX, rect.left, rect.width));
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId); setDragging(false);
    if (container.current) {
      const rect = container.current.getBoundingClientRect();
      commit(ratioForPointer(event.clientX, rect.left, rect.width));
    }
  }
  const editorOnly = layout === "editor";
  return <LayoutContext.Provider value={value}>
    <div ref={container} style={{ "--split": `${ratio}%` } as CSSProperties}
      className={cn("flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-row lg:overflow-hidden", dragging && "select-none")}>
      <section id={leftId} aria-label={leftLabel} hidden={editorOnly}
        className="flex min-w-0 flex-col border-b border-line bg-surface lg:min-h-0 lg:w-(--split) lg:shrink-0 lg:border-b-0">
        {left}
      </section>
      {!editorOnly && <div role="separator" aria-orientation="vertical" aria-label="Resize problem and editor panels" aria-controls={leftId}
        aria-valuenow={Math.round(ratio)} aria-valuemin={SPLIT_MIN} aria-valuemax={SPLIT_MAX} aria-valuetext={`Problem panel ${Math.round(ratio)} percent wide`} tabIndex={0}
        onKeyDown={onKeyDown} onDoubleClick={() => commit(SPLIT_DEFAULT)}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        className={cn("group relative hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-line transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none lg:block", dragging && "bg-accent")}>
        <span aria-hidden="true" className="absolute inset-y-0 -inset-x-1.5" />
      </div>}
      <section aria-label={rightLabel} className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
        {right}
      </section>
    </div>
  </LayoutContext.Provider>;
}

import { Braces, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

// An original, fixed illustration for the landing page, not a database record.
const RELAY_LOADS = [3, 1, 5, 2, 6, 1] as const;
const WINDOW_START = 2;
const WINDOW_WIDTH = 3;
const EXAMPLE_CODE = `const loads = [3, 1, 5, 2, 6, 1];
const width = 3;

// Which three consecutive relays
// carry the largest total load?`;

export function PracticePreview() {
  return (
    <section
      id="practice-preview"
      aria-labelledby="preview-title"
      className="preview-surface min-w-0 rounded-3xl border border-line"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
        <span className="inline-flex items-center gap-2 font-mono text-sm text-muted">
          <Braces aria-hidden="true" size={18} />
          A closer look
        </span>
        <span className="text-xs text-muted">Static practice example</span>
      </div>
      <div className="p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-accent">
            Easy
          </span>
          <span className="text-muted">Arrays / Sliding window</span>
        </div>
        <h2 id="preview-title" className="text-2xl font-semibold tracking-tight">Relay Window</h2>
        <p className="mt-3 leading-7 text-muted">
          A relay station records a load for each time slot. Find the largest
          total load across any three consecutive slots.
        </p>
        <figure className="mt-6">
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2" aria-hidden="true">
            {RELAY_LOADS.map((load, index) => {
              const inWindow = index >= WINDOW_START && index < WINDOW_START + WINDOW_WIDTH;
              return (
                <div
                  key={index}
                  className={cn(
                    "grid aspect-square place-items-center rounded-lg border border-line bg-canvas font-mono text-lg text-muted sm:text-xl",
                    inWindow && "border-accent bg-accent/15 font-semibold text-accent",
                  )}
                >
                  {load}
                </div>
              );
            })}
          </div>
          <figcaption className="mt-3 flex items-start gap-2 text-sm leading-6 text-accent">
            <ScanLine aria-hidden="true" size={18} className="mt-1 shrink-0" />
            <span>
              <span className="sr-only">Loads: 3, 1, 5, 2, 6, 1. </span>
              Best window: slots 3–5. Total: 5 + 2 + 6 = 13.
            </span>
          </figcaption>
        </figure>
        <div className="mt-6 min-w-0 rounded-xl border border-line bg-canvas">
          <div className="border-b border-line px-4 py-2.5 font-mono text-xs text-muted">
            relay-window.ts · read-only
          </div>
          <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-7 text-ink">
            <code>{EXAMPLE_CODE}</code>
          </pre>
        </div>
        <p className="mt-5 border-l-2 border-warm pl-4 text-sm leading-6 text-muted">
          A question to carry with you: when the window moves one slot, which values actually change?
        </p>
      </div>
    </section>
  );
}

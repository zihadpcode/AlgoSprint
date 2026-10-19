import type { ReactNode } from "react";
import { CheckCircle2, ChevronRight, Lightbulb, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

// An original, fixed illustration of the problem workspace, not a database record. Decorative panes are hidden
// from assistive technology; the figure caption carries the same information as text.
const LOADS = [3, 1, 5, 2, 6, 1] as const;
const WINDOW_START = 2;
const WINDOW_WIDTH = 3;

const kw = "text-lilac";
const fn = "text-info";
const num = "text-warm";
const com = "text-subtle";
const CODE: { n: number; line: ReactNode }[] = [
  { n: 1, line: <><span className={kw}>function</span> <span className={fn}>bestWindow</span>(loads, width) {"{"}</> },
  { n: 2, line: <>{"  "}<span className={kw}>let</span> sum = loads.<span className={fn}>slice</span>(<span className={num}>0</span>, width).<span className={fn}>reduce</span>((a, b) =&gt; a + b, <span className={num}>0</span>);</> },
  { n: 3, line: <>{"  "}<span className={kw}>let</span> best = sum;</> },
  { n: 4, line: <>{"  "}<span className={kw}>for</span> (<span className={kw}>let</span> i = width; i &lt; loads.length; i++) {"{"}</> },
  { n: 5, line: <>{"    "}<span className={com}>{"// slide: add the new slot, drop the old one"}</span></> },
  { n: 6, line: <>{"    "}sum += loads[i] - loads[i - width];</> },
  { n: 7, line: <>{"    "}best = Math.<span className={fn}>max</span>(best, sum);</> },
  { n: 8, line: <>{"  }"}</> },
  { n: 9, line: <>{"  "}<span className={kw}>return</span> best;</> },
  { n: 10, line: <>{"}"}</> },
];

export function WorkspacePreview() {
  return (
    <figure id="workspace-preview" className="min-w-0">
      <div aria-hidden="true" className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-pop">
        <div className="flex h-10 items-center gap-3 border-b border-line bg-surface-raised px-3">
          <span className="flex gap-1.5"><i className="size-2.5 rounded-full bg-line-strong" /><i className="size-2.5 rounded-full bg-line-strong" /><i className="size-2.5 rounded-full bg-line-strong" /></span>
          <span className="truncate font-mono text-xs text-muted">relay-window</span>
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-subtle sm:inline-flex"><Kbd>Ctrl</Kbd><Kbd>K</Kbd> search</span>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 space-y-3 border-b border-line p-4 lg:border-r lg:border-b-0">
            <div className="flex flex-wrap items-center gap-2"><Badge tone="success">Easy</Badge><span className="text-xs text-subtle">Arrays · Sliding window</span></div>
            <p className="text-sm font-semibold">Relay Window</p>
            <p className="text-xs leading-5 text-muted">A relay station records a load for each time slot. Find the largest total load across any three consecutive slots.</p>
            <div className="grid grid-cols-6 gap-1.5">
              {LOADS.map((load, index) => {
                const inWindow = index >= WINDOW_START && index < WINDOW_START + WINDOW_WIDTH;
                return <div key={index} className={cn("grid aspect-square place-items-center rounded-md border font-mono text-sm", inWindow ? "border-accent bg-accent/15 font-semibold text-accent" : "border-line bg-canvas text-muted")}>{load}</div>;
              })}
            </div>
            <p className="flex items-start gap-2 rounded-md border border-line bg-canvas p-2.5 text-xs leading-5 text-muted"><Lightbulb size={14} className="mt-0.5 shrink-0 text-warm" />Hint 1 of 3: when the window moves one slot, which values actually change?</p>
          </div>
          <div className="min-w-0">
            <div className="flex h-9 items-center justify-between border-b border-line px-3 text-xs">
              <span className="font-mono text-muted">solution.js</span>
              <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-accent-solid px-2 font-medium text-white"><Play size={11} />Run</span>
            </div>
            <pre className="overflow-hidden bg-canvas py-3 font-mono text-[0.75rem] leading-6 text-ink">
              <code>{CODE.map(({ n, line }) => <span key={n} className="flex"><span className="w-9 shrink-0 pr-3 text-right text-subtle select-none">{n}</span><span className="whitespace-pre">{line}</span></span>)}</code>
            </pre>
            <div className="border-t border-line bg-surface p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium"><CheckCircle2 size={14} className="text-success" />3 of 3 examples passed</p>
              <ul className="space-y-1 font-mono text-xs text-muted">
                {["[3, 1, 5, 2, 6, 1], 3  →  13", "[4, 4, 4], 2  →  8", "[7], 1  →  7"].map((row) => <li key={row} className="flex items-center gap-2"><ChevronRight size={12} className="text-success" />{row}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        Example of the problem workspace. The problem Relay Window, an easy sliding-window challenge, sits beside a JavaScript editor.
        For the loads 3, 1, 5, 2, 6, 1 and a window of three, the best total is 5 + 2 + 6 = 13, and all three visible examples pass.
      </figcaption>
    </figure>
  );
}

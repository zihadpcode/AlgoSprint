"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Maximize2, Minimize2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/loading-state";
import { Snippet, formatValue } from "@/components/workspace/snippet";
import { cn } from "@/lib/utils";
import { verdictLabels, type ExecutionResult, type Verdict } from "@/features/submissions/contracts";

export type EditorExample = { position: number; input: unknown; output: unknown; explanation: string };
export type DrawerTab = "cases" | "custom" | "result";

export function useDrawerState(initial: DrawerTab = "cases") {
  const [tab, setTab] = useState<DrawerTab>(initial);
  const [open, setOpen] = useState(true);
  const [tall, setTall] = useState(false);
  return { tab, setTab, open, setOpen, tall, setTall };
}
export type DrawerState = ReturnType<typeof useDrawerState>;

export function verdictTone(status: Verdict): "success" | "warm" | "danger" {
  return status === "ACCEPTED" ? "success" : status === "WRONG_ANSWER" || status === "TIME_LIMIT" || status === "MEMORY_LIMIT" ? "warm" : "danger";
}
const toneText = { success: "text-success", warm: "text-warm", danger: "text-danger" } as const;



/** Bottom drawer of the editor panel: visible test cases, optional custom input, and the latest result. */
export function ExecutionPanels({ examples, available = false, result, pending = false, custom, drawer }: {
  examples: EditorExample[]; available?: boolean; result?: ExecutionResult; pending?: boolean; custom?: ReactNode; drawer?: DrawerState;
}) {
  const own = useDrawerState();
  const { tab, setTab, open, setOpen, tall, setTall } = drawer ?? own;
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs: { id: DrawerTab; label: string }[] = [{ id: "cases", label: "Test cases" }, ...(custom ? [{ id: "custom" as const, label: "Custom input" }] : []), { id: "result", label: "Result" }];
  const active = tabs.some((item) => item.id === tab) ? tab : "cases";
  const choose = (index: number) => { const item = tabs[(index + tabs.length) % tabs.length]; setTab(item.id); setOpen(true); refs.current[(index + tabs.length) % tabs.length]?.focus(); };
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === "ArrowRight") { event.preventDefault(); choose(index + 1); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); choose(index - 1); }
    else if (event.key === "Home") { event.preventDefault(); choose(0); }
    else if (event.key === "End") { event.preventDefault(); choose(tabs.length - 1); }
  };
  const headline = result ? <span className={cn("ml-1 inline-flex items-center gap-1 text-xs font-semibold", toneText[verdictTone(result.status)])}>
    {result.status === "ACCEPTED" ? <CheckCircle2 aria-hidden="true" size={13} /> : <XCircle aria-hidden="true" size={13} />}{result.passedCount}/{result.totalCount}</span> : null;
  return <div className={cn("flex shrink-0 flex-col border-t border-line bg-surface", open && (tall ? "h-[22rem] max-h-[60dvh]" : "h-56"))}>
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-2">
      <div role="tablist" aria-label="Test and result panels" className="flex items-center overflow-x-auto">
        {tabs.map((item, index) => {
          const selected = open && item.id === active;
          return <button key={item.id} ref={(node) => { refs.current[index] = node; }} type="button" role="tab" id={`${base}-tab-${item.id}`} aria-selected={selected} aria-controls={`${base}-panel-${item.id}`} tabIndex={item.id === active ? 0 : -1}
            onClick={() => { setTab(item.id); setOpen(true); }} onKeyDown={(event) => onKeyDown(event, index)}
            className={cn("relative inline-flex h-9 shrink-0 items-center px-2.5 text-[0.8125rem] font-medium transition-colors", selected ? "text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent" : "text-muted hover:text-ink")}>
            {item.label}{item.id === "result" && !pending && headline}
            {item.id === "result" && pending && <span aria-hidden="true" className="ml-1.5 size-1.5 rounded-full bg-accent motion-safe:animate-pulse" />}
          </button>;
        })}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {open && <button type="button" aria-pressed={tall} aria-label={tall ? "Shrink results panel" : "Enlarge results panel"} title={tall ? "Shrink panel" : "Enlarge panel"} onClick={() => setTall(!tall)} className="grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-hover hover:text-ink">
          {tall ? <Minimize2 aria-hidden="true" size={14} /> : <Maximize2 aria-hidden="true" size={14} />}</button>}
        <button type="button" aria-expanded={open} aria-label={open ? "Collapse results panel" : "Expand results panel"} title={open ? "Collapse panel" : "Expand panel"} onClick={() => setOpen(!open)} className="grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-hover hover:text-ink">
          {open ? <ChevronDown aria-hidden="true" size={15} /> : <ChevronUp aria-hidden="true" size={15} />}</button>
      </div>
    </div>
    {tabs.map((item) => <div key={item.id} role="tabpanel" id={`${base}-panel-${item.id}`} aria-labelledby={`${base}-tab-${item.id}`} hidden={!open || item.id !== active} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto p-3 focus-visible:outline-offset-[-2px]">
      {item.id === "cases" ? <TestCases examples={examples} /> : item.id === "custom" ? custom : <ResultView examples={examples} available={available} result={result} pending={pending} />}
    </div>)}
  </div>;
}

function TestCases({ examples }: { examples: EditorExample[] }) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, examples.length - 1));
  const example = examples[index];
  return <section aria-label="Test cases" className="space-y-3">
    {example ? <>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose a visible test case">
        {examples.map((item, position) => <button key={item.position} type="button" aria-pressed={position === index} onClick={() => setSelected(position)}
          className={cn("h-7 rounded-md border px-2.5 text-xs font-medium transition-colors", position === index ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-muted hover:border-line-strong hover:text-ink")}>Case {position + 1}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Snippet label="Input" ariaLabel={`Test example ${index + 1} input`} code={formatValue(example.input)} />
        <Snippet label="Expected output" ariaLabel={`Test example ${index + 1} expected output`} code={formatValue(example.output)} />
      </div>
      {example.explanation && <p className="text-xs leading-5 text-muted">{example.explanation}</p>}
      <p className="text-xs text-subtle">These are the public examples. Hidden tests are only used when you submit.</p>
    </> : <p className="text-sm text-muted">No public examples are available for this problem.</p>}
  </section>;
}

function ResultView({ examples, available, result, pending }: { examples: EditorExample[]; available: boolean; result?: ExecutionResult; pending: boolean }) {
  if (pending) return <div role="status" aria-busy="true" className="space-y-3" aria-label="Running">
    <p className="sr-only">Running your code…</p>
    <Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-64 max-w-full" />
    <div className="space-y-2 pt-1">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
  </div>;
  const tone = result ? verdictTone(result.status) : null;
  return <div className="space-y-4">
    <section aria-label="Output" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={cn("text-base font-semibold", tone ? toneText[tone] : "text-muted")}>{result ? verdictLabels[result.status] : available ? "Ready to run" : "Execution unavailable"}</h3>
        {result && <span className="text-sm text-muted tabular-nums">{result.passedCount} / {result.totalCount} passed</span>}
      </div>
      <p className="text-xs leading-5 text-muted">{result ? `${result.passedCount} of ${result.totalCount} tests passed. ${result.mode === "RUN" ? "Visible tests only; this is not a full submission verdict." : "Full suite submission; hidden details are withheld."}` : "No output yet."}</p>
      {result?.status === "INTERNAL_ERROR" && <p className="text-xs text-warm">The service could not complete evaluation. This does not establish whether your solution is correct.</p>}
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted">
        <div><dt className="text-subtle">Runtime</dt><dd className="mt-0.5 tabular-nums text-ink">{result?.runtimeMs == null ? "Not measured" : `${result.runtimeMs} ms (slowest test)`}</dd></div>
        <div><dt className="text-subtle">Memory</dt><dd className="mt-0.5 tabular-nums text-ink">{result?.memoryKb == null ? "Not measured" : `${result.memoryKb} KB (peak test)`}</dd></div>
      </dl>
      {result && <p className="text-xs break-all text-subtle">{result.browser ? "Ran in your browser on the public examples. Nothing was saved; runtime is wall-clock time on your machine." : `Saved attempt: ${result.id}${result.problemRevision !== undefined ? ` · Problem revision ${result.problemRevision}` : ""}`}</p>}
    </section>
    <section aria-label="Test results" className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-subtle uppercase">Test results</h3>
      {result ? result.mode === "SUBMIT" ? <p className="text-sm leading-6 text-muted">Only the summary is shown for submissions. Use Run to inspect output and errors without revealing hidden inputs.</p> :
        <ol className="space-y-1.5">{result.cases.map((test, index) => <li key={test.position}>
          <details className="group rounded-lg border border-line bg-canvas open:bg-surface-raised">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm marker:hidden [&::-webkit-details-marker]:hidden">
              {test.status === "ACCEPTED" ? <CheckCircle2 aria-hidden="true" size={15} className="text-success" /> : <XCircle aria-hidden="true" size={15} className={toneText[verdictTone(test.status)]} />}
              <span className="font-medium">Visible test {index + 1} · {verdictLabels[test.status]}</span>
              <span className="ml-auto text-xs text-subtle tabular-nums">{test.runtimeMs == null ? "" : `${test.runtimeMs} ms`}</span>
            </summary>
            <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
              <Snippet label="Input" code={formatValue(test.input)} />
              <Snippet label="Expected output" code={formatValue(test.expected)} />
              <Snippet label="Actual output (up to 4,000 characters)" code={test.stdout || "(no output)"} />
              {test.diagnostic && <Snippet label="Errors / console logs (up to 4,000 characters)" code={test.diagnostic} tone="danger" />}
              {test.status === "WRONG_ANSWER" && <p className="text-xs leading-5 text-muted sm:col-span-2">The returned JSON did not match the expected value. Check types and array order; return the result from the named function.</p>}
            </div>
          </details>
        </li>)}</ol> : <p className="text-sm leading-6 text-muted">Not run. The {examples.length ? "public examples are listed under Test cases" : "problem has no public examples"}; they are expectations, not execution results.</p>}
    </section>
  </div>;
}

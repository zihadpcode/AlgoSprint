"use client";

import { useId, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-state";
import { Snippet } from "@/components/workspace/snippet";
import { runInBrowser } from "@/features/submissions/browser-runner";
import type { RunnerSignature } from "@/features/submissions/contracts";
import { customRunOutcome, defaultCustomInput, parseCustomInput, type CustomRunOutcome } from "./custom-input";

// JavaScript only. The input never leaves the browser: it goes to the same Web Worker that runs the visible tests,
// and nothing here imports or calls a server action.
export function CustomInputPanel({ code, signature, firstExample, validCode }: { code: string; signature: RunnerSignature; firstExample?: unknown; validCode: boolean }) {
  const [text, setText] = useState(() => defaultCustomInput(signature.keys, firstExample));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<{ code: string; value: CustomRunOutcome } | null>(null);
  const busy = useRef(false);
  const id = useId();
  function run() {
    if (busy.current) return;
    const check = parseCustomInput(text, signature.keys);
    if (!check.ok) { setError(check.error); setOutcome(null); return; }
    setError(""); busy.current = true; setPending(true);
    const captured = code;
    runInBrowser({ entryPoint: signature.entryPoint, keys: signature.keys, code, cases: [{ position: 0, input: check.input, expected: null }] })
      .then((result) => setOutcome({ code: captured, value: customRunOutcome(result.cases[0]) }))
      .catch(() => setOutcome({ code: captured, value: { kind: "error", message: "The browser could not run this code. Reload the page and try again.", console: "" } }))
      .finally(() => { busy.current = false; setPending(false); });
  }
  return <section aria-label="Custom input" className="grid gap-3 lg:grid-cols-2">
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-medium text-muted">Arguments as JSON · keys: <code className="text-ink">{signature.keys.join(", ")}</code></label>
      <textarea id={id} data-shortcut-scope="custom" value={text} rows={5} spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={`${id}-help`}
        onChange={(event) => { setText(event.target.value); setError(""); }}
        onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); run(); } }}
        className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[0.8125rem] leading-6 text-ink transition-colors hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 aria-invalid:border-danger" />
      <p id={`${id}-help`} className="text-xs leading-5 text-subtle">Runs in your browser only; nothing is sent to the server or saved. Limit 64,000 bytes. No expected output is compared.</p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <Button size="sm" variant="secondary" disabled={pending || !validCode} onClick={run}><Play aria-hidden="true" size={13} />Run with custom input</Button>
    </div>
    <div className="min-w-0 space-y-2" role="status" aria-live="polite" aria-busy={pending}>
      {pending ? <div className="space-y-2"><p className="sr-only">Running with your custom input…</p><Skeleton className="h-4 w-28" /><Skeleton className="h-16 w-full" /></div>
        : outcome ? <>
          {outcome.code !== code && <p className="text-xs text-warm">This output belongs to an earlier draft. Run again to use your current code.</p>}
          {outcome.value.kind === "returned"
            ? <><Snippet label="Returned value" code={outcome.value.value || "(no value)"} />
              {outcome.value.console && <Snippet label="Console output" code={outcome.value.console} />}
              {outcome.value.runtimeMs != null && <p className="text-xs text-subtle tabular-nums">{outcome.value.runtimeMs} ms</p>}</>
            : <Snippet label="Error" code={outcome.value.message} tone="danger" />}
        </> : <p className="text-xs leading-5 text-subtle">Edit the arguments and run your function to see its returned value and console output.</p>}
    </div>
  </section>;
}

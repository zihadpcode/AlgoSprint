import { CodeBlock } from "@/components/problems/code-block";
import { verdictLabels, type ExecutionResult } from "@/features/submissions/contracts";

export type EditorExample = { position: number; input: unknown; output: unknown; explanation: string };

export function ExecutionPanels({ examples, available = false, result }: { examples: EditorExample[]; available?: boolean; result?: ExecutionResult }) {
  return <div className="space-y-5">
    <section aria-label="Output" className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Output</h3>
        <span className="text-xs font-semibold text-warm">{result ? verdictLabels[result.status] : available ? "Ready to run" : "Execution unavailable"}</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-muted">{result ? `${result.passedCount} of ${result.totalCount} tests passed. ${result.mode === "RUN" ? "Visible tests only; this is not a full submission verdict." : "Full suite submission; hidden details are withheld."}` : "No output yet."}</p>
      {result?.status === "INTERNAL_ERROR" && <p className="mt-3 text-sm text-warm">The service could not complete evaluation. This does not establish whether your solution is correct.</p>}
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted">
        <div><dt>Runtime</dt><dd className="mt-1">{result?.runtimeMs == null ? "Not measured" : `${result.runtimeMs} ms (slowest test)`}</dd></div>
        <div><dt>Memory</dt><dd className="mt-1">{result?.memoryKb == null ? "Not measured" : `${result.memoryKb} KB (peak test)`}</dd></div>
      </dl>
      {result && <p className="mt-3 break-all text-xs text-muted">{result.browser ? "Ran in your browser on the public examples. Nothing was saved; runtime is wall-clock time on your machine." : `Saved attempt: ${result.id}${result.problemRevision !== undefined ? ` · Problem revision ${result.problemRevision}` : ""}`}</p>}
    </section>
    <section aria-label="Test results" className="rounded-xl border border-line bg-canvas p-5">
      <h3 className="font-semibold">Test results</h3>
      {result ? result.mode === "SUBMIT" ? <p className="mt-3 text-sm leading-7 text-muted">Only the summary is shown for submissions. Use Run visible tests to inspect output and errors without revealing hidden inputs.</p> :
        <ol className="mt-4 space-y-3">{result.cases.map((test, index) => <li key={test.position}>
          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-semibold text-accent">Visible test {index + 1} · {verdictLabels[test.status]}</summary>
            <div className="mt-4 space-y-4">
              <CodeBlock label="Input" code={JSON.stringify(test.input, null, 2)} />
              <CodeBlock label="Expected output" code={JSON.stringify(test.expected, null, 2)} />
              <CodeBlock label="Actual output (up to 4,000 characters)" code={test.stdout || "(no output)"} />
              {test.diagnostic && <CodeBlock label="Errors / console logs (up to 4,000 characters)" code={test.diagnostic} />}
              {test.status === "WRONG_ANSWER" && <p className="text-sm text-muted">The returned JSON did not match the expected value. Check types and array order; return the result from the named function.</p>}
            </div>
          </details>
        </li>)}</ol> : <>
        <p className="mt-3 text-sm leading-7 text-muted">Not run. These are public examples and their expected outputs, not execution results.</p>
        {examples.length ? <ol className="mt-4 space-y-3">
          {examples.map((example, index) => <li key={example.position}>
            <details className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-accent">Example {index + 1} · Not run</summary>
              <div className="mt-4 space-y-4">
                <CodeBlock label={"Test example " + (index + 1) + " input"} code={JSON.stringify(example.input, null, 2) ?? "null"} />
                <CodeBlock label={"Test example " + (index + 1) + " expected output"} code={JSON.stringify(example.output, null, 2) ?? "null"} />
                <p className="text-sm text-muted">Actual output: Not run</p>
                <p className="text-sm leading-7 text-muted">{example.explanation}</p>
              </div>
            </details>
          </li>)}
        </ol> : <p className="mt-4 text-sm text-muted">No public examples are available for this problem.</p>}
      </>}
    </section>
  </div>;
}

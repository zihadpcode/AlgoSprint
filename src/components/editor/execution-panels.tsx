import { CodeBlock } from "@/components/problems/code-block";

export type EditorExample = { position: number; input: unknown; output: unknown; explanation: string };

export function ExecutionPanels({ examples }: { examples: EditorExample[] }) {
  return <div className="space-y-5">
    <section aria-label="Output" className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Output</h3>
        <span className="text-xs font-semibold text-warm">Execution unavailable</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-muted">No output yet. Code execution is not available yet.</p>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted">
        <div><dt>Runtime</dt><dd className="mt-1">Not measured</dd></div>
        <div><dt>Memory</dt><dd className="mt-1">Not measured</dd></div>
      </dl>
    </section>
    <section aria-label="Test results" className="rounded-xl border border-line bg-canvas p-5">
      <h3 className="font-semibold">Test results</h3>
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
    </section>
  </div>;
}

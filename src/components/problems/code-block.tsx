export function CodeBlock({ label, code }: { label: string; code: string }) {
  return <div className="min-w-0">
    <p className="mb-2 text-xs font-semibold text-muted">{label}</p>
    <pre tabIndex={0} aria-label={label} className="max-h-[32rem] overflow-auto rounded-xl border border-line bg-canvas p-4 font-mono text-sm leading-7"><code>{code}</code></pre>
  </div>;
}

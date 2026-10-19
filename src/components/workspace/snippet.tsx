import { cn } from "@/lib/utils";

/** Compact labelled code/JSON block used by examples, test cases and results. */
export function Snippet({ label, code, className, tone = "default" }: { label: string; code: string; className?: string; tone?: "default" | "danger" }) {
  return <div className={cn("min-w-0", className)}>
    <p className="mb-1 text-[0.6875rem] font-medium tracking-wide text-subtle uppercase">{label}</p>
    <pre tabIndex={0} aria-label={label} className={cn("max-h-52 overflow-auto rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[0.8125rem] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]", tone === "danger" ? "text-danger" : "text-ink")}><code>{code}</code></pre>
  </div>;
}

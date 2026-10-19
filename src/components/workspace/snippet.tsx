import { cn } from "@/lib/utils";

/** Single-line JSON with a space after commas and colons, so short arrays and objects read like code. */
export function compactJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(compactJson).join(", ")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${compactJson(item)}`).join(", ")}}`;
  return JSON.stringify(value) ?? "null";
}

/** A grid (array of arrays) prints one row per line when it would not fit on one line. */
function formatEntry(value: unknown) {
  const line = compactJson(value);
  if (line.length > 64 && Array.isArray(value) && value.length > 1 && value.every(Array.isArray)) {
    return `[\n${value.map((row) => `  ${compactJson(row)}`).join(",\n")}\n]`;
  }
  return line;
}

/** Function inputs as `name = value` lines (the way problem statements name parameters); anything else compact. */
export function formatValue(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length) return entries.map(([key, item]) => `${key} = ${formatEntry(item)}`).join("\n");
  }
  return formatEntry(value);
}

/** Compact labelled code/JSON block used by examples, test cases and results. */
export function Snippet({ label, ariaLabel, code, className, tone = "default" }: { label: string; ariaLabel?: string; code: string; className?: string; tone?: "default" | "danger" }) {
  return <div className={cn("min-w-0", className)}>
    <p className="mb-1 text-[0.6875rem] font-medium tracking-wide text-subtle uppercase">{label}</p>
    <pre tabIndex={0} aria-label={ariaLabel ?? label} className={cn("max-h-52 overflow-auto rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[0.8125rem] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]", tone === "danger" ? "text-danger" : "text-ink")}><code>{code}</code></pre>
  </div>;
}

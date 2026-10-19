import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: ReactNode; hint?: string };

/** Radio group drawn as a segmented control (or as option cards). Native radios: arrow keys, forms and screen readers just work. */
export function SegmentedRadio({ name, legend, options, defaultValue, disabled, cards = false }: {
  name: string; legend: string; options: Option[]; defaultValue: string; disabled?: boolean; cards?: boolean;
}) {
  const id = useId();
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="mb-2 text-sm font-medium">{legend}</legend>
    <div className={cn(cards ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-3" : "inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-line bg-canvas p-0.5")}>
      {options.map((option) => <label key={option.value} htmlFor={`${id}-${option.value}`} className="relative cursor-pointer">
        <input id={`${id}-${option.value}`} type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue} className="peer sr-only" />
        <span className={cn("flex flex-col justify-center text-sm text-muted transition-colors hover:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-50",
          cards ? "h-full min-h-14 rounded-lg border border-line bg-surface px-3 py-2 hover:border-line-strong hover:bg-surface-hover peer-checked:border-accent/60 peer-checked:bg-accent/10 peer-checked:text-ink"
            : "h-8 items-center rounded-md px-3 peer-checked:bg-surface-hover peer-checked:text-ink peer-checked:shadow-[0_0_0_1px_var(--color-line-strong)]")}>
          <span className="font-medium">{option.label}</span>
          {cards && option.hint && <span className="mt-0.5 text-xs text-subtle">{option.hint}</span>}
        </span>
      </label>)}
    </div>
  </fieldset>;
}

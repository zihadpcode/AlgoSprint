import type { ReactNode } from "react";
export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div className="min-w-0 max-w-2xl [overflow-wrap:anywhere]">{eyebrow && <p className="eyebrow mb-2 text-accent">{eyebrow}</p>}
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
      {description && <p className="mt-2 text-sm leading-6 text-muted">{description}</p>}
    </div>{action && <div className="shrink-0">{action}</div>}
  </div>;
}

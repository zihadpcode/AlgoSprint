import type { ReactNode } from "react";
export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
    <div className="min-w-0 max-w-2xl [overflow-wrap:anywhere]">{eyebrow && <p className="eyebrow mb-3 text-accent">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {description && <p className="mt-4 leading-7 text-muted">{description}</p>}
    </div>{action && <div className="shrink-0">{action}</div>}
  </div>;
}

import type { ReactNode } from "react";
import { Compass } from "lucide-react";
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-12 text-center">
    <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent"><Compass aria-hidden="true" size={24} /></span>
    <h2 className="text-lg font-semibold">{title}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">{description}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>;
}

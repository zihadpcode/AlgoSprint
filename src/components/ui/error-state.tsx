import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-danger/30 bg-surface p-7">
    <CircleAlert aria-hidden="true" size={28} className="mb-5 text-danger" />
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-4 max-w-lg leading-7 text-muted">{description}</p>
    {action && <div className="mt-7 flex flex-wrap gap-3">{action}</div>}
  </div>;
}

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return <kbd {...props} className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-hover px-1 font-mono text-[0.6875rem] font-medium text-muted", className)} />;
}

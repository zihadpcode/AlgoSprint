import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn("min-h-12 w-full rounded-xl border border-muted/60 bg-canvas px-4 text-sm text-ink placeholder:text-muted/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger", className)} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn("min-h-12 w-full rounded-xl border border-muted/60 bg-canvas px-3 text-sm text-ink disabled:opacity-50", className)} />;
}

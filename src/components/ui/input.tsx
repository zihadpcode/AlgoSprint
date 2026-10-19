import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const field = "h-10 w-full rounded-lg border border-line bg-canvas text-sm text-ink transition-colors placeholder:text-subtle hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(field, "px-3", className)} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn(field, "px-2.5", className)} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(field, "h-auto min-h-24 px-3 py-2 leading-6", className)} />;
}

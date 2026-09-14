import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("min-w-0 rounded-2xl border border-line bg-surface p-6 sm:p-7", className)} />;
}
export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 {...props} className={cn("text-xl font-semibold tracking-tight", className)} />;
}
export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p {...props} className={cn("mt-3 text-sm leading-7 text-muted", className)} />;
}

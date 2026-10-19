import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("min-w-0 rounded-xl border border-line bg-surface p-5", className)} />;
}
export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 {...props} className={cn("text-base font-semibold tracking-tight", className)} />;
}
export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p {...props} className={cn("mt-1.5 text-sm leading-6 text-muted", className)} />;
}

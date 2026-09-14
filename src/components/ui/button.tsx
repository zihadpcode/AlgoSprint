import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "quiet" | "danger";
const variants: Record<Variant, string> = {
  primary: "border-transparent bg-accent text-canvas hover:bg-accent-strong",
  secondary: "border-line bg-surface text-ink hover:border-accent hover:bg-surface-raised",
  quiet: "border-transparent text-muted hover:bg-surface-raised hover:text-ink",
  danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
};
function styles(variant: Variant, className?: string) {
  return cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50", variants[variant], className);
}
export function Button({ variant = "primary", className, type = "button", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...props} type={type} className={styles(variant, className)} />;
}
export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={styles(variant, className)} />;
}

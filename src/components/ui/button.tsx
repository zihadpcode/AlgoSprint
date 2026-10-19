import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "quiet" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";
const variants: Record<Variant, string> = {
  primary: "border-transparent bg-accent-solid text-white shadow-[0_1px_0_0_#ffffff26_inset] hover:bg-accent-solid-hover",
  secondary: "border-line bg-surface-raised text-ink hover:border-line-strong hover:bg-surface-hover",
  quiet: "border-transparent text-muted hover:bg-surface-hover hover:text-ink",
  danger: "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
  success: "border-transparent bg-emerald-500 text-emerald-950 shadow-[0_1px_0_0_#ffffff40_inset] hover:bg-success",
};
const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  md: "h-10 gap-2 px-3.5 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
  icon: "size-9 p-0",
};
export function buttonStyles(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn("inline-flex shrink-0 items-center justify-center rounded-lg border font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45", sizes[size], variants[variant], className);
}
export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} type={type} className={buttonStyles(variant, size, className)} />;
}
export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonStyles(variant, size, className)} />;
}

import Link from "next/link";
import { APP_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Logo mark: two forward chevrons in an indigo tile. */
export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("grid size-7 place-items-center rounded-md bg-gradient-to-br from-accent-solid to-indigo-400 text-white shadow-[0_1px_0_0_#ffffff33_inset]", className)}>
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></svg>
  </span>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label={`${APP_CONFIG.name} home`} className="inline-flex h-9 shrink-0 items-center gap-2.5 rounded-md">
      <BrandMark />
      {!compact && <span className="text-[0.9375rem] font-semibold tracking-tight">{APP_CONFIG.name}</span>}
    </Link>
  );
}

import Link from "next/link";
import { ChevronsRight } from "lucide-react";
import { APP_CONFIG } from "@/lib/constants";

export function Brand() {
  return (
    <Link
      href="/"
      aria-label={`${APP_CONFIG.name} home`}
      className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-lg"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-accent text-canvas">
        <ChevronsRight aria-hidden="true" size={25} strokeWidth={2.5} />
      </span>
      <span className="text-xl font-bold tracking-tight">{APP_CONFIG.name}</span>
    </Link>
  );
}

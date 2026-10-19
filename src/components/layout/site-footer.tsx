import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { PRIMARY_NAV } from "@/components/layout/nav-config";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Brand />
          <p className="text-xs text-subtle">One problem. One insight. Another step forward.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          {PRIMARY_NAV.map((item) => <Link key={item.href} href={item.href} className="inline-flex h-9 items-center text-sm text-muted transition-colors hover:text-ink">{item.label}</Link>)}
          <Link href="/login" className="inline-flex h-9 items-center text-sm text-muted transition-colors hover:text-ink">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}

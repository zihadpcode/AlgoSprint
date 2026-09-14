import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Container } from "@/components/layout/container";
import { LANDING_NAV } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="border-b border-line/70">
      <Container className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
        <Brand />
        <Link href="/login" className="min-h-11 rounded-xl border border-line px-4 py-2.5 text-sm text-accent hover:bg-surface lg:order-last">Sign in</Link>
        <nav aria-label="Main navigation" className="flex w-full flex-wrap gap-x-5 gap-y-1 lg:w-auto lg:gap-x-8">
          <Link href="/problems" className="inline-flex min-h-11 items-center rounded-md text-sm text-accent hover:text-ink">Problems</Link>
          {LANDING_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-md text-sm text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </Container>
    </header>
  );
}

import { Brand } from "@/components/layout/brand";
import { Container } from "@/components/layout/container";
import { LANDING_NAV } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="border-b border-line/70">
      <Container className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
        <Brand />
        <span className="rounded-full border border-line px-3 py-1.5 font-mono text-xs text-muted lg:order-last">
          EARLY PREVIEW
        </span>
        <nav aria-label="Main navigation" className="flex w-full flex-wrap gap-x-5 gap-y-1 lg:w-auto lg:gap-x-8">
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

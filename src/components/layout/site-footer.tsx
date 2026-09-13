import { Brand } from "@/components/layout/brand";
import { Container } from "@/components/layout/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/70 py-8">
      <Container className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <Brand />
        <p className="text-sm text-muted">One problem. One insight. Another step forward.</p>
      </Container>
    </footer>
  );
}

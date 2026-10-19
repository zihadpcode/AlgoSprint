import { TopBar } from "@/components/layout/app-shell";

/** Public (signed-out) top bar, identical to the application's. */
export function SiteHeader() {
  return <TopBar signedIn={false} />;
}

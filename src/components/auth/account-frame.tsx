import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

// Presentational only: callers must verify identity before rendering this frame.
export function AccountFrame({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  return <AppShell signedIn admin={admin}>{children}</AppShell>;
}

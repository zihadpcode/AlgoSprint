import type { ReactNode } from "react";
import { requireViewer } from "@/features/auth/session";
// Check the session in the layout, before the loading boundary starts streaming, so guests get a real 307 to sign-in.
export default async function Layout({ children }: { children: ReactNode }) {
  await requireViewer("/review");
  return children;
}

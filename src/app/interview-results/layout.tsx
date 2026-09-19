import type { ReactNode } from "react";
import { requireViewer } from "@/features/auth/session";
export default async function Layout({ children }: { children: ReactNode }) {
  await requireViewer("/interview-results");
  return children;
}

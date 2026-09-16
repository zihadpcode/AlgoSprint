import type { ReactNode } from "react";
import { requireViewer } from "@/features/auth/session";

export default async function ProgressLayout({ children }: { children: ReactNode }) {
  // Authenticate before this segment's loading fallback starts streaming.
  // The data loader still authorizes each read; layouts can persist on navigation.
  await requireViewer("/progress");
  return children;
}

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { roadmapExists } from "@/features/roadmaps/load";

// Decide 404 before this segment's loading boundary starts streaming, so missing roadmaps keep a real 404 status.
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  if (!(await roadmapExists((await params).slug))) notFound();
  return children;
}

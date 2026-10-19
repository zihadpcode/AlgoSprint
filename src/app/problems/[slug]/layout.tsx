import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { publishedProblemExists } from "@/features/problems/exists";

// Decide 404 before this segment's loading boundary starts streaming, so missing problems keep a real 404 status.
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  if (!(await publishedProblemExists((await params).slug))) notFound();
  return children;
}

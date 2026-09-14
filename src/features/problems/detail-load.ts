import "server-only";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { problemSlug } from "./detail-validation";
import { queryProblem } from "./detail-query";

export async function loadProblem(slug: string) {
  if (!problemSlug.safeParse(slug).success) return { kind: "not-found" as const };
  if (!process.env.DATABASE_URL) return { kind: "unavailable" as const };
  const viewer = await getViewer();
  const problem = await queryProblem(getDatabase(), slug, viewer?.id ?? null);
  if (!problem) return { kind: "not-found" as const };
  return { kind: "ready" as const, problem, signedIn: Boolean(viewer), admin: viewer?.role === "ADMIN" };
}

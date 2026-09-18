import "server-only";
import { getViewer } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { roadmapSlug } from "@/lib/validators/roadmap";
import { queryRoadmap, queryRoadmaps } from "./query";

export function roadmapPage(value: string | string[] | undefined) {
  return typeof value === "string" && /^[1-9][0-9]{0,5}$/.test(value) ? Number(value) : 1;
}
export async function loadRoadmaps(page: number) {
  if (!process.env.DATABASE_URL) return { kind: "unavailable" as const, signedIn: false, admin: false };
  const viewer = await getViewer();
  return { kind: "ready" as const, signedIn: Boolean(viewer), admin: viewer?.role === "ADMIN", result: await queryRoadmaps(getDatabase(), viewer?.id ?? null, page) };
}
export async function loadRoadmap(slug: string) {
  if (!roadmapSlug.safeParse(slug).success) return { kind: "not-found" as const };
  if (!process.env.DATABASE_URL) return { kind: "unavailable" as const };
  const viewer = await getViewer();
  const roadmap = await queryRoadmap(getDatabase(), viewer?.id ?? null, slug);
  if (!roadmap) return { kind: "not-found" as const };
  return { kind: "ready" as const, signedIn: Boolean(viewer), admin: viewer?.role === "ADMIN", roadmap };
}

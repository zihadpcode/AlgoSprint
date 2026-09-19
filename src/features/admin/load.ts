import "server-only";
import { requireAdmin } from "@/features/auth/session";
import { getDatabase } from "@/lib/prisma";
import { roadmapSlug } from "@/lib/validators/roadmap";
import { queryAdminIndex, queryAdminProblem, queryAdminRoadmap, type AdminFilters } from "./query";
type Params = Record<string, string | string[] | undefined>;
export function adminFilters(params: Params): AdminFilters {
  const q = typeof params.q === "string" ? params.q.replaceAll("\u0000", "").trim().slice(0, 100) : "";
  const status = params.status === "DRAFT" || params.status === "PUBLISHED" || params.status === "ARCHIVED" ? params.status : "";
  const page = typeof params.page === "string" && /^[1-9][0-9]{0,5}$/.test(params.page) ? Number(params.page) : 1;
  return { q, status, page };
}
export function adminHref(filters: AdminFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q); if (filters.status) params.set("status", filters.status); if (filters.page > 1) params.set("page", String(filters.page));
  return "/admin" + (params.size ? `?${params}` : "");
}
export async function loadAdminIndex(params: Params) {
  const viewer = await requireAdmin(); const filters = adminFilters(params);
  return { filters, result: await queryAdminIndex(getDatabase(), viewer.id, filters) };
}
export async function loadAdminProblem(slug: string) {
  const viewer = await requireAdmin();
  if (!roadmapSlug.safeParse(slug).success) return null;
  return queryAdminProblem(getDatabase(), viewer.id, slug);
}
export async function loadAdminRoadmap(slug: string) {
  const viewer = await requireAdmin();
  if (!roadmapSlug.safeParse(slug).success) return null;
  return queryAdminRoadmap(getDatabase(), viewer.id, slug);
}

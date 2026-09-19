import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ viewer: vi.fn(), admin: vi.fn(), db: vi.fn(), write: vi.fn(), problem: vi.fn(), roadmap: vi.fn(), index: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: m.viewer, requireAdmin: m.admin }));
vi.mock("@/lib/prisma", () => ({ getDatabase: m.db }));
vi.mock("@/features/admin/write", () => ({ writeAdmin: m.write }));
vi.mock("@/features/admin/query", () => ({ queryAdminProblem: m.problem, queryAdminRoadmap: m.roadmap, queryAdminIndex: m.index }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { administer } from "@/features/admin/actions";
import { loadAdminIndex, loadAdminProblem, loadAdminRoadmap, adminFilters, adminHref } from "@/features/admin/load";
import { AdminError } from "@/features/admin/access";
beforeEach(() => { vi.clearAllMocks(); m.viewer.mockResolvedValue({ id: "verified-admin", role: "ADMIN" }); m.admin.mockResolvedValue({ id: "verified-admin" }); m.db.mockReturnValue("db"); m.write.mockResolvedValue({ success: true, message: "Saved" }); });
it("denies guests, ordinary users and provider failures before parsing or writing", async () => {
  for (const viewer of [null, { id: "user", role: "USER" }]) { m.viewer.mockResolvedValue(viewer); expect((await administer({ role: "ADMIN", payload: "hidden" })).success).toBe(false); }
  m.viewer.mockRejectedValue(new Error("private provider token")); expect(JSON.stringify(await administer({}))).not.toContain("private provider");
  expect(m.write).not.toHaveBeenCalled(); expect(m.db).not.toHaveBeenCalled(); expect(m.revalidate).not.toHaveBeenCalled();
});
it("uses the verified actor and revalidates only after a confirmed save", async () => {
  const raw = { operation: "save" }; await administer(raw); expect(m.write).toHaveBeenCalledWith("db", "verified-admin", raw);
  expect(m.revalidate).toHaveBeenCalledWith("/problems/[slug]", "page"); expect(m.revalidate).toHaveBeenCalledWith("/admin/roadmaps/[slug]", "page");
  m.revalidate.mockClear(); m.write.mockRejectedValue(new AdminError("Stale revision"));
  expect(await administer(raw)).toMatchObject({ success: false, message: "Stale revision" }); expect(m.revalidate).not.toHaveBeenCalled();
  m.write.mockRejectedValue(new Error("postgresql://secret")); expect(JSON.stringify(await administer(raw))).not.toContain("secret");
});
it("guards all sensitive reads before database access", async () => {
  m.admin.mockRejectedValue(new Error("NOT_FOUND"));
  await expect(loadAdminProblem("quiet-badge")).rejects.toThrow("NOT_FOUND"); await expect(loadAdminRoadmap("scan-store-reuse")).rejects.toThrow("NOT_FOUND"); await expect(loadAdminIndex({ userId: "forged" })).rejects.toThrow("NOT_FOUND");
  expect(m.db).not.toHaveBeenCalled(); expect(m.problem).not.toHaveBeenCalled(); expect(m.roadmap).not.toHaveBeenCalled(); expect(m.index).not.toHaveBeenCalled();
});
it("validates read parameters and ignores user-supplied roles and owners", async () => {
  expect(await loadAdminProblem("../hidden")).toBeNull(); expect(m.problem).not.toHaveBeenCalled();
  await loadAdminIndex({ q: "  title\u0000  ", status: "PUBLISHED", page: "3", userId: "forged", role: "ADMIN" });
  expect(m.index).toHaveBeenCalledWith("db", "verified-admin", { q: "title", status: "PUBLISHED", page: 3 });
  expect(adminFilters({ page: ["3"], status: "FORGED" })).toEqual({ q: "", page: 1, status: "" });
  expect(adminHref({ q: "A&B", page: 2, status: "DRAFT" })).toBe("/admin?q=A%26B&status=DRAFT&page=2");
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), list: vi.fn(), detail: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: m.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: m.db }));
vi.mock("@/features/roadmaps/query", () => ({ queryRoadmaps: m.list, queryRoadmap: m.detail }));
import { loadRoadmaps, loadRoadmap, roadmapPage } from "@/features/roadmaps/load";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("DATABASE_URL", "postgresql://localhost/algosprint_test"); m.viewer.mockResolvedValue(null); m.db.mockReturnValue("trusted-db"); m.list.mockResolvedValue({ items: [] }); m.detail.mockResolvedValue({ slug: "scan-store-reuse" }); });
afterEach(() => vi.unstubAllEnvs());
it("handles missing configuration and malformed slugs without reading identity or data", async () => {
  for (const slug of ["INVALID", "../private", "x".repeat(101)]) expect(await loadRoadmap(slug)).toEqual({ kind: "not-found" });
  vi.stubEnv("DATABASE_URL", ""); expect((await loadRoadmaps(1)).kind).toBe("unavailable"); expect((await loadRoadmap("scan-store-reuse")).kind).toBe("unavailable");
  expect(m.viewer).not.toHaveBeenCalled(); expect(m.db).not.toHaveBeenCalled();
});
it("allows guests and passes only the verified identity, including for admins", async () => {
  expect(await loadRoadmaps(2)).toMatchObject({ kind: "ready", signedIn: false }); expect(m.list).toHaveBeenCalledWith("trusted-db", null, 2);
  m.viewer.mockResolvedValue({ id: "verified-owner", role: "ADMIN" });
  expect(await loadRoadmap("scan-store-reuse")).toMatchObject({ kind: "ready", signedIn: true, admin: true });
  expect(m.detail).toHaveBeenCalledWith("trusted-db", "verified-owner", "scan-store-reuse");
  await loadRoadmaps(1); expect(m.list).toHaveBeenLastCalledWith("trusted-db", "verified-owner", 1);
});
it("returns not-found for unavailable paths and propagates identity/database errors", async () => {
  m.detail.mockResolvedValue(null); expect(await loadRoadmap("missing")).toEqual({ kind: "not-found" });
  m.viewer.mockRejectedValue(new Error("identity unavailable")); m.detail.mockClear();
  await expect(loadRoadmap("scan-store-reuse")).rejects.toThrow("identity unavailable"); expect(m.detail).not.toHaveBeenCalled();
  m.viewer.mockResolvedValue(null); m.list.mockRejectedValue(new Error("database unavailable"));
  await expect(loadRoadmaps(1)).rejects.toThrow("database unavailable");
});
it("bounds page inputs without coercing arrays, fractions or oversized numbers", () => {
  for (const value of [undefined, ["2"], "0", "-1", "2.5", "Infinity", "1000000"]) expect(roadmapPage(value)).toBe(1);
  expect(roadmapPage("2")).toBe(2);
});

import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ requireViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/progress/query", () => ({ queryProgress: f.query }));
import { loadProgress } from "@/features/progress/load";
beforeEach(() => { vi.clearAllMocks(); f.viewer.mockResolvedValue({ id: "verified-owner", role: "USER" }); f.db.mockReturnValue("db"); f.query.mockResolvedValue({ overall: {} }); });
it("loads only the verified owner's progress and uses the progress return URL", async () => {
  expect(await loadProgress()).toEqual({ admin: false, summary: { overall: {} } });
  expect(f.viewer).toHaveBeenCalledWith("/progress"); expect(f.query).toHaveBeenCalledWith("db", "verified-owner");
});
it("performs no query on a guest redirect or identity-provider failure", async () => {
  f.viewer.mockRejectedValue(new Error("redirect or provider failure"));
  await expect(loadProgress()).rejects.toThrow(); expect(f.db).not.toHaveBeenCalled(); expect(f.query).not.toHaveBeenCalled();
});

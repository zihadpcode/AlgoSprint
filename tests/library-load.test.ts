import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: mocks.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: mocks.db }));
vi.mock("@/features/problems/query", () => ({ queryLibrary: mocks.query }));
import { loadLibrary } from "@/features/problems/load";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/algosprint_test");
  mocks.viewer.mockResolvedValue(null);
  mocks.db.mockReturnValue("trusted-db");
  mocks.query.mockResolvedValue({ items: [], total: 0 });
});
afterEach(() => vi.unstubAllEnvs());
it("shows unavailable configuration without touching identity or data", async () => {
  vi.stubEnv("DATABASE_URL", "");
  expect((await loadLibrary({})).kind).toBe("unavailable");
  expect(mocks.viewer).not.toHaveBeenCalled();
  expect(mocks.db).not.toHaveBeenCalled();
});
it("requires sign-in for personal filters without running the library query", async () => {
  expect((await loadLibrary({ completion: "SOLVED", userId: "forged" })).kind).toBe("sign-in");
  expect(mocks.query).not.toHaveBeenCalled();
  expect((await loadLibrary({ review: "1" })).kind).toBe("sign-in");
});
it("uses only the verified viewer ID and database role", async () => {
  mocks.viewer.mockResolvedValue({ id: "verified-user", role: "USER" });
  const view = await loadLibrary({ userId: "another-user", role: "ADMIN", status: "DRAFT" });
  expect(view).toMatchObject({ kind: "ready", signedIn: true, admin: false });
  expect(mocks.query.mock.calls[0][2]).toBe("verified-user");
  expect(mocks.query.mock.calls[0][1]).not.toHaveProperty("userId");
});
it("fails closed on identity errors instead of querying another user's data", async () => {
  mocks.viewer.mockRejectedValue(new Error("Provider unavailable"));
  await expect(loadLibrary({})).rejects.toThrow("Provider unavailable");
  expect(mocks.query).not.toHaveBeenCalled();
});

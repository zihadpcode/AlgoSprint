import { beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ requireViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/dashboard/query", () => ({ queryDashboard: f.query }));
import { loadDashboard } from "@/features/dashboard/load";

beforeEach(() => {
  vi.resetAllMocks();
  f.viewer.mockResolvedValue({ id: "verified-owner", role: "USER", displayName: "Learner", email: "private@example.test" });
  f.db.mockReturnValue("db");
  f.query.mockResolvedValue({ analytics: { overall: { solved: 2 }, difficulty: {}, categories: [] }, insights: { topics: [], recommendations: [], recentSubmissions: [] } });
});

it("uses the verified owner and returns only the dashboard projection", async () => {
  expect(await loadDashboard()).toEqual({ displayName: "Learner", admin: false, analytics: { overall: { solved: 2 }, difficulty: {}, categories: [] }, insights: { topics: [], recommendations: [], recentSubmissions: [] } });
  expect(f.viewer).toHaveBeenCalledWith("/dashboard");
  expect(f.query).toHaveBeenCalledWith("db", "verified-owner");
});

it("keeps administrator analytics scoped to that administrator's own progress", async () => {
  f.viewer.mockResolvedValue({ id: "admin-owner", role: "ADMIN", displayName: null });
  expect(await loadDashboard()).toMatchObject({ admin: true, displayName: null });
  expect(f.query).toHaveBeenCalledWith("db", "admin-owner");
});

it("does not touch the database after a guest redirect or provider failure", async () => {
  for (const message of ["guest redirect", "identity provider unavailable"]) {
    f.viewer.mockRejectedValue(new Error(message));
    await expect(loadDashboard()).rejects.toThrow(message);
    expect(f.db).not.toHaveBeenCalled();
    expect(f.query).not.toHaveBeenCalled();
  }
});

it("propagates a database failure instead of displaying fabricated zero progress", async () => {
  f.query.mockRejectedValue(new Error("database unavailable"));
  await expect(loadDashboard()).rejects.toThrow("database unavailable");
});

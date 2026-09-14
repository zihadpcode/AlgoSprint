import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ configured: vi.fn(), getUser: vi.fn(), upsert: vi.fn(), database: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ accountsConfigured: f.configured }));
vi.mock("@/lib/supabase/server", () => ({ createAuthClient: async () => ({ auth: { getUser: f.getUser } }) }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.database }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));
import { getViewer, requireAdmin, requireViewer } from "@/features/auth/session";
const id = "20000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks(); f.configured.mockReturnValue(true); f.database.mockReturnValue({ user: { upsert: f.upsert } });
  f.getUser.mockResolvedValue({ data: { user: { id, email: "a@example.com", user_metadata: { display_name: "Ada", role: "ADMIN" } } }, error: null });
  f.upsert.mockResolvedValue({ id, role: "USER", displayName: "Ada", timeZone: "UTC", createdAt: new Date(0) });
});
describe("verified sessions and database roles", () => {
  it("denies anonymous access before querying personal data", async () => {
    f.getUser.mockResolvedValue({ data: { user: null }, error: { status: 400 } });
    await expect(requireViewer("/profile")).rejects.toThrow("REDIRECT:/login?next=%2Fprofile");
    expect(f.database).not.toHaveBeenCalled();
  });
  it("creates a regular profile using only the verified ID and display name", async () => {
    expect((await getViewer())?.id).toBe(id);
    expect(f.upsert.mock.calls[0][0].create).toEqual({ id, displayName: "Ada", role: "USER" });
    expect(f.upsert.mock.calls[0][0].update).toEqual({});
  });
  it("rejects admin access despite forged metadata and permits a database admin", async () => {
    await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
    f.upsert.mockResolvedValue({ id, role: "ADMIN" });
    expect((await requireAdmin()).role).toBe("ADMIN");
  });
  it("fails closed on provider errors and missing configuration", async () => {
    f.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(getViewer()).rejects.toThrow("temporarily unavailable"); expect(f.database).not.toHaveBeenCalled();
    f.configured.mockReturnValue(false); f.getUser.mockClear(); expect(await getViewer()).toBeNull(); expect(f.getUser).not.toHaveBeenCalled();
  });
});

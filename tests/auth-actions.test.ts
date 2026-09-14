import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ configured: vi.fn(), signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), create: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ accountsConfigured: f.configured, getAppOrigin: () => "https://learn.example.com" }));
vi.mock("@/lib/supabase/server", () => ({ createAuthClient: f.create }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { login, logout, register } from "@/features/auth/actions";
function form(extra: Record<string, string> = {}) { const d = new FormData(); for (const [k,v] of Object.entries({ email: "a@example.com", password: "correct horse battery", displayName: "Ada", ...extra })) d.set(k,v); return d; }
beforeEach(() => { vi.clearAllMocks(); f.configured.mockReturnValue(true); f.create.mockResolvedValue({ auth: { signInWithPassword: f.signIn, signUp: f.signUp, signOut: f.signOut } }); });
describe("auth actions", () => {
  it("validates before calling Supabase and never returns credentials", async () => {
    const result = await login({}, form({ email: "bad" })); expect(result.errors?.email).toBeDefined(); expect(f.create).not.toHaveBeenCalled(); expect(JSON.stringify(result)).not.toContain("correct horse battery");
  });
  it("masks provider errors and handles throttling", async () => {
    f.signIn.mockResolvedValue({ error: { status: 400, message: "private provider detail" } }); expect((await login({}, form())).message).not.toContain("private");
    f.signIn.mockResolvedValue({ error: { status: 429 } }); expect((await login({}, form())).message).toContain("Too many attempts");
  });
  it("writes cookies and limits post-login navigation", async () => {
    f.signIn.mockResolvedValue({ error: null }); await expect(login({}, form({ next: "//evil.test" }))).rejects.toThrow("REDIRECT:/dashboard"); expect(f.create).toHaveBeenCalledWith(true); expect(f.revalidate).toHaveBeenCalled();
  });
  it("registers without accepting roles and waits for confirmation", async () => {
    f.signUp.mockResolvedValue({ data: { session: null }, error: null }); const result = await register({}, form({ role: "ADMIN" })); expect(result.success).toBe(true);
    expect(f.signUp.mock.calls[0][0].options).toEqual({ data: { display_name: "Ada" }, emailRedirectTo: "https://learn.example.com/auth/callback" });
  });
  it("supports immediate sessions only when returned by the provider", async () => {
    f.signUp.mockResolvedValue({ data: { session: { access_token: "private" } }, error: null }); await expect(register({}, form())).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("does not report successful logout if revocation fails", async () => {
    f.signOut.mockResolvedValue({ error: { status: 503 } }); await expect(logout()).rejects.toThrow("Could not sign out"); expect(f.revalidate).not.toHaveBeenCalled();
    f.signOut.mockResolvedValue({ error: null }); await expect(logout()).rejects.toThrow("REDIRECT:/login?signedOut=1"); expect(f.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

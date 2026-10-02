import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({ configured: vi.fn(), create: vi.fn(), recover: vi.fn(), resend: vi.fn(), claims: vi.fn(), user: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ accountsConfigured: f.configured, getAppOrigin: () => "https://learn.example.com" }));
vi.mock("@/lib/supabase/server", () => ({ createAuthClient: f.create }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));

import { requestPasswordReset, resendConfirmation, updatePassword } from "@/features/auth/recovery-actions";

function form(extra: Record<string, string> = {}) {
  const value = new FormData();
  for (const [key, field] of Object.entries({ email: "ada@example.com", password: "correct horse battery", confirmPassword: "correct horse battery", ...extra })) value.set(key, field);
  return value;
}
const verifiedUser = { id: "user-1", email: "ada@example.com", email_confirmed_at: "2026-01-01", is_anonymous: false };
const claims = (method = "recovery", timestamp = Math.floor(Date.now() / 1000), sub = "user-1") => ({ data: { claims: { sub, amr: [{ method, timestamp }] } }, error: null });

beforeEach(() => {
  vi.resetAllMocks();
  f.configured.mockReturnValue(true);
  f.create.mockResolvedValue({ auth: { resetPasswordForEmail: f.recover, resend: f.resend, getClaims: f.claims, getUser: f.user, updateUser: f.update } });
  f.recover.mockResolvedValue({ error: null });
  f.resend.mockResolvedValue({ error: null });
  f.claims.mockResolvedValue(claims());
  f.user.mockResolvedValue({ data: { user: verifiedUser }, error: null });
  f.update.mockResolvedValue({ data: { user: verifiedUser }, error: null });
});

describe("recovery and confirmation email requests", () => {
  it.each([requestPasswordReset, resendConfirmation])("validates email before calling the provider", async (action) => {
    const result = await action({}, form({ email: "not an email" }));
    expect(result.errors?.email).toBeDefined();
    expect(f.create).not.toHaveBeenCalled();
  });
  it("uses trusted callback URLs and only resends signup confirmation", async () => {
    await requestPasswordReset({}, form({ email: " ada@example.com ", next: "https://evil.test", type: "email_change" }));
    expect(f.recover).toHaveBeenCalledWith("ada@example.com", { redirectTo: "https://learn.example.com/auth/callback" });
    await resendConfirmation({}, form({ type: "email_change" }));
    expect(f.resend).toHaveBeenCalledWith({ type: "signup", email: "ada@example.com", options: { emailRedirectTo: "https://learn.example.com/auth/callback" } });
    expect(f.create).toHaveBeenCalledWith(true);
    expect(f.update).not.toHaveBeenCalled();
    expect(f.user).not.toHaveBeenCalled();
  });
  it.each([
    [requestPasswordReset, "recover"], [resendConfirmation, "resend"],
  ] as const)("keeps success, account eligibility, throttling, and failures indistinguishable", async (action, method) => {
    const provider = f[method];
    const results = [];
    for (const error of [null, { status: 400, message: "email already confirmed: private" }, { status: 429, message: "private rate detail" }, { status: 503 }]) {
      provider.mockResolvedValue({ error });
      results.push(await action({ success: true, retryAt: Number.MAX_SAFE_INTEGER }, form()));
    }
    provider.mockRejectedValue(new Error("private network detail"));
    results.push(await action({}, form()));
    for (const result of results) {
      expect(result.success).toBe(true);
      expect(result.message).toBe(results[0].message);
      expect(result.retryAt).toBeGreaterThan(Date.now() + 59_000);
      expect(JSON.stringify(result)).not.toMatch(/private|ada@example|correct horse/);
    }
  });
  it("does not call the provider when accounts are unconfigured", async () => {
    f.configured.mockReturnValue(false);
    expect((await requestPasswordReset({}, form())).success).not.toBe(true);
    expect((await resendConfirmation({}, form())).success).not.toBe(true);
    expect(f.create).not.toHaveBeenCalled();
  });
});

describe("password mutation authorization", () => {
  it("validates password length and confirmation without returning passwords", async () => {
    const mismatch = await updatePassword({}, form({ confirmPassword: "different long passphrase" }));
    expect(mismatch.errors?.confirmPassword).toBeDefined();
    expect((await updatePassword({}, form({ password: "short", confirmPassword: "short" }))).errors?.password).toBeDefined();
    expect(f.create).not.toHaveBeenCalled();
    expect(JSON.stringify(mismatch)).not.toContain("correct horse");
  });
  it.each(["password", "email/signup", "otp", "anonymous"])("rejects ordinary %s authentication even when form or user metadata claims recovery", async (method) => {
    f.claims.mockResolvedValue(claims(method));
    f.user.mockResolvedValue({ data: { user: { ...verifiedUser, user_metadata: { amr: [{ method: "recovery" }] } } }, error: null });
    expect((await updatePassword({}, form({ type: "recovery", userId: "user-2" }))).success).not.toBe(true);
    expect(f.update).not.toHaveBeenCalled();
  });
  it.each([-3601, 30])("rejects recovery claims outside the valid timestamp window (%s seconds)", async (offset) => {
    f.claims.mockResolvedValue(claims("recovery", Math.floor(Date.now() / 1000) + offset));
    expect((await updatePassword({}, form())).success).not.toBe(true);
    expect(f.update).not.toHaveBeenCalled();
  });
  it("rejects missing, expired, or unverifiable claims", async () => {
    for (const response of [{ data: null, error: null }, { data: null, error: { message: "bad signature" } }, { data: { claims: { sub: "user-1" } }, error: null }, { data: { claims: { sub: "user-1", amr: ["recovery"] } }, error: null }]) {
      f.claims.mockResolvedValue(response);
      expect((await updatePassword({}, form())).success).not.toBe(true);
    }
    expect(f.update).not.toHaveBeenCalled();
  });
  it("rejects live identity failures, mismatches, anonymous users, and unconfirmed emails", async () => {
    for (const response of [
      { data: { user: null }, error: null },
      { data: { user: verifiedUser }, error: { message: "revoked" } },
      { data: { user: { ...verifiedUser, id: "user-2" } }, error: null },
      { data: { user: { ...verifiedUser, is_anonymous: true } }, error: null },
      { data: { user: { ...verifiedUser, email_confirmed_at: null } }, error: null },
    ]) {
      f.user.mockResolvedValue(response);
      expect((await updatePassword({}, form())).success).not.toBe(true);
    }
    expect(f.update).not.toHaveBeenCalled();
    expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("updates only the live recovery user's password and preserves spaces", async () => {
    const password = "  correct horse battery  ";
    const result = await updatePassword({}, form({ password, confirmPassword: password, userId: "user-2", role: "ADMIN" }));
    expect(result.success).toBe(true);
    expect(f.update).toHaveBeenCalledWith({ password });
    expect(f.claims).toHaveBeenCalled();
    expect(f.user).toHaveBeenCalled();
    expect(f.create).toHaveBeenCalledWith(true);
    expect(f.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("masks update errors and does not report success when mutation fails", async () => {
    f.update.mockResolvedValue({ error: { status: 400, message: "private" } });
    const result = await updatePassword({}, form());
    expect(result.success).not.toBe(true);
    expect(result.message).not.toContain("private");
    f.update.mockResolvedValue({ error: { status: 429 } });
    expect((await updatePassword({}, form())).message).toContain("Too many attempts");
    expect(f.revalidate).not.toHaveBeenCalled();
  });
});

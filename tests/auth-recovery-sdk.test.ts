import { expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";

it("persists PKCE email verifiers without changing an existing browser session and surfaces provider throttling", async () => {
  // A mocked transport exercises the installed SDK without contacting Supabase or sending emails.
  const sessionCookie = "sb-project-auth-token";
  const jar = new Map([[sessionCookie, "existing-browser-session"]]);
  const transport = vi.fn(async () => new Response(JSON.stringify({ code: "over_email_send_rate_limit", msg: "private rate detail" }), {
    status: 429, headers: { "Content-Type": "application/json" },
  }));
  const makeClient = () => createServerClient("https://project.supabase.co", "sb_publishable_test_key_for_mock_transport", {
    global: { fetch: transport },
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: true },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) => { for (const { name, value } of values) { if (value) jar.set(name, value); else jar.delete(name); } },
    },
  });
  const recovery = await makeClient().auth.resetPasswordForEmail("ada@example.com", { redirectTo: "https://learn.example.com/auth/callback" });
  expect(recovery.error?.status).toBe(429);
  expect(jar.get(sessionCookie)).toBe("existing-browser-session");
  const [recoveryUrl, recoveryOptions] = transport.mock.calls[0] as unknown as [string, RequestInit];
  const redirect = new URL(new URL(recoveryUrl).searchParams.get("redirect_to")!);
  expect(new URL(recoveryUrl).pathname).toBe("/auth/v1/recover");
  expect(redirect.origin).toBe("https://learn.example.com");
  expect(redirect.pathname).toBe("/auth/callback");
  expect(JSON.parse(String(recoveryOptions.body))).toMatchObject({ email: "ada@example.com", code_challenge_method: "s256" });

  transport.mockImplementation(async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
  await makeClient().auth.resetPasswordForEmail("ada@example.com", { redirectTo: "https://learn.example.com/auth/callback" });
  const recoveryVerifier = jar.get("sb-project-auth-token-code-verifier");
  expect(recoveryVerifier).toBeDefined();
  await makeClient().auth.resend({ type: "signup", email: "ada@example.com", options: { emailRedirectTo: "https://learn.example.com/auth/callback" } });
  expect(jar.get(sessionCookie)).toBe("existing-browser-session");
  const calls = transport.mock.calls.slice(1) as unknown as [string, RequestInit][];
  expect(jar.get("sb-project-auth-token-code-verifier")).toBeDefined();
  expect(jar.get("sb-project-auth-token-code-verifier")).not.toBe(recoveryVerifier);
  expect(JSON.parse(String(calls[1][1].body))).toMatchObject({ type: "signup", email: "ada@example.com", code_challenge_method: "s256" });
});

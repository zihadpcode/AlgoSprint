import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const f = vi.hoisted(() => ({ create: vi.fn(), claims: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: f.create }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "https://project.supabase.co", key: "publishable" }), authCookieOptions: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } }));
import { refreshAuth } from "@/lib/supabase/proxy";
it("preserves all refreshed cookies on both request and response", async () => {
  f.create.mockImplementation((_url, _key, options) => ({ auth: { getClaims: async () => {
    f.claims(); options.cookies.setAll([{ name: "session.0", value: "part1", options: { httpOnly: true, secure: true } }], { "Expires": "0", "Pragma": "no-cache" }); options.cookies.setAll([{ name: "session.1", value: "part2", options: { httpOnly: true, secure: true } }]);
  } } }));
  const request = new NextRequest("https://learn.example.com/profile"); const response = await refreshAuth(request);
  expect(f.claims).toHaveBeenCalledOnce();
  for (const name of ["session.0", "session.1"]) { expect(request.cookies.get(name)?.value).toBeTruthy(); expect(response.cookies.get(name)?.httpOnly).toBe(true); }
  expect(response.headers.get("expires")).toBe("0"); expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.get("cache-control")).toContain("no-store");
});

import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { CANONICAL_MARKER, canonicalAuthRedirect, type CanonicalHostEnv } from "@/lib/supabase/canonical-host";

const production: CanonicalHostEnv = { appUrl: "https://algosprint-brown.vercel.app", vercelEnv: "production" };
const redirect = (url: string, method = "GET", env: CanonicalHostEnv = production) => canonicalAuthRedirect(new URL(url), method, env)?.href ?? null;
const canonicalBase = "https://algosprint-brown.vercel.app";

describe("canonical host for auth flows", () => {
  it("moves each sign-in and reset entry page from another production host to the canonical origin, keeping the query", () => {
    for (const path of ["/login", "/register", "/forgot-password", "/reset-password", "/resend-confirmation"]) {
      expect(redirect(`https://algosprint-zihadpcode-7061.vercel.app${path}`)).toBe(`${canonicalBase}${path}?${CANONICAL_MARKER}=1`);
    }
    expect(redirect("https://algosprint-zihadpcode-7061.vercel.app/login?next=%2Fdashboard&signedOut=1")).toBe(`${canonicalBase}/login?next=%2Fdashboard&signedOut=1&${CANONICAL_MARKER}=1`);
    expect(redirect("https://algosprint-zihadpcode-7061.vercel.app/login/")).toBe(`${canonicalBase}/login?${CANONICAL_MARKER}=1`);
    expect(redirect("https://algosprint-zihadpcode-7061.vercel.app/login", "HEAD")).not.toBeNull();
  });
  it("does nothing on the canonical host, in any case or with a port-less equivalent", () => {
    expect(redirect("https://algosprint-brown.vercel.app/login")).toBeNull();
    expect(redirect("https://ALGOSPRINT-BROWN.vercel.app/forgot-password")).toBeNull();
  });
  it("does nothing outside production, so previews and local development keep their own hosts", () => {
    for (const vercelEnv of ["preview", "development", "", undefined]) {
      expect(redirect("https://algosprint-git-feature-zihadpcode.vercel.app/login", "GET", { ...production, vercelEnv })).toBeNull();
    }
    expect(redirect("http://localhost:3000/login", "GET", { appUrl: "http://localhost:3000", vercelEnv: undefined })).toBeNull();
  });
  it("only touches the auth entry pages and only for GET or HEAD", () => {
    for (const path of ["/", "/problems", "/problems/relay-window", "/dashboard", "/roadmaps", "/auth/callback", "/api/health", "/loginx", "/login/extra", "/admin"]) {
      expect(redirect(`https://algosprint-zihadpcode-7061.vercel.app${path}`), path).toBeNull();
    }
    for (const method of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS"]) {
      expect(redirect("https://algosprint-zihadpcode-7061.vercel.app/login", method), method).toBeNull();
    }
  });
  it("redirects at most once: a request that already carries the marker is never redirected again", () => {
    const first = canonicalAuthRedirect(new URL("https://algosprint-zihadpcode-7061.vercel.app/login?next=%2Fdashboard"), "GET", production)!;
    expect(first.searchParams.get(CANONICAL_MARKER)).toBe("1");
    // If the host were ever misdetected, following the redirect must not redirect again.
    expect(canonicalAuthRedirect(first, "GET", production, "algosprint-zihadpcode-7061.vercel.app")).toBeNull();
    expect(redirect(`https://algosprint-zihadpcode-7061.vercel.app/login?${CANONICAL_MARKER}=1`)).toBeNull();
  });
  it("decides by the Host header the visitor used, not by the URL's own host", () => {
    const url = new URL("http://127.0.0.1:3000/forgot-password");
    expect(canonicalAuthRedirect(url, "GET", production, "algosprint-brown.vercel.app")).toBeNull();
    expect(canonicalAuthRedirect(url, "GET", production, "  ALGOSPRINT-BROWN.vercel.app ")).toBeNull();
    expect(canonicalAuthRedirect(url, "GET", production, "algosprint-zihadpcode-7061.vercel.app")?.href).toBe(`${canonicalBase}/forgot-password?${CANONICAL_MARKER}=1`);
  });
  it("ignores a missing or unsafe APP_URL instead of redirecting somewhere unexpected", () => {
    for (const appUrl of [undefined, "", "not a url", "http://algosprint-brown.vercel.app", "https://user:pass@algosprint-brown.vercel.app", "https://algosprint-brown.vercel.app/app", "https://algosprint-brown.vercel.app/?x=1", "https://algosprint-brown.vercel.app/#x", "javascript:alert(1)"]) {
      expect(redirect("https://algosprint-zihadpcode-7061.vercel.app/login", "GET", { ...production, appUrl }), String(appUrl)).toBeNull();
    }
  });
  it("can never be steered to another origin by the request: the target host always comes from APP_URL", () => {
    for (const url of ["https://evil.example/login?next=https://evil.example", "https://evil.example/login?redirect=//evil.example", "https://evil.example//evil.example/login", "https://evil.example/login/..%2F..%2Fevil"]) {
      const target = canonicalAuthRedirect(new URL(url), "GET", production);
      if (target) { expect(target.origin).toBe("https://algosprint-brown.vercel.app"); expect(target.host).not.toContain("evil"); }
    }
  });
});

describe("proxy wiring", () => {
  it("answers with an uncached temporary redirect, or hands off to the session refresh", async () => {
    vi.resetModules();
    const refresh = vi.fn(async () => NextResponse.next());
    vi.doMock("@/lib/supabase/proxy", () => ({ refreshAuth: refresh }));
    vi.stubEnv("APP_URL", "https://algosprint-brown.vercel.app");
    try {
      const { proxy } = await import("@/proxy");
      vi.stubEnv("VERCEL_ENV", "production");
      const moved = await proxy(new NextRequest("https://algosprint-zihadpcode-7061.vercel.app/forgot-password?x=1", { headers: { host: "algosprint-zihadpcode-7061.vercel.app" } }));
      expect(moved.status).toBe(307);
      expect(moved.headers.get("location")).toBe(`${canonicalBase}/forgot-password?x=1&${CANONICAL_MARKER}=1`);
      expect(moved.headers.get("cache-control")).toBe("private, no-store");
      expect(refresh).not.toHaveBeenCalled();
      await proxy(new NextRequest("https://algosprint-brown.vercel.app/forgot-password", { headers: { host: "algosprint-brown.vercel.app" } }));
      await proxy(new NextRequest("https://algosprint-zihadpcode-7061.vercel.app/problems", { headers: { host: "algosprint-zihadpcode-7061.vercel.app" } }));
      // The server's own URL host can differ from what the visitor typed; the Host header wins.
      await proxy(new NextRequest("http://127.0.0.1:3000/login", { headers: { host: "algosprint-brown.vercel.app" } }));
      expect(refresh).toHaveBeenCalledTimes(3);
      vi.stubEnv("VERCEL_ENV", "preview");
      await proxy(new NextRequest("https://algosprint-git-x-zihadpcode.vercel.app/login", { headers: { host: "algosprint-git-x-zihadpcode.vercel.app" } }));
      expect(refresh).toHaveBeenCalledTimes(4);
    } finally { vi.unstubAllEnvs(); vi.doUnmock("@/lib/supabase/proxy"); vi.resetModules(); }
  });
});

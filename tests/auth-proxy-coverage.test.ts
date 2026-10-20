import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { config } from "@/proxy";

// A Server Component cannot persist cookies. If a route outside the proxy matcher asks Supabase who the viewer is and the
// access token is near expiry, the SDK rotates the refresh token and the new one is discarded; the next request replays the
// spent token and the session is lost. Keep every route inside the matcher so refreshed cookies are always written back.
const covers = (pattern: string, path: string) => pattern.endsWith("/:path*")
  ? path === pattern.slice(0, -"/:path*".length) || path.startsWith(pattern.slice(0, -"/:path*".length) + "/")
  : pattern === path;
const matched = (path: string) => config.matcher.some((pattern) => covers(pattern, path));

it("covers the root page and every top-level route directory", () => {
  const appDir = join(process.cwd(), "src/app");
  const routes = readdirSync(appDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("(") && !entry.name.startsWith("@"))
    .map((entry) => "/" + entry.name);
  expect(existsSync(join(appDir, "page.tsx"))).toBe(true);
  expect(routes.length).toBeGreaterThan(10);
  const missing = ["/", ...routes].filter((route) => !matched(route));
  expect(missing).toEqual([]);
});

it("covers nested paths of the directory routes", () => {
  for (const path of ["/problems/relay-window", "/roadmaps/arrays", "/leaderboard", "/api/problem-search", "/auth/callback"]) expect(matched(path), path).toBe(true);
});

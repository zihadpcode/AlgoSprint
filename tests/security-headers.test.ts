import { expect, it } from "vitest";
import nextConfig from "../next.config";

it("sends the baseline hardening headers on every route", async () => {
  const rules = await nextConfig.headers!();
  const all = rules.find((rule) => rule.source === "/:path*");
  const headers = Object.fromEntries(all!.headers.map((header) => [header.key, header.value]));
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  expect(headers["X-Frame-Options"]).toBe("DENY");
  expect(headers["Referrer-Policy"]).toBe("no-referrer");
  const csp = headers["Content-Security-Policy"];
  for (const directive of ["base-uri 'self'", "object-src 'none'", "form-action 'self'", "frame-ancestors 'none'"]) expect(csp).toContain(directive);
  // No script-src here: a policy that omits it must not accidentally narrow the framework's own scripts or the editor workers.
  expect(csp).not.toMatch(/script-src|default-src/);
});

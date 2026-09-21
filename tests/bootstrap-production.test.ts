import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { migrationEnvironment } from "../scripts/bootstrap-production";

const ref = "abcdefghijklmnopqrst";
const env = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  DATABASE_URL: `postgresql://postgres.${ref}:test%40credential@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full`,
};
describe("one-time production bootstrap", () => {
  it("launches with the actual Vercel command and safely rejects non-production execution", () => {
    const child = spawnSync(process.execPath, ["--import", "tsx", "scripts/bootstrap-production.ts", ref], {
      env: { ...process.env, VERCEL_ENV: "preview" }, encoding: "utf8", timeout: 10_000,
    });
    expect(child.status).toBe(1);
    expect(child.stderr).toContain("Bootstrap requires Vercel Production");
    expect(child.stderr).not.toContain("Transform failed");
  });
  it("derives session mode without changing runtime credentials or TLS", () => {
    const job = migrationEnvironment(env, ref);
    expect(job.DATABASE_URL).toBe(env.DATABASE_URL);
    const url = new URL(job.DIRECT_URL);
    expect(url.port).toBe("5432");
    expect(url.password).toBe("test%40credential");
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
  });
  it("rejects preview builds and mismatched projects", () => {
    expect(() => migrationEnvironment({ ...env, VERCEL_ENV: "preview" }, ref)).toThrow();
    expect(() => migrationEnvironment(env, "zyxwvutsrqponmlkjihg")).toThrow();
  });
  it("rejects alternate hosts, placeholder passwords and weakened TLS", () => {
    for (const value of [
      env.DATABASE_URL.replace("pooler.supabase.com", "example.com"),
      env.DATABASE_URL.replace("test%40credential", "YOUR-PASSWORD"),
      env.DATABASE_URL.replace("verify-full", "require"),
      `${env.DATABASE_URL}&sslmode=disable`,
      `${env.DATABASE_URL}&ssl=false`,
    ]) expect(() => migrationEnvironment({ ...env, DATABASE_URL: value }, ref)).toThrow();
  });
  it("keeps credential values out of validation errors", () => {
    try { migrationEnvironment({ ...env, DATABASE_URL: "private-credential" }, ref); }
    catch (error) { expect(String(error)).not.toContain("private-credential"); }
  });
});

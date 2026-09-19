import { describe, expect, it } from "vitest";
import { deploymentIssues } from "../scripts/lib/deployment-config";
const valid = { APP_URL: "https://algosprint.example", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_exampleonly012345", DATABASE_URL: "postgresql://user:private-password@db.example:5432/postgres?sslmode=verify-full" };
describe("redacted deployment readiness checks", () => {
  it("accepts account configuration without enabling a runner or requiring migration credentials", () => { expect(deploymentIssues({ ...valid, NEXT_PUBLIC_VERCEL_URL: "preview.vercel.app" })).toEqual([]); });
  it("reports missing settings without logging credential values", () => {
    expect(deploymentIssues({})).toHaveLength(4);
    const errors = deploymentIssues({ ...valid, DATABASE_URL: "postgresql://user:private-password@db.example/db?sslmode=disable", NEXT_PUBLIC_PRIVATE_KEY: "secret-value" });
    expect(errors.join(" ")).toContain("DATABASE_URL"); expect(errors.join(" ")).not.toMatch(/private-password|secret-value|db.example/);
  });
  it("rejects local, insecure and credential-bearing origins", () => {
    for (const APP_URL of ["http://site.example", "https://localhost", "https://user:pass@site.example", "https://site.example/path", "https://site.example?token=secret"]) expect(deploymentIssues({ ...valid, APP_URL })).not.toEqual([]);
  });
  it("requires private migration settings only in migration mode", () => {
    expect(deploymentIssues(valid, true).join()).toContain("DIRECT_URL");
    expect(deploymentIssues({ ...valid, DIRECT_URL: valid.DATABASE_URL }, true)).toEqual([]);
  });
  it("rejects disabled TLS, private browser keys and unrecognized runner flags", () => {
    expect(deploymentIssues({ ...valid, DATABASE_URL: valid.DATABASE_URL + "&sslmode=disable" }).join()).toContain("DATABASE_URL");
    expect(deploymentIssues({ ...valid, NODE_TLS_REJECT_UNAUTHORIZED: "0" }).join()).toContain("TLS");
    expect(deploymentIssues({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private" }).join()).toContain("publishable");
    expect(deploymentIssues({ ...valid, CODE_RUNNER_ENABLED: "TRUE" }).join()).toContain("exactly");
  });
  it("checks enabled runner configuration without contacting any provider", () => {
    expect(deploymentIssues({ ...valid, CODE_RUNNER_ENABLED: "true" }).length).toBeGreaterThan(0);
    expect(deploymentIssues({ ...valid, CODE_RUNNER_ENABLED: "true", JUDGE0_API_URL: "https://runner.example", JUDGE0_API_KEY: "private-runner-key", JUDGE0_JAVASCRIPT_LANGUAGE_ID: "102", JUDGE0_AUTH_MODE: "token" })).toEqual([]);
  });
});

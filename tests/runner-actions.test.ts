import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), config: vi.fn(), run: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: f.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: f.db }));
vi.mock("@/features/submissions/config", () => ({ getRunnerConfig: f.config }));
vi.mock("@/features/submissions/service", () => ({ runSubmission: f.run }));
import { executeCode } from "@/features/submissions/actions";
const input = { slug: "relay-window", language: "JAVASCRIPT", mode: "RUN", code: "function relayWindow() { return 13; }" };
beforeEach(() => { vi.clearAllMocks(); f.viewer.mockResolvedValue({ id: "verified-owner" }); f.db.mockReturnValue("db"); f.config.mockReturnValue("server-config"); f.run.mockResolvedValue({ success: true, result: { id: "saved" } }); });
it("rejects tampered fields, unsupported languages, invalid modes and oversized code", async () => {
  for (const change of [{ userId: "forged" }, { role: "ADMIN" }, { tests: [] }, { url: "https://evil.example" }, { language: "PYTHON" }, { mode: "ACCEPTED" }, { code: " " }, { code: "x".repeat(20001) }, { slug: "../admin" }])
    expect((await executeCode({ ...input, ...change })).success).toBe(false);
  expect(f.viewer).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
});
it("authenticates every request and fails closed when disabled or identity verification fails", async () => {
  f.viewer.mockResolvedValue(null); expect(await executeCode(input)).toMatchObject({ success: false, message: expect.stringContaining("Sign in") });
  f.viewer.mockResolvedValue({ id: "verified-owner" }); f.config.mockReturnValue(null); expect(await executeCode(input)).toMatchObject({ success: false, message: expect.stringContaining("not configured") });
  f.viewer.mockRejectedValue(new Error("private token")); expect(JSON.stringify(await executeCode(input))).not.toContain("private token");
  expect(f.run).not.toHaveBeenCalled();
});
it("uses the verified owner and never reports a failed save as successful", async () => {
  expect((await executeCode(input)).success).toBe(true);
  expect(f.run).toHaveBeenCalledWith("db", "verified-owner", input, "server-config");
  expect(f.revalidate.mock.calls).toEqual([["/problems/relay-window"], ["/problems"], ["/progress"], ["/dashboard"], ["/notes"], ["/bookmarks"], ["/review"]]);
  f.run.mockRejectedValue(new Error("database password")); expect(await executeCode(input)).toMatchObject({ success: false });
  expect(JSON.stringify(await executeCode(input))).not.toContain("password");
});

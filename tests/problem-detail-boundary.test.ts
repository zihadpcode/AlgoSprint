import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ viewer: vi.fn(), db: vi.fn(), query: vi.fn(), write: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ getViewer: mocks.viewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: mocks.db }));
vi.mock("@/features/problems/detail-query", () => ({ queryProblem: mocks.query }));
vi.mock("@/features/problems/detail-write", () => ({ writeProblemChange: mocks.write }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { loadProblem } from "@/features/problems/detail-load";
import { updateProblem } from "@/features/problems/detail-actions";

function form(values: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ slug: "relay-window", operation: "mark-solved", ...values })) if (value !== undefined) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/algosprint_test");
  mocks.viewer.mockResolvedValue({ id: "verified-user", role: "USER" });
  mocks.db.mockReturnValue("trusted-db");
  mocks.query.mockResolvedValue({ slug: "relay-window" });
  mocks.write.mockResolvedValue("saved");
});
afterEach(() => vi.unstubAllEnvs());

describe("problem page read boundary", () => {
  it("rejects malformed slugs before any identity or database calls", async () => {
    for (const slug of ["../admin", "UPPER", "x".repeat(101), "a/b", "bad--slug"]) expect((await loadProblem(slug)).kind).toBe("not-found");
    expect(mocks.viewer).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("handles missing configuration without accessing data", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await loadProblem("relay-window")).kind).toBe("unavailable");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("gets identity and roles from the verified session and supports guests", async () => {
    expect(await loadProblem("relay-window")).toMatchObject({ kind: "ready", signedIn: true, admin: false });
    expect(mocks.query).toHaveBeenLastCalledWith("trusted-db", "relay-window", "verified-user");
    mocks.viewer.mockResolvedValue(null);
    expect(await loadProblem("relay-window")).toMatchObject({ kind: "ready", signedIn: false });
    expect(mocks.query).toHaveBeenLastCalledWith("trusted-db", "relay-window", null);
  });
  it("maps missing/unpublished data to not-found and fails closed on provider errors", async () => {
    mocks.query.mockResolvedValue(null);
    expect((await loadProblem("relay-window")).kind).toBe("not-found");
    mocks.query.mockClear();
    mocks.viewer.mockRejectedValue(new Error("Provider unavailable"));
    await expect(loadProblem("relay-window")).rejects.toThrow("Provider unavailable");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe("personal problem action boundary", () => {
  it("validates operations, values and note limits before any writes", async () => {
    for (const values of [
      { operation: "delete-problem" }, { slug: "../admin" }, { operation: "set-review", review: "yes" },
      { operation: "save-note", content: "x".repeat(10_001), expectedContent: "" },
      { operation: "save-note", content: "bad\u0000text", expectedContent: "" },
      { operation: "save-note", content: "new" },
    ]) expect((await updateProblem({}, form(values))).success).toBe(false);
    expect(mocks.viewer).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("denies anonymous or expired sessions even when IDs and roles are forged", async () => {
    mocks.viewer.mockResolvedValue(null);
    expect((await updateProblem({}, form({ userId: "another", role: "ADMIN" }))).message).toContain("Sign in again");
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("uses only the verified owner and revalidates the affected public routes after success", async () => {
    expect((await updateProblem({}, form({ userId: "another", problemId: "another", role: "ADMIN" }))).success).toBe(true);
    expect(mocks.write).toHaveBeenCalledWith("trusted-db", "verified-user", { slug: "relay-window", operation: "mark-solved" });
    expect(mocks.revalidate.mock.calls).toEqual([["/problems/relay-window"], ["/problems"], ["/progress"], ["/dashboard"], ["/notes"], ["/bookmarks"], ["/review"]]);
  });
  it("does not falsely report or revalidate missing problems and stale saves", async () => {
    mocks.write.mockResolvedValue("not-found");
    expect((await updateProblem({}, form())).message).toContain("no longer available");
    mocks.write.mockResolvedValue("conflict");
    expect((await updateProblem({}, form({ operation: "save-note", content: "new", expectedContent: "old" }))).message).toContain("another tab");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("preserves note whitespace, supports clearing, and returns only the saved note", async () => {
    for (const content of ["  reasoning\n", "", "x".repeat(10_000)]) {
      const result = await updateProblem({}, form({ operation: "save-note", content, expectedContent: "" }));
      expect(result).toMatchObject({ success: true, savedContent: content });
      expect(Object.keys(result).sort()).toEqual(["message", "savedContent", "success"]);
    }
  });
  it("masks provider/database details and never reports a failed write as saved", async () => {
    mocks.write.mockRejectedValue(new Error("private database secret"));
    expect(await updateProblem({}, form())).toEqual({ success: false, message: "Could not save your change. Please try again." });
    mocks.viewer.mockRejectedValue(new Error("private token"));
    expect((await updateProblem({}, form())).message).not.toContain("private");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});

it("validates bookmark booleans and delete baselines; only the viewer owns the mutation", async () => {
  for (const values of [{ operation: "set-bookmark", bookmarked: "yes" }, { operation: "delete-note" }, { operation: "delete-note", expectedContent: "x".repeat(10001) }]) expect((await updateProblem({}, form(values))).success).toBe(false);
  expect(mocks.write).not.toHaveBeenCalled();
  expect((await updateProblem({}, form({ operation: "set-bookmark", bookmarked: "true", userId: "other" }))).success).toBe(true);
  expect(mocks.write).toHaveBeenLastCalledWith("trusted-db", "verified-user", { slug: "relay-window", operation: "set-bookmark", bookmarked: "true" });
  expect(await updateProblem({}, form({ operation: "delete-note", expectedContent: "saved" }))).toMatchObject({ success: true, savedContent: "", message: "Note deleted." });
});

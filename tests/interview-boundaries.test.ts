import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ viewer: vi.fn(), requireViewer: vi.fn(), db: vi.fn(), write: vi.fn(), query: vi.fn(), list: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getViewer: mocks.viewer, requireViewer: mocks.requireViewer }));
vi.mock("@/lib/prisma", () => ({ getDatabase: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/features/interviews/store", () => ({ writeInterview: mocks.write, queryInterview: mocks.query, queryInterviews: mocks.list, InterviewError: class InterviewError extends Error {} }));
import { interviewAction } from "@/features/interviews/actions";
import { loadInterview, loadInterviewIndex } from "@/features/interviews/load";
beforeEach(() => { vi.resetAllMocks(); mocks.db.mockReturnValue({}); });
it("denies signed-out mutations before touching the database", async () => {
  mocks.viewer.mockResolvedValue(null); expect((await interviewAction({})).success).toBe(false); expect(mocks.db).not.toHaveBeenCalled();
});
it("derives mutation owner from the verified viewer and revalidates private routes", async () => {
  mocks.viewer.mockResolvedValue({ id: "verified" }); mocks.write.mockResolvedValue({ success: true });
  await interviewAction({ userId: "forged" }); expect(mocks.write).toHaveBeenCalledWith({}, "verified", { userId: "forged" }); expect(mocks.revalidate).toHaveBeenCalledWith("/interview-results/[id]", "page");
});
it("keeps internal database errors out of the user message", async () => {
  mocks.viewer.mockResolvedValue({ id: "verified" }); mocks.write.mockRejectedValue(new Error("private connection string"));
  expect((await interviewAction({})).message).not.toContain("private connection");
});
it("requires the viewer for listings and session/report reads", async () => {
  mocks.requireViewer.mockResolvedValue({ id: "owner" }); mocks.list.mockResolvedValue([]); mocks.query.mockResolvedValue({ id: "session" });
  await loadInterviewIndex(); expect(mocks.list).toHaveBeenCalledWith({}, "owner");
  const id = "00000000-0000-4000-8000-000000000000";
  await loadInterview(id, true); expect(mocks.query).toHaveBeenCalledWith({}, "owner", id);
  expect(mocks.requireViewer).toHaveBeenCalledWith(`/interview-results/${id}`);
  mocks.query.mockClear(); expect(await loadInterview("invalid")).toBeNull(); expect(mocks.query).not.toHaveBeenCalled();
});

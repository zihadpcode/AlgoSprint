import { beforeEach, expect, it } from "vitest";
import { DRAFT_PREFIX, DRAFT_OWNER_KEY, DRAFT_TTL_MS, MAX_DRAFTS, clearDeviceDrafts, draftKey, readDeviceDraft, removeDeviceDraft, writeDeviceDraft, type DraftScope } from "@/features/drafts/storage";
class MemoryStorage {
  entries = new Map<string, string>();
  get length() { return this.entries.size; }
  key(index: number) { return [...this.entries.keys()][index] ?? null; }
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
  removeItem(key: string) { this.entries.delete(key); }
}
const scope: DraftScope = { owner: "verified-user", kind: "code", target: "two-sum", revision: "2" };
const payload = JSON.stringify({ JAVASCRIPT: "const privateDraft = 1;" });
let storage: MemoryStorage;
beforeEach(() => { storage = new MemoryStorage(); readDeviceDraft(storage, scope, 100); });
it("recovers only the matching owner and problem without losing deliberately empty code", () => {
  expect(writeDeviceDraft(storage, scope, JSON.stringify({ JAVASCRIPT: "" }), "", 100)).toBe(true);
  expect(readDeviceDraft(storage, scope, 101).draft?.payload).toBe('{"JAVASCRIPT":""}');
  expect(readDeviceDraft(storage, { ...scope, target: "another-problem" }, 101).draft).toBeNull();
});
it("retains revision and original answer token for copy-only stale recovery", () => {
  const interview: DraftScope = { ...scope, kind: "interview", target: "session", revision: "q1:1" };
  const answer = JSON.stringify([{ reasoning: "private reasoning", tradeoffs: "", checks: "", reasoningRating: null, tradeoffsRating: null, checksRating: null }]);
  expect(writeDeviceDraft(storage, interview, answer, "old-token", 100)).toBe(true);
  expect(readDeviceDraft(storage, { ...interview, revision: "q1:2" }, 101).draft).toMatchObject({ baseline: "old-token", revision: "q1:1", payload: answer });
});
it("purges another user's drafts and guests cannot recover the previous user's text", () => {
  writeDeviceDraft(storage, scope, payload, "", 100);
  expect(readDeviceDraft(storage, { ...scope, owner: "new-user" }, 101).draft).toBeNull();
  expect(storage.getItem(draftKey(scope))).toBeNull();
  writeDeviceDraft(storage, { ...scope, owner: "new-user" }, payload, "", 101);
  expect(readDeviceDraft(storage, null, 102).draft).toBeNull();
  expect([...storage.entries.keys()].filter((key) => key.startsWith(DRAFT_PREFIX))).toHaveLength(0);
});
it("does not let an old tab overwrite the active account's browser drafts", () => {
  const other = { ...scope, owner: "new-user" };
  readDeviceDraft(storage, other, 101); writeDeviceDraft(storage, other, payload, "", 101);
  expect(writeDeviceDraft(storage, scope, payload, "", 102)).toBe(false);
  expect(readDeviceDraft(storage, other, 103).draft?.owner).toBe("new-user");
});
it("expires drafts at seven days and rejects future timestamps", () => {
  writeDeviceDraft(storage, scope, payload, "", 100);
  expect(readDeviceDraft(storage, scope, 100 + DRAFT_TTL_MS - 1).draft).not.toBeNull();
  expect(readDeviceDraft(storage, scope, 100 + DRAFT_TTL_MS).draft).toBeNull();
  writeDeviceDraft(storage, scope, payload, "", 200);
  expect(readDeviceDraft(storage, scope, 199).draft).toBeNull();
});
it("removes malformed records, unknown versions, wrong shapes and forged key ownership", () => {
  const key = draftKey(scope);
  for (const raw of ["not json", '{"version":2}', JSON.stringify({ ...scope, version: 1, baseline: "", payload: '{"unrecognized":"code"}', updatedAt: 100 })]) {
    storage.setItem(key, raw); expect(readDeviceDraft(storage, scope, 100).draft).toBeNull(); expect(storage.getItem(key)).toBeNull();
  }
  writeDeviceDraft(storage, scope, payload, "", 100);
  storage.setItem(key + "forged", storage.getItem(key)!);
  readDeviceDraft(storage, scope, 101); expect(storage.getItem(key + "forged")).toBeNull();
});
it("caps storage at twelve records by evicting the oldest", () => {
  for (let i = 0; i < MAX_DRAFTS + 1; i++) expect(writeDeviceDraft(storage, { ...scope, target: `problem-${i}` }, payload, "", 100 + i)).toBe(true);
  expect([...storage.entries.keys()].filter((key) => key.startsWith(DRAFT_PREFIX))).toHaveLength(MAX_DRAFTS);
  expect(storage.getItem(draftKey({ ...scope, target: "problem-0" }))).toBeNull();
});
it("rejects oversized drafts without replacing the last valid saved copy", () => {
  writeDeviceDraft(storage, scope, payload, "", 100);
  expect(writeDeviceDraft(storage, scope, JSON.stringify({ JAVASCRIPT: "x".repeat(64001) }), "", 101)).toBe(false);
  expect(readDeviceDraft(storage, scope, 102).draft?.payload).toBe(payload);
});
it("handles blocked storage and full quota without throwing", () => {
  const blocked = { get length(): number { throw new Error("blocked"); }, key: () => null, getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("blocked"); } };
  expect(readDeviceDraft(blocked, scope).status).toBe("unavailable");
  expect(writeDeviceDraft(blocked, scope, payload)).toBe(false);
  expect(removeDeviceDraft(blocked, scope)).toBe(false);
  expect(clearDeviceDrafts(blocked)).toBe(false);
});
it("logout deletes only AlgoSprint draft data and prevents old tabs writing again", () => {
  storage.setItem("another-app", "unrelated"); writeDeviceDraft(storage, scope, payload, "", 100);
  expect(clearDeviceDrafts(storage)).toBe(true); expect(storage.getItem(draftKey(scope))).toBeNull(); expect(storage.getItem(DRAFT_OWNER_KEY)).toBeNull();
  expect(storage.getItem("another-app")).toBe("unrelated"); expect(writeDeviceDraft(storage, scope, payload, "", 101)).toBe(false);
});

import { z } from "zod";

export const DRAFT_PREFIX = "algosprint:device-draft:v1:";
export const DRAFT_OWNER_KEY = "algosprint:device-draft-owner";
export const DRAFT_CLEAR_KEY = "algosprint:device-drafts-cleared";
export const DRAFT_CLEAR_EVENT = "algosprint:device-drafts-cleared";
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_DRAFTS = 12;
export const MAX_DRAFT_CHARS = 150_000;
const rating = z.int().min(0).max(2).nullable();
export const interviewDraftSchema = z.array(z.strictObject({ reasoning: z.string().max(4000), tradeoffs: z.string().max(4000), checks: z.string().max(4000), reasoningRating: rating, tradeoffsRating: rating, checksRating: rating })).min(1).max(3);
export const codeDraftSchema = z.partialRecord(z.enum(["JAVASCRIPT", "TYPESCRIPT", "PYTHON", "JAVA", "CPP", "SQL"]), z.string().max(64_000));
export type DraftScope = { owner: string; kind: "code" | "interview"; target: string; revision: string };
const recordSchema = z.strictObject({ version: z.literal(1), owner: z.string().min(1).max(128), kind: z.enum(["code", "interview"]), target: z.string().min(1).max(128), revision: z.string().min(1).max(1000), baseline: z.string().max(1000), updatedAt: z.number().finite(), payload: z.string().max(MAX_DRAFT_CHARS) });
export type DeviceDraft = z.infer<typeof recordSchema>;
type StorageLike = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
export type DraftRead = { status: "available"; draft: DeviceDraft | null } | { status: "unavailable"; draft: null };

function keys(storage: StorageLike) { return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key?.startsWith(DRAFT_PREFIX))); }
export function draftKey(scope: DraftScope) { return DRAFT_PREFIX + [scope.owner, scope.kind, scope.target].map(encodeURIComponent).join(":"); }
function parse(raw: string | null, now: number): DeviceDraft | null {
  if (!raw || raw.length > MAX_DRAFT_CHARS + 3000) return null;
  try {
    const result = recordSchema.safeParse(JSON.parse(raw));
    if (!result.success || now - result.data.updatedAt >= DRAFT_TTL_MS || result.data.updatedAt > now) return null;
    const payload = JSON.parse(result.data.payload);
    if (!(result.data.kind === "code" ? codeDraftSchema : interviewDraftSchema).safeParse(payload).success) return null;
    return result.data;
  } catch { return null; }
}
// A new verified account (or guest) removes the previous account's browser drafts.
export function readDeviceDraft(storage: StorageLike, scope: DraftScope | null, now = Date.now()): DraftRead {
  try {
    if (scope) storage.setItem(DRAFT_OWNER_KEY, scope.owner); else storage.removeItem(DRAFT_OWNER_KEY);
    let found: DeviceDraft | null = null;
    for (const key of keys(storage)) {
      const draft = parse(storage.getItem(key), now);
      if (!draft || !scope || draft.owner !== scope.owner || key !== draftKey(draft)) { storage.removeItem(key); continue; }
      if (key === draftKey(scope)) found = draft;
    }
    return { status: "available", draft: found };
  } catch { return { status: "unavailable", draft: null }; }
}
export function writeDeviceDraft(storage: StorageLike, scope: DraftScope, payload: string, baseline = "", now = Date.now()): boolean {
  try {
    if (storage.getItem(DRAFT_OWNER_KEY) !== scope.owner) return false;
    const record = { ...scope, version: 1 as const, payload, baseline, updatedAt: now };
    if (!parse(JSON.stringify(record), now)) return false;
    // Clean malformed, expired and other-owner records before enforcing a fixed bound.
    if (readDeviceDraft(storage, scope, now).status === "unavailable") return false;
    const existing = keys(storage).filter((key) => key !== draftKey(scope)).map((key) => ({ key, draft: parse(storage.getItem(key), now) })).sort((a, b) => (a.draft?.updatedAt ?? 0) - (b.draft?.updatedAt ?? 0));
    while (existing.length >= MAX_DRAFTS) storage.removeItem(existing.shift()!.key);
    storage.setItem(draftKey(scope), JSON.stringify(record));
    return true;
  } catch { return false; }
}
export function removeDeviceDraft(storage: StorageLike, scope: DraftScope): boolean {
  try { storage.removeItem(draftKey(scope)); return true; } catch { return false; }
}
export function clearDeviceDrafts(storage: StorageLike): boolean {
  try { for (const key of keys(storage)) storage.removeItem(key); storage.removeItem(DRAFT_OWNER_KEY); return true; } catch { return false; }
}
export function clearBrowserDrafts() {
  // Notify this page even if storage is denied. Other tabs stop writing on the storage event.
  window.dispatchEvent(new Event(DRAFT_CLEAR_EVENT));
  try { clearDeviceDrafts(window.localStorage); window.localStorage.setItem(DRAFT_CLEAR_KEY, `${Date.now()}:${Math.random()}`); } catch { /* Storage may be blocked. */ }
}

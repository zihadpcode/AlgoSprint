import { describe, expect, it } from "vitest";
import { relativeTime } from "@/components/workspace/relative-time";
import { EDITOR_SETTINGS_KEY, FONT_SIZE_MAX, FONT_SIZE_MIN, defaultEditorSettings, normalizeSettings, readEditorSettings, writeEditorSettings } from "@/components/editor/editor-settings";

describe("relative time", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  it("describes past times in the largest fitting unit", () => {
    expect(relativeTime("2026-10-19T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-10-19T11:55:00Z", now)).toBe("5 minutes ago");
    expect(relativeTime("2026-10-19T09:00:00Z", now)).toBe("3 hours ago");
    expect(relativeTime("2026-10-17T12:00:00Z", now)).toBe("2 days ago");
    expect(relativeTime("garbage", now)).toBe("just now");
  });
});
describe("editor settings", () => {
  it("normalizes untrusted stored values", () => {
    expect(normalizeSettings(null)).toEqual(defaultEditorSettings);
    expect(normalizeSettings({ fontSize: 400, wordWrap: "yes", minimap: true })).toEqual({ fontSize: FONT_SIZE_MAX, wordWrap: defaultEditorSettings.wordWrap, minimap: true });
    expect(normalizeSettings({ fontSize: 1 }).fontSize).toBe(FONT_SIZE_MIN);
  });
  it("round-trips through storage and tolerates blocked or corrupt storage", () => {
    const store = new Map<string, string>(); const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    writeEditorSettings(storage, { fontSize: 16, wordWrap: false, minimap: true }); expect(readEditorSettings(storage)).toEqual({ fontSize: 16, wordWrap: false, minimap: true });
    store.set(EDITOR_SETTINGS_KEY, "{not json"); expect(readEditorSettings(storage)).toEqual(defaultEditorSettings);
    const blocked = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(readEditorSettings(blocked)).toEqual(defaultEditorSettings); expect(() => writeEditorSettings(blocked, defaultEditorSettings)).not.toThrow(); expect(readEditorSettings(null)).toEqual(defaultEditorSettings);
  });
});

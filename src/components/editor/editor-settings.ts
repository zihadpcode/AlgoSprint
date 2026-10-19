export type EditorSettings = { fontSize: number; wordWrap: boolean; minimap: boolean };
export const EDITOR_SETTINGS_KEY = "algosprint:editor-settings:v1";
export const defaultEditorSettings: EditorSettings = { fontSize: 14, wordWrap: true, minimap: false };
export const FONT_SIZE_MIN = 11;
export const FONT_SIZE_MAX = 22;

export function normalizeSettings(value: unknown): EditorSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const size = typeof source.fontSize === "number" && Number.isFinite(source.fontSize) ? Math.round(source.fontSize) : defaultEditorSettings.fontSize;
  return {
    fontSize: Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size)),
    wordWrap: typeof source.wordWrap === "boolean" ? source.wordWrap : defaultEditorSettings.wordWrap,
    minimap: typeof source.minimap === "boolean" ? source.minimap : defaultEditorSettings.minimap,
  };
}
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function readEditorSettings(storage: StorageLike | null): EditorSettings {
  try { const raw = storage?.getItem(EDITOR_SETTINGS_KEY); return raw ? normalizeSettings(JSON.parse(raw)) : defaultEditorSettings; }
  catch { return defaultEditorSettings; }
}
export function writeEditorSettings(storage: StorageLike | null, settings: EditorSettings) {
  try { storage?.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(normalizeSettings(settings))); } catch { /* Preference only. */ }
}

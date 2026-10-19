// Editor keyboard shortcuts: Ctrl/Cmd+Enter runs, Ctrl/Cmd+Shift+Enter submits.
export type ShortcutAction = "run" | "submit";
type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; isComposing?: boolean; repeat?: boolean };

/** Which action a key press asks for, ignoring whether it is currently allowed. */
export function shortcutFor(event: KeyLike): ShortcutAction | null {
  if (event.key !== "Enter" || event.altKey || event.isComposing || event.repeat) return null;
  if (!event.ctrlKey && !event.metaKey) return null;
  return event.shiftKey ? "submit" : "run";
}

/** The action to perform: null unless the shortcut is recognised AND that action is enabled right now. */
export function resolveShortcut(event: KeyLike, allowed: { run: boolean; submit: boolean }): ShortcutAction | null {
  const action = shortcutFor(event);
  return action && allowed[action] ? action : null;
}

type TargetLike = { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null;
/** The custom-input editor handles its own Ctrl/Cmd+Enter; editable fields outside the editor panel keep their keys. */
export function shortcutIgnoresTarget(target: TargetLike): boolean {
  if (!target || typeof target.closest !== "function") return false;
  if (target.closest("[data-shortcut-scope='custom']")) return true;
  const editable = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName ?? "");
  return Boolean(editable && !target.closest("[data-editor-panel]"));
}

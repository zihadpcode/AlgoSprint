"use client";

import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/editor";
import "monaco-editor/features/register.all";
import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/typescript/register";
import "monaco-editor/languages/definitions/python/register";
import "monaco-editor/languages/definitions/java/register";
import "monaco-editor/languages/definitions/cpp/register";
import "monaco-editor/languages/definitions/sql/register";
import { defaultEditorSettings, type EditorSettings } from "./editor-settings";

export const MONACO_THEME = "algosprint-dark";
// Zinc palette from the design tokens: canvas #09090b, raised surface #18181b, indigo accent.
const themeColors = {
  "editor.background": "#09090b", "editor.foreground": "#e4e4e7",
  "editor.lineHighlightBackground": "#18181b99", "editor.lineHighlightBorder": "#00000000",
  "editor.selectionBackground": "#6366f155", "editor.inactiveSelectionBackground": "#6366f126",
  "editor.selectionHighlightBackground": "#6366f122", "editor.wordHighlightBackground": "#6366f122",
  "editor.findMatchBackground": "#fbbf2455", "editor.findMatchHighlightBackground": "#fbbf2426",
  "editorCursor.foreground": "#818cf8", "editorWhitespace.foreground": "#27272a",
  "editorLineNumber.foreground": "#52525b", "editorLineNumber.activeForeground": "#a1a1aa",
  "editorIndentGuide.background1": "#1f1f23", "editorIndentGuide.activeBackground1": "#3f3f46",
  "editorBracketMatch.background": "#6366f133", "editorBracketMatch.border": "#818cf866",
  "editorGutter.background": "#09090b", "editorWidget.background": "#18181b", "editorWidget.border": "#27272a",
  "editorSuggestWidget.background": "#18181b", "editorSuggestWidget.border": "#27272a", "editorSuggestWidget.selectedBackground": "#27272a",
  "editorHoverWidget.background": "#18181b", "editorHoverWidget.border": "#27272a",
  "scrollbarSlider.background": "#3f3f4666", "scrollbarSlider.hoverBackground": "#52525b88", "scrollbarSlider.activeBackground": "#71717a88",
  "minimap.background": "#09090b", "input.background": "#111113", "input.border": "#27272a", "focusBorder": "#818cf8",
};
const themeRules = [
  { token: "comment", foreground: "71717a", fontStyle: "italic" }, { token: "keyword", foreground: "a5b4fc" },
  { token: "string", foreground: "6ee7b7" }, { token: "number", foreground: "fcd34d" }, { token: "type", foreground: "67e8f9" },
  { token: "identifier", foreground: "e4e4e7" }, { token: "delimiter", foreground: "a1a1aa" }, { token: "regexp", foreground: "fda4af" },
];
function monoFamily() {
  let family = "";
  try { family = getComputedStyle(document.body).getPropertyValue("--font-jetbrains").trim(); } catch { /* Fall back below. */ }
  return `${family ? `${family}, ` : ""}"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
}

// Bundled same-origin worker; no CDN loader and no code-execution service.
self.MonacoEnvironment = {
  getWorker() {
    return new Worker(new URL("monaco-editor/editor/editor.worker.js", import.meta.url), { type: "module" });
  },
};

export default function MonacoSurface({ language, value, onChange, settings = defaultEditorSettings }: {
  language: string; value: string; onChange: (value: string) => void; settings?: EditorSettings;
}) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const callback = useRef(onChange);
  const syncing = useRef(false);
  const latestSettings = useRef(settings);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!container.current) return;
    monaco.editor.defineTheme(MONACO_THEME, { base: "vs-dark", inherit: true, rules: themeRules, colors: themeColors });
    const model = monaco.editor.createModel("", language);
    let instance: monaco.editor.IStandaloneCodeEditor;
    try { instance = monaco.editor.create(container.current, {
      model, theme: MONACO_THEME, automaticLayout: true, tabFocusMode: true,
      ariaLabel: `${language} code editor`, accessibilitySupport: "auto",
      ...optionsFor(latestSettings.current), tabSize: 2,
      fontFamily: monoFamily(), fontLigatures: false,
      scrollBeyondLastLine: false, padding: { top: 12, bottom: 12 },
      renderLineHighlight: "line", smoothScrolling: true, fixedOverflowWidgets: true,
    }); } catch (error) { model.dispose(); throw error; }
    editor.current = instance;
    // Re-measure once the web font is ready so the cursor lines up with JetBrains Mono.
    void document.fonts?.ready.then(() => { if (editor.current === instance) monaco.editor.remeasureFonts?.(); });
    const subscription = instance.onDidChangeModelContent(() => {
      if (!syncing.current) callback.current(instance.getValue());
    });
    return () => {
      subscription.dispose();
      instance.dispose();
      model.dispose();
      editor.current = null;
    };
  }, [language]);
  useEffect(() => {
    latestSettings.current = settings;
    editor.current?.updateOptions?.(optionsFor(settings));
  }, [settings]);
  useEffect(() => {
    const instance = editor.current;
    if (instance && instance.getValue() !== value) {
      syncing.current = true;
      try { instance.setValue(value); } finally { syncing.current = false; }
    }
  }, [value, language]);
  return <div ref={container} className="h-full min-h-[260px] min-w-0 overflow-hidden" />;
}

function optionsFor(settings: EditorSettings) {
  return { fontSize: settings.fontSize, lineHeight: Math.round(settings.fontSize * 1.65), wordWrap: settings.wordWrap ? "on" as const : "off" as const, minimap: { enabled: settings.minimap } };
}

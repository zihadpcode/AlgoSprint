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

// Bundled same-origin worker; no CDN loader and no code-execution service.
self.MonacoEnvironment = {
  getWorker() {
    return new Worker(new URL("monaco-editor/editor/editor.worker.js", import.meta.url), { type: "module" });
  },
};

export default function MonacoSurface({ language, value, onChange }: {
  language: string; value: string; onChange: (value: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const callback = useRef(onChange);
  const syncing = useRef(false);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!container.current) return;
    const model = monaco.editor.createModel("", language);
    let instance: monaco.editor.IStandaloneCodeEditor;
    try { instance = monaco.editor.create(container.current, {
      model, theme: "vs-dark", automaticLayout: true, tabFocusMode: true,
      ariaLabel: `${language} code editor`, accessibilitySupport: "auto",
      minimap: { enabled: false }, fontSize: 14, lineHeight: 24, tabSize: 2,
      scrollBeyondLastLine: false, wordWrap: "on", padding: { top: 16, bottom: 16 },
      fixedOverflowWidgets: true,
    }); } catch (error) { model.dispose(); throw error; }
    editor.current = instance;
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
    const instance = editor.current;
    if (instance && instance.getValue() !== value) {
      syncing.current = true;
      try { instance.setValue(value); } finally { syncing.current = false; }
    }
  }, [value, language]);
  return <div ref={container} className="h-[420px] min-w-0 overflow-hidden rounded-xl border border-line" />;
}

"use client";

import dynamic from "next/dynamic";
import { Component, useId, useRef, useState, type ReactNode } from "react";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExecutionPanels, type EditorExample } from "./execution-panels";
import { RunnerControls } from "./runner-controls";
import { ResetConfirmation } from "./reset-confirmation";
import { CodeBlock } from "@/components/problems/code-block";
import { draftFor, editorLanguages, type EditorDrafts, type EditorStarter } from "./editor-state";

const MonacoSurface = dynamic(() => import("./monaco-surface"), {
  ssr: false,
  loading: () => <p role="status" className="grid h-[420px] place-items-center rounded-xl border border-line text-sm text-muted">Loading code editor…</p>,
});

export function CodeEditor({ starters, examples = [], slug = "", runnerEnabled = false, signedIn = false }: { starters: EditorStarter[]; examples?: EditorExample[]; slug?: string; runnerEnabled?: boolean; signedIn?: boolean }) {
  const [selected, setSelected] = useState(starters[0]?.language);
  const [drafts, setDrafts] = useState<EditorDrafts>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const languageSelect = useRef<HTMLSelectElement>(null);
  const id = useId();
  const starter = starters.find((entry) => entry.language === selected);
  if (!starter) return <div className="mt-4 space-y-5"><p className="text-sm text-muted">No starter code is available for this problem yet.</p><ExecutionPanels examples={examples} /></div>;
  const language = editorLanguages[starter.language];
  const value = draftFor(starter, drafts);
  return <div className="mt-4 space-y-4">
    <label htmlFor={id} className="block text-sm font-semibold">Editor language</label>
    <Select ref={languageSelect} id={id} value={starter.language} onChange={(event) => {
      const next = starters.find((entry) => entry.language === event.target.value);
      if (next) { setSelected(next.language); setConfirmReset(false); setNotice(""); }
    }}>
      {starters.map((entry) => <option key={entry.language} value={entry.language}>{editorLanguages[entry.language].label}</option>)}
    </Select>
    <Button variant="secondary" disabled={value === starter.code || confirmReset} onClick={() => setConfirmReset(true)}>Reset to starter</Button>
    {confirmReset && <ResetConfirmation language={language.label} onCancel={() => {
      setConfirmReset(false);
      // The reset trigger is disabled while the prompt is open; return to the selector.
      languageSelect.current?.focus();
    }} onConfirm={() => {
      setDrafts((previous) => ({ ...previous, [starter.language]: starter.code }));
      setConfirmReset(false);
      setNotice(language.label + " code reset to starter.");
      languageSelect.current?.focus();
    }} />}
    <p role="status" aria-atomic="true" className="text-sm text-accent">{notice}</p>
    <p className="text-xs leading-6 text-muted">Entry point: <code>{starter.entryPoint}</code>. Drafts stay only on this open page; refreshing or leaving discards them.</p>
    <EditorBoundary fallback={<div role="alert" className="space-y-4"><p className="text-sm text-warm">The editor could not load. Copy your current code below before reloading.</p><CodeBlock label="Current code" code={value} /></div>}>
      <MonacoSurface language={language.id} value={value} onChange={(code) => {
        setConfirmReset(false);
        setNotice("");
        setDrafts((previous) => previous[starter.language] === code ? previous : { ...previous, [starter.language]: code });
      }} />
    </EditorBoundary>
    <p className="text-xs leading-6 text-muted">Monaco supports keyboard navigation and screen readers. Use its command palette for accessibility options.</p>
    <RunnerControls slug={slug} code={value} language={starter.language} enabled={runnerEnabled} signedIn={signedIn} examples={examples} />
  </div>;
}

class EditorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

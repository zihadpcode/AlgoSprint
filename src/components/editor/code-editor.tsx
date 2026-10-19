"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Minus, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { DeviceDraftRecovery } from "@/components/drafts/device-draft-recovery";
import { codeDraftSchema } from "@/features/drafts/storage";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/loading-state";
import { Popover } from "@/components/workspace/popover";
import { useWorkspaceLayout } from "@/components/workspace/split-pane";
import { ExecutionPanels, type EditorExample } from "./execution-panels";
import { RunnerControls } from "./runner-controls";
import { ResetConfirmation } from "./reset-confirmation";
import { CodeBlock } from "@/components/problems/code-block";
import { draftFor, editorLanguages, type EditorDrafts, type EditorStarter } from "./editor-state";
import { FONT_SIZE_MAX, FONT_SIZE_MIN, defaultEditorSettings, normalizeSettings, readEditorSettings, writeEditorSettings, type EditorSettings } from "./editor-settings";
import type { RunnerSignature } from "@/features/submissions/contracts";

const MonacoSurface = dynamic(() => import("./monaco-surface"), {
  ssr: false,
  loading: () => <div role="status" aria-label="Loading code editor" className="space-y-3 p-4"><p className="sr-only">Loading code editor…</p>
    <Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/5" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/4" /></div>,
});

export function CodeEditor({ starters, examples = [], slug = "", runnerEnabled = false, runnerLanguages = ["JAVASCRIPT"], signedIn = false, signature, draftOwner = null, revision }: { runnerLanguages?: readonly string[]; draftOwner?: string | null; revision?: number; starters: EditorStarter[]; examples?: EditorExample[]; slug?: string; runnerEnabled?: boolean; signedIn?: boolean; signature?: RunnerSignature }) {
  const [selected, setSelected] = useState(starters[0]?.language);
  const [drafts, setDrafts] = useState<EditorDrafts>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState<EditorSettings>(defaultEditorSettings);
  const [recoverable, setRecoverable] = useState(false);
  const languageSelect = useRef<HTMLSelectElement>(null);
  const layout = useWorkspaceLayout();
  const id = useId();
  const clearDrafts = useCallback(() => { setDrafts({}); setConfirmReset(false); setNotice("Device drafts cleared."); }, []);
  const dirty = starters.some((entry) => draftFor(entry, drafts) !== entry.code);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  // Editor preferences live in localStorage; read them after hydration so server and client markup agree.
  useEffect(() => {
    let saved: Storage | null = null;
    try { saved = window.localStorage; } catch { /* Blocked storage keeps the defaults. */ }
    const stored = readEditorSettings(saved);
    queueMicrotask(() => setSettings(stored));
  }, []);
  const updateSettings = (patch: Partial<EditorSettings>) => {
    const next = normalizeSettings({ ...settings, ...patch });
    setSettings(next);
    try { writeEditorSettings(window.localStorage, next); } catch { /* Preference only. */ }
  };
  const starter = starters.find((entry) => entry.language === selected);
  if (!starter) return <div data-editor-panel className="flex min-h-0 flex-1 flex-col"><p className="p-4 text-sm text-muted">No starter code is available for this problem yet.</p><div className="mt-auto"><ExecutionPanels examples={examples} /></div></div>;
  const language = editorLanguages[starter.language];
  const value = draftFor(starter, drafts);
  return <div data-editor-panel className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line bg-surface px-3 py-2">
      <label htmlFor={id} className="sr-only">Editor language</label>
      <Select ref={languageSelect} id={id} value={starter.language} className="h-8 w-auto min-w-28 text-[0.8125rem]" onChange={(event) => {
        const next = starters.find((entry) => entry.language === event.target.value);
        if (next) { setSelected(next.language); setConfirmReset(false); setNotice(""); }
      }}>
        {starters.map((entry) => <option key={entry.language} value={entry.language}>{editorLanguages[entry.language].label}</option>)}
      </Select>
      <p className="hidden text-xs text-subtle sm:block">Entry point: <code className="text-muted">{starter.entryPoint}</code>.</p>
      <p role="status" aria-atomic="true" className="min-w-0 truncate text-xs text-accent empty:hidden">{notice}</p>
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" variant="quiet" disabled={value === starter.code || confirmReset} onClick={() => setConfirmReset(true)}><RotateCcw aria-hidden="true" size={13} />Reset to starter</Button>
        <Popover label={recoverable ? "Device drafts: a saved draft is available" : "Device drafts"} icon={<Save aria-hidden="true" size={15} />} panelClassName="w-[min(24rem,calc(100vw-2rem))]"
          badge={recoverable ? <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-accent" /> : undefined}>
          <DeviceDraftRecovery onRecoveryChange={setRecoverable} scope={draftOwner && slug && revision !== undefined ? { owner: draftOwner, kind: "code", target: slug, revision: String(revision) } : null} value={JSON.stringify(drafts)} dirty={dirty} onClear={clearDrafts} onRestore={(payload) => {
            const restored = codeDraftSchema.safeParse(JSON.parse(payload));
            if (restored.success) {
              setDrafts(Object.fromEntries(Object.entries(restored.data).filter(([language]) => starters.some((entry) => entry.language === language))));
              setConfirmReset(false); setNotice("Device draft restored. Review before running.");
            }
          }} />
        </Popover>
        <Popover label="Editor settings" icon={<SlidersHorizontal aria-hidden="true" size={15} />} panelClassName="w-64">
          <SettingsForm settings={settings} onChange={updateSettings} />
        </Popover>
        {layout && <Button size="icon" variant="quiet" className="size-8" aria-pressed={layout.layout === "editor"} aria-label={layout.layout === "editor" ? "Restore split view" : "Maximize editor"} title={layout.layout === "editor" ? "Restore split view" : "Maximize editor"} onClick={layout.toggleLayout}>
          {layout.layout === "editor" ? <PanelLeftOpen aria-hidden="true" size={15} /> : <PanelLeftClose aria-hidden="true" size={15} />}</Button>}
      </div>
    </div>
    {confirmReset && <div className="shrink-0 border-b border-line bg-surface px-3 py-2"><ResetConfirmation language={language.label} onCancel={() => {
      setConfirmReset(false);
      // The reset trigger is disabled while the prompt is open; return to the selector.
      languageSelect.current?.focus();
    }} onConfirm={() => {
      setDrafts((previous) => ({ ...previous, [starter.language]: starter.code }));
      setConfirmReset(false);
      setNotice(language.label + " code reset to starter.");
      languageSelect.current?.focus();
    }} /></div>}
    <div className="relative min-h-[320px] flex-1 lg:min-h-0">
      <div className="absolute inset-0">
        <EditorBoundary fallback={<div role="alert" className="h-full space-y-3 overflow-auto p-4"><p className="text-sm text-warm">The editor could not load. Copy your current code below before reloading.</p><CodeBlock label="Current code" code={value} /></div>}>
          <MonacoSurface language={language.id} value={value} settings={settings} onChange={(code) => {
            setConfirmReset(false);
            setNotice("");
            setDrafts((previous) => previous[starter.language] === code ? previous : { ...previous, [starter.language]: code });
          }} />
        </EditorBoundary>
      </div>
    </div>
    <p className="sr-only">Monaco supports keyboard navigation and screen readers. Use its command palette for accessibility options. Press Control or Command plus Enter to run, and add Shift to submit.</p>
    <RunnerControls slug={slug} code={value} language={starter.language} enabled={runnerEnabled} serverLanguages={runnerLanguages} signedIn={signedIn} examples={examples} signature={signature} />
  </div>;
}

function SettingsForm({ settings, onChange }: { settings: EditorSettings; onChange: (patch: Partial<EditorSettings>) => void }) {
  const id = useId();
  return <div className="space-y-3 text-sm">
    <div className="flex items-center justify-between gap-3">
      <span id={`${id}-size`} className="text-muted">Font size</span>
      <div role="group" aria-labelledby={`${id}-size`} className="flex items-center gap-1">
        <Button size="icon" variant="secondary" className="size-7" aria-label="Decrease font size" disabled={settings.fontSize <= FONT_SIZE_MIN} onClick={() => onChange({ fontSize: settings.fontSize - 1 })}><Minus aria-hidden="true" size={13} /></Button>
        <output aria-live="polite" className="w-9 text-center font-mono text-xs tabular-nums">{settings.fontSize}px</output>
        <Button size="icon" variant="secondary" className="size-7" aria-label="Increase font size" disabled={settings.fontSize >= FONT_SIZE_MAX} onClick={() => onChange({ fontSize: settings.fontSize + 1 })}><Plus aria-hidden="true" size={13} /></Button>
      </div>
    </div>
    <Switch label="Word wrap" checked={settings.wordWrap} onChange={(wordWrap) => onChange({ wordWrap })} />
    <Switch label="Minimap" checked={settings.minimap} onChange={(minimap) => onChange({ minimap })} />
  </div>;
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3">
    <span className="text-muted">{label}</span>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full border transition-colors", checked ? "border-accent-solid bg-accent-solid" : "border-line-strong bg-surface-hover")}>
      <span aria-hidden="true" className={cn("absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white transition-transform", checked && "translate-x-4")} />
    </button>
  </div>;
}

class EditorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// @vitest-environment happy-dom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), createModel: vi.fn(), defineTheme: vi.fn(), remeasureFonts: vi.fn() }));
vi.mock("monaco-editor/editor", () => ({ editor: mocks }));
vi.mock("monaco-editor/features/register.all", () => ({}));
vi.mock("monaco-editor/languages/definitions/javascript/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/typescript/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/python/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/java/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/cpp/register", () => ({}));
vi.mock("monaco-editor/languages/definitions/sql/register", () => ({}));
import MonacoSurface from "@/components/editor/monaco-surface";

function fakeEditor() {
  let value = "";
  let listener = () => {};
  return {
    getValue: () => value,
    setValue: vi.fn((next: string) => { value = next; listener(); }),
    edit(next: string) { value = next; listener(); },
    subscription: { dispose: vi.fn() }, dispose: vi.fn(), updateOptions: vi.fn(),
    onDidChangeModelContent(fn: () => void) { listener = fn; return this.subscription; },
  };
}
let host: HTMLDivElement;
let root: Root;
let instances: ReturnType<typeof fakeEditor>[];
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); instances = [];
  mocks.createModel.mockImplementation(() => ({ dispose: vi.fn() }));
  mocks.create.mockImplementation(() => { const instance = fakeEditor(); instances.push(instance); return instance; });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
it("loads code without reporting a user edit and forwards actual edits to the current callback", async () => {
  const first = vi.fn(), latest = vi.fn();
  await act(() => root.render(createElement(MonacoSurface, { language: "javascript", value: "starter", onChange: first })));
  expect(instances[0].getValue()).toBe("starter"); expect(first).not.toHaveBeenCalled();
  expect(mocks.create.mock.calls[0][1]).toMatchObject({ tabFocusMode: true, automaticLayout: true, theme: "algosprint-dark", fontSize: 14, wordWrap: "on", minimap: { enabled: false } });
  expect(mocks.defineTheme).toHaveBeenCalledWith("algosprint-dark", expect.objectContaining({ base: "vs-dark", colors: expect.objectContaining({ "editor.background": "#09090b" }) }));
  await act(() => root.render(createElement(MonacoSurface, { language: "javascript", value: "starter", onChange: latest })));
  instances[0].edit("user draft"); expect(latest).toHaveBeenCalledWith("user draft"); expect(first).not.toHaveBeenCalled();
  await act(() => root.render(createElement(MonacoSurface, { language: "javascript", value: "user draft", onChange: latest })));
  expect(instances[0].setValue).toHaveBeenCalledTimes(1); // No setValue for a typing echo: keep undo history.
  expect(instances).toHaveLength(1);
});
it("disposes the old model, editor and listener when changing language", async () => {
  await act(() => root.render(createElement(MonacoSurface, { language: "javascript", value: "js draft", onChange: vi.fn() })));
  await act(() => root.render(createElement(MonacoSurface, { language: "python", value: "python draft", onChange: vi.fn() })));
  expect(instances[0].dispose).toHaveBeenCalledTimes(1);
  expect(instances[0].subscription.dispose).toHaveBeenCalledTimes(1);
  expect(mocks.createModel.mock.results[0].value.dispose).toHaveBeenCalledTimes(1);
  expect(instances[1].getValue()).toBe("python draft");
});
it("cleans up every Strict Mode mount without leaving an extra active model", async () => {
  await act(() => root.render(createElement(StrictMode, null, createElement(MonacoSurface, { language: "javascript", value: "starter", onChange: vi.fn() }))));
  await act(() => root.render(null));
  for (const instance of instances) { expect(instance.dispose).toHaveBeenCalledTimes(1); expect(instance.subscription.dispose).toHaveBeenCalledTimes(1); }
  for (const result of mocks.createModel.mock.results) expect(result.value.dispose).toHaveBeenCalledTimes(1);
});
it("applies changed editor settings to the live editor without recreating it", async () => {
  const base = { language: "javascript", value: "x", onChange: vi.fn() };
  await act(() => root.render(createElement(MonacoSurface, base)));
  await act(() => root.render(createElement(MonacoSurface, { ...base, settings: { fontSize: 18, wordWrap: false, minimap: true } })));
  expect(instances).toHaveLength(1);
  expect(instances[0].updateOptions).toHaveBeenLastCalledWith({ fontSize: 18, lineHeight: 30, wordWrap: "off", minimap: { enabled: true } });
});

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
it("keeps comments readable (4.5:1) and line numbers visibly above the background in the custom theme", async () => {
  await act(() => root.render(createElement(MonacoSurface, { language: "javascript", value: "x", onChange: vi.fn() })));
  const theme = mocks.defineTheme.mock.calls[0][1] as { rules: { token: string; foreground: string }[]; colors: Record<string, string> };
  const bg = theme.colors["editor.background"];
  expect(contrast(`#${theme.rules.find((r) => r.token === "comment")!.foreground}`, bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(theme.colors["editorLineNumber.foreground"], bg)).toBeGreaterThanOrEqual(3.5);
  expect(contrast(theme.colors["editorLineNumber.activeForeground"], bg)).toBeGreaterThan(contrast(theme.colors["editorLineNumber.foreground"], bg));
});

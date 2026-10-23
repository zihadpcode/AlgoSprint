// @vitest-environment happy-dom
import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/tabs";
import { StarterCode } from "@/components/problems/starter-code";
import { StudyLanguageProvider } from "@/components/workspace/study-language";
import { SplitPane, useWorkspaceLayout } from "@/components/workspace/split-pane";
import { WorkspaceVideoLessons } from "@/components/workspace/video-lessons";

const entries = [
  { language: "JAVASCRIPT" as const, entryPoint: "solve", code: "function solve() {}" },
  { language: "PYTHON" as const, entryPoint: "solve", code: "def solve(): pass" },
];
const videos = [{ youtubeId: "abcdefghij1", title: "Related lesson", channel: "Teacher", concept: "A concept",
  referenceProblem: "Reference", bridge: "A problem-specific explanation of the reference.", segments: [], codingLanguages: ["JAVASCRIPT" as const] }];
const walkthroughs = [{ slug: "ridge-count", language: "JAVASCRIPT" as const, title: "Ridge Count", src: "/videos/walkthroughs/ridge-count-javascript.mp4",
  captionsSrc: "/videos/walkthroughs/ridge-count-javascript.vtt", transcriptSrc: "/videos/walkthroughs/ridge-count-javascript.txt", durationSeconds: 87 }];
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  (window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }).happyDOM.settings.disableIframePageLoading = true;
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
function LayoutControl() {
  const layout = useWorkspaceLayout()!;
  return createElement("button", { onClick: layout.toggleLayout }, "Toggle editor focus");
}
const button = (text: string) => [...host.querySelectorAll("button")].find((entry) => entry.textContent?.includes(text))!;
async function renderWorkspace() {
  const lesson = createElement(WorkspaceVideoLessons, { videos, walkthroughs });
  const left = createElement(Tabs, { label: "Problem sections", defaultTab: "editorial", items: [
    { id: "description", label: "Description", content: createElement("p", null, "Problem statement") },
    { id: "editorial", label: "Editorial", content: createElement(Fragment, null,
      createElement("textarea", { "aria-label": "Retained draft", defaultValue: "keep this draft" }), lesson) },
  ] });
  const props = { languages: ["JAVASCRIPT", "PYTHON"], children: createElement(SplitPane, { left, right: createElement(LayoutControl) }) };
  await act(() => root.render(createElement(StudyLanguageProvider, props)));
  const details = host.querySelector("details")!;
  await act(() => { details.open = true; details.dispatchEvent(new Event("toggle")); });
  return details;
}
async function loadPlayers() {
  await act(() => { button("Play JavaScript walkthrough").click(); button("Load video player").click(); });
  expect(host.querySelectorAll("video,iframe")).toHaveLength(2);
}

it("unloads both players when switching tabs without losing drafts or disclosure state", async () => {
  const disclosure = await renderWorkspace(); await loadPlayers();
  const draft = host.querySelector("textarea")!; draft.value = "edited unsaved draft";
  await act(() => button("Description").click());
  expect(host.querySelectorAll("video,iframe")).toHaveLength(0);
  await act(() => button("Editorial").click());
  expect(host.querySelector("textarea")).toBe(draft); expect(draft.value).toBe("edited unsaved draft");
  expect(disclosure.open).toBe(true); expect(host.querySelectorAll("video,iframe")).toHaveLength(0);
  expect(button("Play JavaScript walkthrough")).toBeTruthy();
});

it("unloads players in editor-only layout and requires replay after restoring the problem panel", async () => {
  const disclosure = await renderWorkspace(); await loadPlayers();
  await act(() => button("Toggle editor focus").click());
  expect(host.querySelectorAll("video,iframe")).toHaveLength(0);
  await act(() => button("Toggle editor focus").click());
  expect(disclosure.open).toBe(true); expect(host.querySelectorAll("video,iframe")).toHaveLength(0);
  await loadPlayers();
});

it("keeps starter references and video language coordinated in both directions", async () => {
  const props = { languages: entries.map((entry) => entry.language),
    children: createElement(Fragment, null, createElement(StarterCode, { entries }), createElement(WorkspaceVideoLessons, { videos, walkthroughs })) };
  await act(() => root.render(createElement(StudyLanguageProvider, props)));
  const reference = host.querySelector<HTMLSelectElement>("select")!;
  const video = host.querySelectorAll<HTMLSelectElement>("select")[1];
  await act(() => { reference.value = "PYTHON"; reference.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(video.value).toBe("PYTHON"); expect(host.textContent).toContain("def solve(): pass");
  await act(() => { video.value = "JAVASCRIPT"; video.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(reference.value).toBe("JAVASCRIPT"); expect(host.textContent).toContain("function solve() {}");
});

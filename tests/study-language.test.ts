// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/features/submissions/actions", () => ({ executeCode: vi.fn() }));
vi.mock("@/components/drafts/device-draft-recovery", () => ({ DeviceDraftRecovery: () => null }));
vi.mock("next/dynamic", () => ({ default: () => function FakeSurface({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return createElement("textarea", { "aria-label": "Study test editor", value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) });
} }));
import { CodeEditor } from "@/components/editor/code-editor";
import { SolutionTabs } from "@/components/problems/solution-tabs";
import { VideoLesson } from "@/components/problems/video-lesson";
import { StudyLanguageProvider } from "@/components/workspace/study-language";
import type { ProblemDetail } from "@/features/problems/detail-query";
import type { EditorStarter } from "@/components/editor/editor-state";
import type { ProblemWalkthrough } from "@/lib/problem-walkthroughs";

const starters: EditorStarter[] = [
  { language: "JAVASCRIPT", entryPoint: "solve", code: "function solve() {}" },
  { language: "PYTHON", entryPoint: "solve", code: "def solve():\n    pass" },
];
const solution = (language: "JAVASCRIPT" | "PYTHON", kind: "BRUTE_FORCE" | "OPTIMAL" | "ALTERNATIVE") => ({
  language, kind, title: `${language} ${kind}`, intuition: "Intuition", approach: "Approach", pseudocode: "Pseudocode", code: `${language} code`,
  timeComplexity: "O(n)", spaceComplexity: "O(1)", commonMistakes: ["Mistake"], interviewExplanation: "Explanation",
  steps: [{ position: 1, title: "Step", content: "Step content" }],
});
const solutions: ProblemDetail["solutions"] = [solution("JAVASCRIPT", "BRUTE_FORCE"), solution("JAVASCRIPT", "OPTIMAL"),
  solution("PYTHON", "BRUTE_FORCE"), solution("PYTHON", "ALTERNATIVE"), solution("PYTHON", "OPTIMAL")];
const videos = [
  { youtubeId: "abcdefghij1", title: "JS source", channel: "Teacher", concept: "JS concept", referenceProblem: "Reference", bridge: "A bridge from the related example to this exact problem.", segments: [], codingLanguages: ["JAVASCRIPT"] },
  { youtubeId: "abcdefghij2", title: "Python source", channel: "Teacher", concept: "Python concept", referenceProblem: "Reference", bridge: "A bridge from the related example to this exact problem.", segments: [], codingLanguages: ["PYTHON"] },
  { youtubeId: "abcdefghij3", title: "Unknown-language source", channel: "Teacher", concept: "Unknown concept", referenceProblem: "Reference", bridge: "A bridge from the related example to this exact problem.", segments: [], codingLanguages: [] },
];
const walkthroughs: ProblemWalkthrough[] = ["JAVASCRIPT", "PYTHON"].map((language) => ({ slug: "ridge-count", language: language as ProblemWalkthrough["language"], title: "Ridge Count",
  src: `/videos/walkthroughs/ridge-count-${language.toLowerCase()}.mp4`, captionsSrc: `/videos/walkthroughs/ridge-count-${language.toLowerCase()}.vtt`,
  transcriptSrc: `/videos/walkthroughs/ridge-count-${language.toLowerCase()}.txt`, durationSeconds: 87 }));
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  (window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }).happyDOM.settings.disableIframePageLoading = true;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render(key = "problem-one") {
  const props = { key, languages: ["JAVASCRIPT", "PYTHON"], children: [
    createElement(CodeEditor, { key: "editor", starters }), createElement("section", { key: "solutions", "data-study-solutions": "" }, createElement(SolutionTabs, { solutions })),
    createElement(VideoLesson, { key: "videos", videos, walkthroughs }),
  ] };
  await act(() => root.render(createElement(StudyLanguageProvider, props)));
}
function select(label: string) {
  if (label === "Editor language") return host.querySelector<HTMLSelectElement>("select")!;
  return [...host.querySelectorAll("label")].find((entry) => entry.textContent?.includes(label))!.querySelector("select")!;
}
async function choose(label: string, language: string) {
  await act(() => { const field = select(label); field.value = language; field.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function type(code: string) {
  await act(() => {
    const field = host.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, code);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function button(text: string) { return [...host.querySelectorAll("button")].find((entry) => entry.textContent?.includes(text))!; }
function solutionHost() { return host.querySelector<HTMLElement>('[data-study-solutions]') ?? host; }
function activePanel() { return solutionHost().querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!; }

it("synchronizes all language selectors while retaining separate editor drafts", async () => {
  await render(); await type("saved JS draft");
  await choose("Solution language", "PYTHON");
  expect(select("Editor language").value).toBe("PYTHON"); expect(select("Video language").value).toBe("PYTHON");
  expect(host.querySelector("textarea")!.value).toBe(starters[1].code);
  expect(activePanel().textContent).toContain("PYTHON BRUTE_FORCE");
  expect(host.textContent).toContain("Python source"); expect(host.textContent).not.toContain("JS source");
  await type("saved Python draft"); await choose("Video language", "JAVASCRIPT");
  expect(select("Solution language").value).toBe("JAVASCRIPT"); expect(host.querySelector("textarea")!.value).toBe("saved JS draft");
  await choose("Editor language", "PYTHON"); expect(host.querySelector("textarea")!.value).toBe("saved Python draft");
});

it("invalidates pending reset confirmations across external language changes, including round trips", async () => {
  await render(); await type("keep this JS draft");
  await act(() => button("Reset to starter").click());
  expect(host.textContent).toContain("Keep my code");
  await choose("Solution language", "PYTHON"); await choose("Video language", "JAVASCRIPT");
  expect(host.textContent).not.toContain("Keep my code");
  expect(host.querySelector("textarea")!.value).toBe("keep this JS draft");
  expect(button("Reset to starter").disabled).toBe(false);
});

it("keeps the selected approach across languages and supports keyboard navigation with unequal counts", async () => {
  await render(); await act(() => button("Optimal · javascript").click());
  await choose("Solution language", "PYTHON"); expect(activePanel().textContent).toContain("PYTHON OPTIMAL");
  const tabs = () => [...solutionHost().querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  expect(tabs()).toHaveLength(3);
  await act(() => tabs()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
  expect(document.activeElement).toBe(tabs()[2]); expect(activePanel().textContent).toContain("PYTHON OPTIMAL");
  await act(() => tabs()[2].dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
  expect(document.activeElement).toBe(tabs()[0]); expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
  for (const tab of tabs()) expect(host.querySelector(`#${CSS.escape(tab.getAttribute("aria-controls")!)}`)?.getAttribute("aria-labelledby")).toBe(tab.id);
});

it("can select a duplicate approach kind in another language without a provider", async () => {
  await act(() => root.render(createElement(SolutionTabs, { solutions })));
  await act(() => button("Optimal · python").click());
  expect(activePanel().textContent).toContain("PYTHON OPTIMAL");
});

it("requires explicit playback, exposes captions, and unloads videos on a language switch", async () => {
  await render(); expect(host.querySelector("video, iframe")).toBeNull();
  await act(() => button("Play JavaScript walkthrough").click());
  expect(host.querySelector("video source")!.getAttribute("src")).toContain("javascript.mp4");
  expect(host.querySelector('track[kind="captions"]')!.getAttribute("src")).toContain("javascript.vtt");
  await choose("Video language", "PYTHON"); expect(host.querySelector("video, iframe")).toBeNull();
  expect(button("Play Python walkthrough")).toBeTruthy();
  expect(host.textContent).not.toContain("Unknown-language source");
  await act(() => button("other concept lessons").click());
  expect(host.textContent).toContain("Unknown-language source"); expect(host.textContent).toContain("coding language not verified");
  await choose("Editor language", "JAVASCRIPT"); await choose("Editor language", "PYTHON");
  expect(host.textContent).not.toContain("Unknown-language source");
});

it("resets language and drafts when the problem identity changes", async () => {
  await render(); await choose("Solution language", "PYTHON"); await type("old problem draft");
  await render("problem-two");
  expect(select("Editor language").value).toBe("JAVASCRIPT"); expect(host.querySelector("textarea")!.value).toBe(starters[0].code);
});

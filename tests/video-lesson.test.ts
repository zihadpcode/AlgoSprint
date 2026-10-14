// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";
import { VIDEO_FRAMING, VideoLesson } from "@/components/problems/video-lesson";

const video = {
  youtubeId: "s4DPM8ct1pI", title: "Binary Search - Leetcode 704 - Python", channel: "NeetCode",
  concept: "Binary search on a sorted array", referenceProblem: "Binary Search (LeetCode 704)",
  bridge: "BRIDGE-TEXT connects the halving idea to this problem's first qualifying index.",
  segments: [{ startSeconds: 58, endSeconds: 310, label: "Drawing explanation" }, { startSeconds: 310, endSeconds: 579, label: "Coding explanation" }],
};
let host: HTMLDivElement; let root: Root; let errors: MockInstance<typeof process.stderr.write>;
beforeEach(() => {
  // happy-dom would otherwise really fetch the iframe's URL; a unit test must never contact YouTube.
  (window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }).happyDOM.settings.disableIframePageLoading = true;
  errors = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount()); host.remove();
  // happy-dom reports (on stderr) that it refused to load the iframe; it must never have attempted a network fetch.
  const output = errors.mock.calls.map((call) => String(call[0])).join("");
  errors.mockRestore();
  expect(output).not.toMatch(/NetworkError|fetch\(\)/);
});
const render = (videos = [video]) => act(() => root.render(createElement(VideoLesson, { videos })));
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;

it("renders nothing without videos", async () => {
  await render([]);
  expect(host.innerHTML).toBe("");
});
it("states that the video uses a different example and is not a walkthrough, without loading anything", async () => {
  await render();
  expect(VIDEO_FRAMING).toMatch(/different example problem/);
  expect(VIDEO_FRAMING).toMatch(/not a walkthrough of this problem/);
  expect(host.textContent).toContain(VIDEO_FRAMING);
  expect(host.textContent).toContain("Concept: Binary search on a sorted array");
  expect(host.textContent).toContain("Binary Search (LeetCode 704)");
  expect(host.textContent).toContain("BRIDGE-TEXT");
  expect(host.querySelector("iframe")).toBeNull();
  expect(host.querySelector("details")?.hasAttribute("open")).toBe(false);
});
it("loads the nocookie embed only after a click, with a descriptive title and an explicit referrer policy", async () => {
  await render();
  await act(async () => { button("Load video player").click(); });
  const frame = host.querySelector("iframe")!;
  expect(frame.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/s4DPM8ct1pI?rel=0&autoplay=1");
  expect(frame.getAttribute("title")).toContain("Binary Search - Leetcode 704 - Python");
  expect(frame.getAttribute("title")).toContain("Binary search on a sorted array");
  expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
  expect(frame.hasAttribute("allowfullscreen")).toBe(true);
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Video player loaded.");
});
it("starts at a chapter's time from a keyboard-reachable button, and links to YouTube at the same time", async () => {
  await render();
  const chip = button("Coding explanation");
  expect(chip.tagName).toBe("BUTTON"); expect(chip.getAttribute("type")).toBe("button");
  expect(chip.textContent).toContain("5:10");
  const link = () => host.querySelector("a")!;
  expect(link().getAttribute("href")).toBe("https://www.youtube.com/watch?v=s4DPM8ct1pI");
  await act(async () => { chip.click(); });
  expect(host.querySelector("iframe")!.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/s4DPM8ct1pI?rel=0&start=310&autoplay=1");
  expect(link().getAttribute("href")).toBe("https://www.youtube.com/watch?v=s4DPM8ct1pI&t=310s");
  expect(link().getAttribute("rel")).toContain("noopener");
  await act(async () => { button("Drawing explanation").click(); });
  expect(host.querySelector("iframe")!.getAttribute("src")).toContain("start=58");
});
it("shows no timestamp chips when a video has no verified segments", async () => {
  await render([{ ...video, segments: [] }]);
  expect(host.textContent).not.toContain("Where the core idea is explained");
  expect(host.querySelectorAll("button")).toHaveLength(1);
  expect(host.querySelector("a")?.textContent).toContain("Watch on YouTube");
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RoadmapNext, RoadmapProgress, RoadmapSteps } from "@/components/roadmaps/roadmap-content";
import type { RoadmapView } from "@/features/roadmaps/query";
import { roadmapProgress, recommendStep } from "@/features/roadmaps/policy";
import { progressView } from "@/features/progress/presentation";
const fixture = (): RoadmapView => ({ slug: "sample", title: "Original <script>path</script>", description: "Learn", difficulty: "EASY", estimatedMinutes: 10,
  steps: [{ position: 1, title: "Try <script>this</script>", description: "Compare", problem: { slug: "quiet-badge", title: "Quiet Badge", difficulty: "EASY", estimatedMinutes: 15 }, progress: null }], progress: null, next: null });
it("renders guest guidance without fabricated zero progress", () => {
  const roadmap = fixture(); roadmap.next = recommendStep(roadmap.steps, false);
  const html = renderToStaticMarkup(createElement(RoadmapProgress, { roadmap }));
  expect(html).toContain("Sign in"); expect(html).not.toContain("0%");
  expect(renderToStaticMarkup(createElement(RoadmapNext, { roadmap }))).toContain('href="/problems/quiet-badge"');
});
it("uses ordered semantic steps, real links, textual status and escaped content", () => {
  const roadmap = fixture(); roadmap.steps[0].progress = progressView({ status: "SOLVED", selfMarked: false, reviewLater: true, verifiedRevision: 1 }, 2);
  roadmap.progress = roadmapProgress(roadmap.steps, true);
  const html = renderToStaticMarkup(createElement(RoadmapSteps, { roadmap }));
  for (const value of ["<ol", "Step 1", "Solved · verified on an earlier revision", "Review later", "&lt;script&gt;", 'href="/problems/quiet-badge"']) expect(html).toContain(value);
  expect(html).not.toContain("<script>");
  const summary = renderToStaticMarkup(createElement(RoadmapProgress, { roadmap }));
  for (const value of ["1 / 1", "100%", "1 verified on earlier revisions", "<progress", "aria-label=", "not mastery"]) expect(summary).toContain(value);
});
it("describes all-solved as recorded progress, without claiming mastery or execution", () => {
  const html = renderToStaticMarkup(createElement(RoadmapNext, { roadmap: fixture() }));
  expect(html).toContain("All steps are recorded solved"); expect(html).toContain("repeat any step"); expect(html).not.toContain("mastered");
});
import { RoadmapCard } from "@/components/roadmaps/roadmap-content";
const track = (): RoadmapView => {
  const step = (position: number, slug: string, solved: boolean) => ({ position, title: "Step " + position + " title", description: null,
    problem: { slug, title: slug, difficulty: "MEDIUM" as const, estimatedMinutes: 10 },
    progress: progressView({ status: solved ? "SOLVED" : "NOT_STARTED", selfMarked: true, reviewLater: false, verifiedRevision: null }, 1) });
  const steps = [step(1, "one", true), step(2, "two", false), step(3, "three", false)];
  return { slug: "track", title: "Track", description: "d", difficulty: "MEDIUM", estimatedMinutes: 30, steps, progress: roadmapProgress(steps, true), next: recommendStep(steps, true) };
};
it("marks solved steps, highlights only the first unsolved step and gives it a Continue button", () => {
  const html = renderToStaticMarkup(createElement(RoadmapSteps, { roadmap: track() }));
  expect(html.match(/Up next/g)).toHaveLength(1);
  expect(html.match(/>Continue</g)).toHaveLength(1);
  expect(html.indexOf("Up next")).toBeGreaterThan(html.indexOf("Step 1 title"));
  expect(html.indexOf("Up next")).toBeLessThan(html.indexOf("Step 3 title"));
  expect(html).toContain("Solved · self-marked");
});
it("offers Start to guests on the first step", () => {
  const roadmap = track(); roadmap.progress = null;
  roadmap.steps = roadmap.steps.map((s) => ({ ...s, progress: null })); roadmap.next = recommendStep(roadmap.steps, false);
  const html = renderToStaticMarkup(createElement(RoadmapSteps, { roadmap }));
  expect(html).toContain("Start here"); expect(html).toContain(">Start<"); expect(html).not.toContain("Continue");
});
it("shows card progress for signed-in viewers and a sign-in hint for guests, without a fabricated zero", () => {
  const signed = renderToStaticMarkup(createElement(RoadmapCard, { roadmap: track() }));
  for (const text of ["1 / 3 steps solved", "33%", "<progress", ">Continue<", "3 steps"]) expect(signed).toContain(text);
  const roadmap = track(); roadmap.progress = null;
  const guest = renderToStaticMarkup(createElement(RoadmapCard, { roadmap }));
  expect(guest).toContain("Sign in to track your progress"); expect(guest).not.toContain("0%"); expect(guest).toContain("Open roadmap");
});

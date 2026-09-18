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

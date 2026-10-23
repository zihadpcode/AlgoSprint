"use client";

import { VideoLesson } from "@/components/problems/video-lesson";
import { useTabPanelActive } from "@/components/ui/tabs";
import type { ProblemDetail } from "@/features/problems/detail-query";
import { useWorkspaceLayout } from "./split-pane";

export function WorkspaceVideoLessons({ videos, walkthroughs }: Pick<ProblemDetail, "videos" | "walkthroughs">) {
  const tabActive = useTabPanelActive();
  const layout = useWorkspaceLayout();
  return <VideoLesson videos={videos} walkthroughs={walkthroughs} isVisible={tabActive && layout?.layout !== "editor"} />;
}

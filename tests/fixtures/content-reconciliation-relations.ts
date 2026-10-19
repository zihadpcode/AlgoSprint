import { createHash } from "node:crypto";
import frozen from "./content-reconciliation-1bacb2f.json";
import { canonicalJson } from "../../prisma/seed-data";
import { validateRoadmapReferences, type RoadmapSeed } from "@/lib/validators/roadmap";
import { validateVideoReferences, type VideoSeed } from "@/lib/validators/video";

// Materialized from the reviewed 1bac files, after exact byte comparison with
// those immutable git objects. Runtime tests never evaluate git-sourced TS.
export const RECONCILIATION_RELATIONS_SHA256 = "a4879ae19f7ab6468b669731a5f4076d23c3ac76ded9ce983f371af0c505f07b";
export function reconciliationRelations(publishedSlugs: ReadonlySet<string>): { roadmaps: RoadmapSeed[]; videos: VideoSeed[] } {
  const hash = createHash("sha256").update(canonicalJson(frozen)).digest("hex");
  if (hash !== RECONCILIATION_RELATIONS_SHA256 || frozen.source !== "1bacb2f947de89e92cb4fc08604132c1b78090e0") throw new Error("Frozen reconciliation relation fixture identity changed.");
  const roadmaps = validateRoadmapReferences(frozen.roadmaps, publishedSlugs);
  const videos = validateVideoReferences(frozen.videos, publishedSlugs);
  if (roadmaps.length !== 18 || roadmaps.reduce((sum, roadmap) => sum + roadmap.steps.length, 0) !== 307 || videos.length !== 35) throw new Error("Frozen reconciliation relation fixture scope changed.");
  return { roadmaps, videos };
}

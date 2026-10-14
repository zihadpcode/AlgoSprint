import { z } from "zod";
import { MAX_VIDEO_SECONDS, YOUTUBE_ID_PATTERN } from "@/lib/youtube";

const slug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = (min: number, max: number) => z.string().trim().min(min).max(max).refine((value) => !value.includes("\u0000"), "NUL is not allowed");
const seconds = z.int().min(0).max(MAX_VIDEO_SECONDS);

export const segmentSchema = z.strictObject({
  startSeconds: seconds, endSeconds: seconds, label: text(1, 80),
}).refine((segment) => segment.endSeconds > segment.startSeconds, { message: "endSeconds must be greater than startSeconds", path: ["endSeconds"] });
export type VideoSegment = z.infer<typeof segmentSchema>;

export const segmentsSchema = z.array(segmentSchema).max(12).superRefine((segments, ctx) => {
  for (let i = 1; i < segments.length; i++) {
    // Sorted by start and non-overlapping: each segment must begin where or after the previous one ended.
    if (segments[i].startSeconds < segments[i - 1].endSeconds) ctx.addIssue({ code: "custom", message: "Segments must be sorted and must not overlap", path: [i, "startSeconds"] });
  }
});

export const videoSchema = z.strictObject({
  problemSlug: slug,
  youtubeId: z.string().regex(YOUTUBE_ID_PATTERN, "Not an 11-character YouTube video id"),
  title: text(1, 200), channel: text(1, 120),
  concept: text(1, 160), referenceProblem: text(1, 200),
  bridge: text(40, 1500),
  segments: segmentsSchema,
});
export type VideoSeed = z.infer<typeof videoSchema>;

export const MAX_VIDEOS_PER_PROBLEM = 5;
export const videoBatchSchema = z.array(videoSchema).max(500).superRefine((videos, ctx) => {
  const seen = new Set<string>(); const perProblem = new Map<string, number>();
  for (const [i, video] of videos.entries()) {
    const key = `${video.problemSlug}\u0000${video.youtubeId}`;
    if (seen.has(key)) ctx.addIssue({ code: "custom", message: "Duplicate video for the same problem", path: [i, "youtubeId"] });
    seen.add(key);
    const count = (perProblem.get(video.problemSlug) ?? 0) + 1;
    perProblem.set(video.problemSlug, count);
    if (count > MAX_VIDEOS_PER_PROBLEM) ctx.addIssue({ code: "custom", message: `At most ${MAX_VIDEOS_PER_PROBLEM} videos per problem`, path: [i, "problemSlug"] });
  }
});

export function validateVideoReferences(input: unknown, publishedSlugs: ReadonlySet<string>) {
  const videos = videoBatchSchema.parse(input);
  for (const video of videos) {
    if (!publishedSlugs.has(video.problemSlug)) throw new Error(`Video ${video.youtubeId} requires published problem ${video.problemSlug}.`);
  }
  return videos;
}

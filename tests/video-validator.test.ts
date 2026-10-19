import { describe, expect, it } from "vitest";
import { VIDEOS } from "@/data/seeds/videos";
import { segmentsSchema, validateVideoReferences, videoBatchSchema, videoSchema } from "@/lib/validators/video";
import { loadProblems } from "../scripts/lib/load-problems";

const good = VIDEOS[0];
const bad = (patch: Record<string, unknown>) => videoSchema.safeParse({ ...good, ...patch }).success;
const seg = (startSeconds: number, endSeconds: number, label = "Part") => ({ startSeconds, endSeconds, label });

describe("video seed validator", () => {
  it("accepts every shipped video against the published problem set", async () => {
    const published = (await loadProblems()).filter((p) => p.status === "PUBLISHED").map((p) => p.slug);
    expect(validateVideoReferences(VIDEOS, new Set(published))).toHaveLength(VIDEOS.length);
    expect(VIDEOS.length).toBeGreaterThanOrEqual(10);
    expect(VIDEOS.length).toBeLessThanOrEqual(60);
  });
  it("rejects videos for missing or unpublished problems", () => {
    expect(() => validateVideoReferences(VIDEOS, new Set(["only-this"]))).toThrow(/requires published problem/);
  });
  it("is strict about unknown keys and youtube id shape", () => {
    expect(bad({})).toBe(true);
    expect(bad({ extra: "x" })).toBe(false);
    for (const youtubeId of ["", "short", "abcdefghijkl", "abc def ghi", "https://x.test", "ab/cdefghij", "abcdefghij!"]) expect(bad({ youtubeId })).toBe(false);
  });
  it("bounds text lengths and rejects blank or NUL text", () => {
    expect(bad({ title: "" })).toBe(false);
    expect(bad({ title: "x".repeat(201) })).toBe(false);
    expect(bad({ channel: "   " })).toBe(false);
    expect(bad({ concept: "x".repeat(161) })).toBe(false);
    expect(bad({ referenceProblem: "x".repeat(201) })).toBe(false);
    expect(bad({ bridge: "too short" })).toBe(false);
    expect(bad({ bridge: "x".repeat(1501) })).toBe(false);
    expect(bad({ bridge: `${"x".repeat(60)}\u0000` })).toBe(false);
    expect(bad({ problemSlug: "Bad Slug" })).toBe(false);
  });
  it("requires endSeconds > startSeconds and whole, bounded numbers", () => {
    expect(segmentsSchema.safeParse([seg(10, 20)]).success).toBe(true);
    for (const s of [seg(20, 20), seg(30, 20), seg(-1, 5), seg(1.5, 5), seg(0, 43201), { ...seg(1, 2), label: "" }, { ...seg(1, 2), extra: 1 }]) expect(segmentsSchema.safeParse([s]).success).toBe(false);
    expect(segmentsSchema.safeParse([{ startSeconds: 1, endSeconds: Number.NaN, label: "x" }]).success).toBe(false);
  });
  it("requires segments to be sorted and non-overlapping, allowing none and touching ends", () => {
    expect(segmentsSchema.safeParse([]).success).toBe(true);
    expect(segmentsSchema.safeParse([seg(0, 10), seg(10, 20), seg(25, 30)]).success).toBe(true);
    expect(segmentsSchema.safeParse([seg(0, 10), seg(9, 20)]).success).toBe(false);
    expect(segmentsSchema.safeParse([seg(30, 40), seg(0, 10)]).success).toBe(false);
    expect(segmentsSchema.safeParse(Array.from({ length: 13 }, (_, i) => seg(i * 10, i * 10 + 5))).success).toBe(false);
  });
  it("rejects a duplicate video id for the same problem but allows it across problems", () => {
    expect(videoBatchSchema.safeParse([good, { ...good, concept: "Other" }]).success).toBe(false);
    expect(videoBatchSchema.safeParse([good, { ...good, problemSlug: "another-problem" }]).success).toBe(true);
  });
  it("limits the number of videos per problem", () => {
    const ids = ["aaaaaaaaaa1", "aaaaaaaaaa2", "aaaaaaaaaa3", "aaaaaaaaaa4", "aaaaaaaaaa5", "aaaaaaaaaa6"];
    expect(videoBatchSchema.safeParse(ids.slice(0, 5).map((youtubeId) => ({ ...good, youtubeId }))).success).toBe(true);
    expect(videoBatchSchema.safeParse(ids.map((youtubeId) => ({ ...good, youtubeId }))).success).toBe(false);
  });
  it("ships only the honestly framed data: reference problem named, bridge present, chapters from the video", () => {
    for (const video of VIDEOS) {
      expect(video.referenceProblem.length).toBeGreaterThan(5);
      expect(video.bridge.length).toBeGreaterThanOrEqual(150);
      expect(video.channel).toBe("NeetCode");
      for (const segment of video.segments) expect(segment.endSeconds).toBeGreaterThan(segment.startSeconds);
    }
  });
});

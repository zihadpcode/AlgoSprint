import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { assertCompleteVideoCoverage, validateOriginalWalkthroughAssets, validateVideoCatalog, videoCoverageReport, videoSourceCatalogSchema,
  type VideoSource, type WalkthroughManifestEntry } from "../scripts/lib/video-coverage";
import type { VideoSeed } from "@/lib/validators/video";
import { videoLanguages } from "@/lib/video-languages";

const video: VideoSeed = { problemSlug: "ridge-count", youtubeId: "abcdefghij1", title: "Verified reference", channel: "Teacher", concept: "Track a maximum",
  referenceProblem: "Running maximum", bridge: "A verified lesson on maintaining the maximum observed value while scanning a sequence.", segments: [] };
const source: VideoSource = { youtubeId: video.youtubeId, title: video.title, channel: video.channel, languages: ["PYTHON"], segments: [],
  verifiedAt: "2026-10-22", oEmbedUrl: "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=abcdefghij1",
  languageEvidence: [{ languages: ["PYTHON"], evidence: "Creator explicitly demonstrates Python code.", sourceUrl: "https://www.youtube.com/watch?v=abcdefghij1" }],
  references: [{ problemSlug: "ridge-count", languages: ["PYTHON"], coverage: "RELATED_ALGORITHM", coverageRationale: "The source explains the running maximum technique.", caveat: null }] };
const publishedSlugs = new Set(["ridge-count"]);
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const captions = "WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nTrack the maximum.\n";
const transcript = "Track the maximum.\n";
const media = Buffer.from("fixture video bytes");
const original: WalkthroughManifestEntry = { slug: "ridge-count", language: "JAVASCRIPT", title: "Ridge Count", src: "/videos/walkthroughs/ridge-count-javascript.mp4",
  captionsSrc: "/videos/walkthroughs/ridge-count-javascript.vtt", transcriptSrc: "/videos/walkthroughs/ridge-count-javascript.txt", durationSeconds: 2,
  sourceHash: "a".repeat(64), sha256: digest(media), captionsSha256: digest(captions), transcriptSha256: digest(transcript), rendererVersion: "test-v1", width: 1280, height: 720 };
const jobs = [{ slug: original.slug, language: original.language, sourceHash: original.sourceHash }];
let fixtureRoot: string | undefined;
afterEach(async () => { if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true }); fixtureRoot = undefined; });
async function assets() {
  fixtureRoot = await mkdtemp(join(tmpdir(), "algosprint-video-coverage-test-"));
  await mkdir(join(fixtureRoot, "public/videos/walkthroughs"), { recursive: true });
  for (const [path, content] of [[original.src, media], [original.captionsSrc, captions], [original.transcriptSrc, transcript]] as const) {
    await writeFile(join(fixtureRoot, "public", path), content);
  }
  return fixtureRoot;
}

it("requires a verified source and exact recorded metadata without inferring language from titles", () => {
  expect(validateVideoCatalog([source], [video], publishedSlugs)).toHaveLength(1);
  expect(() => validateVideoCatalog([], [video], publishedSlugs)).toThrow("metadata differs");
  expect(() => validateVideoCatalog([{ ...source, title: "Different title" }], [video], publishedSlugs)).toThrow("metadata differs");
  expect(() => validateVideoCatalog([{ ...source, segments: [{ startSeconds: 0, endSeconds: 1, label: "Claim" }] }], [video], publishedSlugs)).toThrow("chapters differ");
  expect(videoLanguages("zzzzzzzzzzz")).toEqual([]);
});

it("rejects duplicate sources, missing language evidence, unknown problems, and cross-language coverage claims", () => {
  expect(() => videoSourceCatalogSchema.parse([source, source])).toThrow("Duplicate source");
  expect(() => videoSourceCatalogSchema.parse([{ ...source, languages: ["JAVASCRIPT", "PYTHON"] }])).toThrow("Missing JAVASCRIPT");
  expect(() => validateVideoCatalog([{ ...source, references: [{ ...source.references[0], problemSlug: "unknown" }] }], [video], publishedSlugs)).toThrow("Unknown video reference");
  expect(() => validateVideoCatalog([{ ...source, references: [{ ...source.references[0], languages: ["JAVASCRIPT"] }] }], [video], publishedSlugs)).toThrow("unverified instruction language");
});

it("does not count prerequisite, unverified, unseeded, or wrong-language references as complete solutions", () => {
  for (const coverage of ["PREREQUISITE_ONLY", "UNVERIFIED_LANGUAGE"] as const) {
    const report = videoCoverageReport({ publishedSlugs, videos: [video], sources: [{ ...source, references: [{ ...source.references[0], coverage }] }], walkthroughs: [] });
    expect(report.covered).toBe(0); expect(report.missing).toHaveLength(2);
  }
  expect(videoCoverageReport({ publishedSlugs, videos: [], sources: [source], walkthroughs: [] }).covered).toBe(0);
  const report = videoCoverageReport({ publishedSlugs, videos: [video], sources: [source], walkthroughs: [] });
  expect(report.covered).toBe(1); expect(report.missing).toEqual([{ slug: "ridge-count", language: "JAVASCRIPT" }]);
  expect(() => assertCompleteVideoCoverage(report)).toThrow("ridge-count/JAVASCRIPT");
});

it("combines a language-specific external lesson and an exact original without double counting", () => {
  const report = videoCoverageReport({ publishedSlugs, videos: [video], sources: [source], walkthroughs: [original, original] });
  expect(report).toEqual({ required: 2, covered: 2, missing: [] });
  expect(() => assertCompleteVideoCoverage(report)).not.toThrow();
});

it("accepts matching local assets and rejects stale sources, duplicates, and unsafe paths", async () => {
  const root = await assets();
  expect(await validateOriginalWalkthroughAssets([original], jobs, root)).toHaveLength(1);
  await expect(validateOriginalWalkthroughAssets([{ ...original, sourceHash: "b".repeat(64) }], jobs, root)).rejects.toThrow("stale or unknown");
  await expect(validateOriginalWalkthroughAssets([original, original], jobs, root)).rejects.toThrow("Duplicate original walkthrough");
  await expect(validateOriginalWalkthroughAssets([{ ...original, src: "../outside.mp4" }], jobs, root)).rejects.toThrow("Unsafe original walkthrough path");
});

it("rejects missing, modified, empty, or oversized media and changed accessibility assets", async () => {
  const root = await assets(); const path = (value: string) => join(root, "public", value);
  await writeFile(path(original.src), "changed");
  await expect(validateOriginalWalkthroughAssets([original], jobs, root)).rejects.toThrow("media hash differs");
  await writeFile(path(original.src), Buffer.alloc(0));
  await expect(validateOriginalWalkthroughAssets([{ ...original, sha256: digest("") }], jobs, root)).rejects.toThrow("media hash differs");
  const oversized = Buffer.alloc(12 * 1024 * 1024 + 1);
  await writeFile(path(original.src), oversized);
  await expect(validateOriginalWalkthroughAssets([{ ...original, sha256: digest(oversized) }], jobs, root)).rejects.toThrow("media hash differs");
  await writeFile(path(original.src), media); await writeFile(path(original.captionsSrc), captions + "changed");
  await expect(validateOriginalWalkthroughAssets([original], jobs, root)).rejects.toThrow("text hash differs");
  await writeFile(path(original.captionsSrc), captions); await rm(path(original.transcriptSrc));
  await expect(validateOriginalWalkthroughAssets([original], jobs, root)).rejects.toThrow();
});

it("rejects hash-consistent but invalid, overlapping, or beyond-duration caption cues", async () => {
  const root = await assets();
  for (const malformed of [
    "WEBVTT\n\n1\n00:00:01.000 --> 00:00:00.000\nBackwards\n",
    "WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.500\nOne\n\n2\n00:00:01.000 --> 00:00:02.000\nOverlapping\n",
    "WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\nBeyond duration\n",
    "WEBVTT\n\n1\nbad --> timestamp\nMalformed\n",
  ]) {
    await writeFile(join(root, "public", original.captionsSrc), malformed);
    await expect(validateOriginalWalkthroughAssets([{ ...original, captionsSha256: digest(malformed) }], jobs, root)).rejects.toThrow();
  }
});

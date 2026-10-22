import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { YOUTUBE_ID_PATTERN } from "../../src/lib/youtube";
import { segmentsSchema, type VideoSeed } from "../../src/lib/validators/video";

const language = z.enum(["JAVASCRIPT", "PYTHON"]);
const coverage = z.enum(["RELATED_ALGORITHM", "PREREQUISITE_ONLY", "UNVERIFIED_LANGUAGE"]);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const sourceSchema = z.object({
  youtubeId: z.string().regex(YOUTUBE_ID_PATTERN), title: z.string().min(1).max(200), channel: z.string().min(1).max(120),
  languages: z.array(language), segments: segmentsSchema, verifiedAt: z.iso.date(), oEmbedUrl: z.url(),
  languageEvidence: z.array(z.object({ languages: z.array(language), evidence: z.string().min(10), sourceUrl: z.url() })).min(1),
  references: z.array(z.object({ problemSlug: slug, languages: z.array(language), coverage,
    coverageRationale: z.string().min(10), caveat: z.string().nullable() })),
});
export const videoSourceCatalogSchema = z.array(sourceSchema).superRefine((sources, ctx) => {
  const ids = new Set<string>();
  for (const [index, source] of sources.entries()) {
    if (ids.has(source.youtubeId)) ctx.addIssue({ code: "custom", message: "Duplicate source video", path: [index, "youtubeId"] });
    ids.add(source.youtubeId);
    for (const supported of source.languages) {
      if (!source.languageEvidence.some((proof) => proof.languages.includes(supported))) {
        ctx.addIssue({ code: "custom", message: `Missing ${supported} instruction evidence`, path: [index, "languageEvidence"] });
      }
    }
  }
});
export type VideoSource = z.infer<typeof sourceSchema>;
export const walkthroughManifestSchema = z.array(z.strictObject({
  slug, language, title: z.string().min(1).max(200), src: z.string(), captionsSrc: z.string(), transcriptSrc: z.string(),
  durationSeconds: z.number().finite().positive().max(3600), sourceHash: digest, sha256: digest,
  rendererVersion: z.string().min(1).max(100), captionsSha256: digest, transcriptSha256: digest,
  width: z.int().positive().max(8192), height: z.int().positive().max(8192),
}));
export type WalkthroughManifestEntry = z.infer<typeof walkthroughManifestSchema>[number];

export function validateVideoCatalog(input: unknown, videos: readonly VideoSeed[], publishedSlugs: ReadonlySet<string>) {
  const sources = videoSourceCatalogSchema.parse(input);
  const byId = new Map(sources.map((source) => [source.youtubeId, source]));
  for (const video of videos) {
    const source = byId.get(video.youtubeId);
    if (!source || source.title !== video.title || source.channel !== video.channel) throw new Error(`Video source metadata differs: ${video.problemSlug}/${video.youtubeId}`);
    if (JSON.stringify(source.segments) !== JSON.stringify(video.segments)) throw new Error(`Video source chapters differ: ${video.youtubeId}`);
  }
  for (const source of sources) {
    for (const reference of source.references) {
      if (!publishedSlugs.has(reference.problemSlug)) throw new Error(`Unknown video reference problem: ${reference.problemSlug}`);
      if (reference.coverage === "RELATED_ALGORITHM" && reference.languages.some((supported) => !source.languages.includes(supported))) {
        throw new Error(`Reference claims an unverified instruction language: ${reference.problemSlug}/${source.youtubeId}`);
      }
    }
  }
  return sources;
}

export function videoCoverageReport(input: { publishedSlugs: ReadonlySet<string>; videos: readonly VideoSeed[];
  sources: readonly VideoSource[]; walkthroughs: readonly WalkthroughManifestEntry[] }) {
  const external = new Set(input.videos.map((video) => `${video.problemSlug}:${video.youtubeId}`));
  const covered = new Set<string>();
  for (const source of input.sources) for (const reference of source.references) {
    if (reference.coverage !== "RELATED_ALGORITHM" || !external.has(`${reference.problemSlug}:${source.youtubeId}`)) continue;
    for (const supported of reference.languages) if (source.languages.includes(supported)) covered.add(`${reference.problemSlug}:${supported}`);
  }
  for (const entry of input.walkthroughs) covered.add(`${entry.slug}:${entry.language}`);
  const missing = [...input.publishedSlugs].sort().flatMap((problemSlug) => (["JAVASCRIPT", "PYTHON"] as const)
    .filter((supported) => !covered.has(`${problemSlug}:${supported}`)).map((supported) => ({ slug: problemSlug, language: supported })));
  const required = input.publishedSlugs.size * 2;
  return { required, covered: required - missing.length, missing };
}

export function assertCompleteVideoCoverage(report: ReturnType<typeof videoCoverageReport>) {
  if (report.missing.length) throw new Error(`Missing main-technique video coverage for ${report.missing.length} problem/language pairs: ${report.missing.map((entry) => `${entry.slug}/${entry.language}`).join(", ")}`);
}


function validateCaptions(captions: string, duration: number, key: string) {
  const blocks = captions.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  if (blocks.shift() !== "WEBVTT" || !blocks.length) throw new Error(`Original walkthrough captions malformed: ${key}`);
  const seconds = (value: string) => {
    const match = /^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(value);
    return match ? Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000 : Number.NaN;
  };
  let previousEnd = 0;
  for (const block of blocks) {
    const lines = block.split("\n");
    if (!lines[0].includes("-->")) lines.shift();
    const cue = /^(\S+) --> (\S+)$/.exec(lines.shift() ?? "");
    const start = cue ? seconds(cue[1]) : Number.NaN;
    const end = cue ? seconds(cue[2]) : Number.NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < previousEnd || end <= start || end > duration + 0.001 || !lines.join("\n").trim()) {
      throw new Error(`Original walkthrough caption cue invalid or outside duration: ${key}`);
    }
    previousEnd = end;
  }
}

export async function validateOriginalWalkthroughAssets(input: unknown, jobs: readonly { slug: string; language: "JAVASCRIPT" | "PYTHON"; sourceHash: string }[], root = process.cwd()) {
  const manifest = walkthroughManifestSchema.parse(input);
  const expected = new Map(jobs.map((job) => [`${job.slug}:${job.language}`, job.sourceHash]));
  const seen = new Set<string>();
  for (const entry of manifest) {
    const key = `${entry.slug}:${entry.language}`;
    if (seen.has(key)) throw new Error(`Duplicate original walkthrough: ${key}`);
    seen.add(key);
    if (expected.get(key) !== entry.sourceHash) throw new Error(`Original walkthrough source is stale or unknown: ${key}`);
    const stem = `/videos/walkthroughs/${entry.slug}-${entry.language.toLowerCase()}`;
    if (entry.src !== `${stem}.mp4` || entry.captionsSrc !== `${stem}.vtt` || entry.transcriptSrc !== `${stem}.txt`) throw new Error(`Unsafe original walkthrough path: ${key}`);
    const [media, captions, transcript] = await Promise.all([
      readFile(join(root, "public", entry.src)), readFile(join(root, "public", entry.captionsSrc), "utf8"), readFile(join(root, "public", entry.transcriptSrc), "utf8"),
    ]);
    if (!media.length || media.length > 12 * 1024 * 1024 || createHash("sha256").update(media).digest("hex") !== entry.sha256) throw new Error(`Original walkthrough media hash differs: ${key}`);
    if (createHash("sha256").update(captions).digest("hex") !== entry.captionsSha256 || createHash("sha256").update(transcript).digest("hex") !== entry.transcriptSha256) throw new Error(`Original walkthrough text hash differs: ${key}`);
    if (!transcript.trim()) throw new Error(`Original walkthrough accessibility text missing: ${key}`);
    validateCaptions(captions, entry.durationSeconds, key);
  }
  return manifest;
}

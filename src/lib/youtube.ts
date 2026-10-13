// Pure helpers for video lessons. A URL is only ever built from a validated 11-character YouTube id and integer
// seconds, never from free text, so no stored string can change the host, path or query of an embed or link.
export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
export const MAX_VIDEO_SECONDS = 12 * 60 * 60;
const EMBED_ORIGIN = "https://www.youtube-nocookie.com";
const WATCH_ORIGIN = "https://www.youtube.com";

export function isYoutubeId(value: unknown): value is string {
  return typeof value === "string" && YOUTUBE_ID_PATTERN.test(value);
}

/** Coerces any input to a whole number of seconds in [0, MAX_VIDEO_SECONDS]; anything non-finite becomes 0. */
export function clampSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_VIDEO_SECONDS, Math.max(0, Math.floor(value)));
}

function requireId(id: string) {
  if (!isYoutubeId(id)) throw new Error("Invalid YouTube video id.");
  return id;
}

/** Privacy-enhanced embed URL. `autoplay` is only for use after the learner clicked to load the player. */
export function embedUrl(id: string, startSeconds: unknown = 0, options: { autoplay?: boolean } = {}): string {
  const url = new URL(`${EMBED_ORIGIN}/embed/${requireId(id)}`);
  url.searchParams.set("rel", "0");
  const start = clampSeconds(startSeconds);
  if (start > 0) url.searchParams.set("start", String(start));
  if (options.autoplay) url.searchParams.set("autoplay", "1");
  return url.toString();
}

/** Plain link to the video on YouTube, optionally at a start time. */
export function watchUrl(id: string, startSeconds: unknown = 0): string {
  const url = new URL(`${WATCH_ORIGIN}/watch`);
  url.searchParams.set("v", requireId(id));
  const start = clampSeconds(startSeconds);
  if (start > 0) url.searchParams.set("t", `${start}s`);
  return url.toString();
}

/** m:ss, or h:mm:ss from one hour. */
export function formatTimestamp(seconds: unknown): string {
  const total = clampSeconds(seconds);
  const h = Math.floor(total / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

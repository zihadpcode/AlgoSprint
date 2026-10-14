import { describe, expect, it } from "vitest";
import { clampSeconds, embedUrl, formatTimestamp, isYoutubeId, MAX_VIDEO_SECONDS, watchUrl } from "@/lib/youtube";

const id = "wiGpQwVHdE0";
describe("YouTube URL helpers", () => {
  it("always builds the privacy-enhanced embed on the exact origin and path", () => {
    for (const start of [0, 1, 310, 99999999, -5, 12.9, Number.NaN, Infinity, "30", null, undefined, {}]) {
      const url = new URL(embedUrl(id, start));
      expect(url.origin).toBe("https://www.youtube-nocookie.com");
      expect(url.pathname).toBe(`/embed/${id}`);
      expect(url.username + url.password + url.hash).toBe("");
      expect([...url.searchParams.keys()].filter((key) => !["rel", "start", "autoplay"].includes(key))).toEqual([]);
      expect(url.searchParams.get("rel")).toBe("0");
    }
    expect(embedUrl(id)).toBe(`https://www.youtube-nocookie.com/embed/${id}?rel=0`);
    expect(embedUrl(id, 310)).toBe(`https://www.youtube-nocookie.com/embed/${id}?rel=0&start=310`);
    expect(embedUrl(id, 310, { autoplay: true })).toBe(`https://www.youtube-nocookie.com/embed/${id}?rel=0&start=310&autoplay=1`);
    expect(embedUrl(id)).not.toContain("autoplay");
  });
  it("refuses anything but an 11-character id, so a stored string can never change the host, path or query", () => {
    for (const bad of ["", "short", "abcdefghijkl", "abc/../x.com", "a b c d e f g", "ab?x=1&y=2", "https://evil.test/x", "wiGpQwVHdE0\n", "wiGpQwVHdE0#x", "wiGpQwVH.E0", "//evil.test/", "wiGpQwVHdEé"]) {
      expect(isYoutubeId(bad)).toBe(false);
      expect(() => embedUrl(bad)).toThrow(/Invalid YouTube video id/);
      expect(() => watchUrl(bad)).toThrow(/Invalid YouTube video id/);
    }
    expect(isYoutubeId(undefined)).toBe(false);
    expect(isYoutubeId(12345678901)).toBe(false);
    expect(isYoutubeId("a-_9ZzA09-_")).toBe(true);
  });
  it("clamps start times to whole seconds in range", () => {
    expect(clampSeconds(12.9)).toBe(12);
    expect(clampSeconds(-1)).toBe(0);
    expect(clampSeconds(MAX_VIDEO_SECONDS + 1)).toBe(MAX_VIDEO_SECONDS);
    for (const nonNumber of [Number.NaN, Infinity, -Infinity, "30", null, undefined, {}, [5]]) expect(clampSeconds(nonNumber)).toBe(0);
  });
  it("builds a plain watch link with an integer start", () => {
    expect(watchUrl(id)).toBe(`https://www.youtube.com/watch?v=${id}`);
    expect(watchUrl(id, 310.7)).toBe(`https://www.youtube.com/watch?v=${id}&t=310s`);
    expect(watchUrl(id, -3)).toBe(`https://www.youtube.com/watch?v=${id}`);
  });
  it("formats timestamps as m:ss or h:mm:ss", () => {
    expect([0, 9, 70, 310, 3599, 3600, 3725].map(formatTimestamp)).toEqual(["0:00", "0:09", "1:10", "5:10", "59:59", "1:00:00", "1:02:05"]);
    expect(formatTimestamp(Number.NaN)).toBe("0:00");
  });
});

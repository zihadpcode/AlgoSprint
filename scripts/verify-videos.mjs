// Re-check every seeded video identity against YouTube oEmbed. No database writes.
// Historical seeded metadata stays immutable; explicitly recorded later creator metadata is checked instead.
import { VIDEOS } from "../src/data/seeds/videos.ts";
import { readFile } from "node:fs/promises";
const sources = JSON.parse(await readFile(new URL("../src/data/seeds/video-sources.json", import.meta.url), "utf8"));
const byId = new Map(sources.map((source) => [source.youtubeId, source]));
const unique = [...new Map(VIDEOS.map((video) => [video.youtubeId, video])).values()];
const results = new Array(unique.length);
let cursor = 0;
async function worker() {
  while (cursor < unique.length) {
    const index = cursor++;
    const video = unique[index];
    const expected = byId.get(video.youtubeId)?.latestVerifiedMetadata ?? video;
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video.youtubeId}`)}&format=json`, { signal: AbortSignal.timeout(15_000) });
      const body = response.ok ? await response.json() : {};
      const ok = response.ok && body.title === expected.title && body.author_name === expected.channel;
      results[index] = { ok, text: `${ok ? "OK  " : "FAIL"} ${video.youtubeId} HTTP ${response.status} | ${body.title ?? "-"} | ${body.author_name ?? "-"}` };
    } catch (error) {
      results[index] = { ok: false, text: `FAIL ${video.youtubeId} | ${error instanceof Error ? error.message : "Network failure"}` };
    }
  }
}
await Promise.all(Array.from({ length: Math.min(5, unique.length) }, worker));
for (const result of results) console.log(result.text);
const passed = results.filter((result) => result.ok).length;
console.log(`${passed}/${unique.length} videos verified.`);
process.exitCode = passed === unique.length ? 0 : 1;

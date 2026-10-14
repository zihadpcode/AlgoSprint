// Re-checks every seeded video against YouTube's keyless oEmbed endpoint and prints the result.
// Network access required. Usage: node --import tsx scripts/verify-videos.mjs   (exits 1 on any mismatch)
import { VIDEOS } from "../src/data/seeds/videos.ts";

const unique = new Map(VIDEOS.map((v) => [v.youtubeId, v]));
let failed = 0;
for (const [id, video] of unique) {
  const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
  const body = response.status === 200 ? await response.json() : {};
  const ok = response.status === 200 && body.title === video.title && body.author_name === video.channel;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${id} HTTP ${response.status} | ${body.title ?? "-"} | ${body.author_name ?? "-"}`);
}
console.log(`${unique.size - failed}/${unique.size} videos verified.`);
process.exitCode = failed ? 1 : 0;

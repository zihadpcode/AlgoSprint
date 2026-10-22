import { afterAll, beforeAll, expect, it } from "vitest";
import { Client } from "pg";
import { createDatabaseClient } from "@/lib/db/client";
import { VIDEOS } from "@/data/seeds/videos";
import { seedProblems } from "../../prisma/seed-data";
import { seedVideos } from "../../prisma/seed-videos";
import { loadProblems } from "../../scripts/lib/load-problems";
import { videoRolloutSql } from "../../scripts/lib/video-rollout";
import type { ProblemSeed } from "@/lib/validators/problem";

let db: ReturnType<typeof createDatabaseClient>;
let client: Client;
let problems: ProblemSeed[] = [];
let ownsFixtures = false;
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Video rollout tests require an empty dedicated database");
  problems = await loadProblems(); ownsFixtures = true;
  await seedProblems(db, problems);
  client = new Client({ connectionString: url }); await client.connect();
}, 60_000);
afterAll(async () => {
  await client?.end();
  if (db && ownsFixtures) await db.problem.deleteMany({ where: { slug: { in: problems.map((problem) => problem.slug) } } });
  await db?.$disconnect();
});
async function apply(sql: string) {
  try { return await client.query(sql); }
  catch (error) { await client.query("ROLLBACK"); throw error; }
}
const snapshot = () => db.problemVideo.findMany({ orderBy: { id: "asc" } });
async function baseline() {
  const { rows } = await client.query<{ baseline: string }>(`SELECT md5(string_agg(id::text || ':' || revision::text || ':' || coalesce("seedHash",''),',' ORDER BY id)) AS baseline FROM app."Problem"`);
  return rows[0].baseline;
}
async function pinnedRows() {
  const { rows } = await client.query<{ row: unknown }>(`SELECT to_jsonb(v) AS row FROM app."ProblemVideo" v ORDER BY id`);
  return rows.map((row) => row.row);
}

it("adds language references while preserving the original45 rows, supports repeat, and rolls all conflicts back", async () => {
  const legacy = VIDEOS.slice(0, 45);
  expect(await seedVideos(db, legacy)).toEqual({ created: 45, skipped: 0 });
  const pinned = await pinnedRows();
  const before = await db.problem.findMany({ orderBy: { id: "asc" } });
  const sql = videoRolloutSql(VIDEOS, await baseline(), 125, pinned);
  await apply(sql);
  const all = await snapshot();
  expect(all).toHaveLength(VIDEOS.length);
  await apply(sql);
  expect(await snapshot()).toEqual(all);
  expect(await db.problem.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  const ids = new Set((pinned as { id: string }[]).map((row) => row.id));
  const afterPinned = (await pinnedRows()).filter((row) => ids.has((row as { id: string }).id));
  expect(afterPinned).toEqual(pinned);

  const missing = all.find((row) => !ids.has(row.id))!;
  await db.problemVideo.delete({ where: { id: missing.id } });
  const target = all.find((row) => ids.has(row.id))!;
  await db.problemVideo.update({ where: { id: target.id }, data: { bridge: "An incompatible edit from another writer." } });
  const conflict = await snapshot();
  await expect(apply(sql)).rejects.toThrow(/Pinned existing video/);
  expect(await snapshot()).toEqual(conflict);
  await db.problemVideo.update({ where: { id: target.id }, data: { bridge: target.bridge } });
  await apply(sql);
  const restored = await snapshot();
  await expect(apply(videoRolloutSql(VIDEOS, "0".repeat(32), 125, pinned))).rejects.toThrow(/drift/);
  expect(await snapshot()).toEqual(restored);
  await expect(apply(videoRolloutSql(VIDEOS, await baseline(), 124, pinned))).rejects.toThrow(/count differs/);
  expect(await snapshot()).toEqual(restored);
}, 60_000);

it("rejects unmanaged rows and mismatched display positions before inserting anything", async () => {
  const current = await snapshot();
  const row = current.find((video) => video.youtubeId !== "zzzzzzzzzz1")!;
  await db.problemVideo.update({ where: { id: row.id }, data: { youtubeId: "zzzzzzzzzz1" } });
  const conflict = await snapshot();
  await expect(apply(videoRolloutSql(VIDEOS, await baseline()))).rejects.toThrow(/Unmanaged existing video/);
  expect(await snapshot()).toEqual(conflict);
  await db.problemVideo.update({ where: { id: row.id }, data: { youtubeId: row.youtubeId } });
  const pair = current.find((video) => video.position === 1 && current.some((other) => other.problemId === video.problemId && other.position === 2))!;
  await db.problemVideo.deleteMany({ where: { problemId: pair.problemId, position: 2 } });
  await db.problemVideo.update({ where: { id: pair.id }, data: { position: 2 } });
  const shifted = await snapshot();
  await expect(apply(videoRolloutSql(VIDEOS, await baseline()))).rejects.toThrow(/content or position differs|position occupied/);
  expect(await snapshot()).toEqual(shifted);
  await db.problemVideo.update({ where: { id: pair.id }, data: { position: 1 } });
  await apply(videoRolloutSql(VIDEOS, await baseline()));
}, 60_000);

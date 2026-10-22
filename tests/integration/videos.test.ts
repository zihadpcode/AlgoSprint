import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/db/client";
import { loadProblems } from "../../scripts/lib/load-problems";
import { seedProblems } from "../../prisma/seed-data";
import { seedVideos } from "../../prisma/seed-videos";
import { VIDEOS } from "@/data/seeds/videos";
import type { ProblemSeed } from "@/lib/validators/problem";
import type { VideoSeed } from "@/lib/validators/video";

let db: ReturnType<typeof createDatabaseClient>;
let problems: ProblemSeed[];
let ownsFixtures = false;
const draftSlug = "qa-video-draft";
const freshSlug = "qa-video-fresh";

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use TEST_DATABASE_URL pointing to a dedicated database ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Integration tests require an empty problem collection in the dedicated test database.");
  problems = await loadProblems();
  ownsFixtures = true;
  await seedProblems(db, problems);
  await db.problem.create({ data: { slug: draftSlug, title: "Draft for videos", status: "DRAFT", difficulty: "EASY", pattern: "fixture", statement: "Draft", constraints: ["Fixture"], estimatedMinutes: 1 } });
  await db.problem.create({ data: { slug: freshSlug, title: "Fresh video fixture", status: "PUBLISHED", publishedAt: new Date(), difficulty: "EASY", pattern: "fixture", statement: "Fixture", constraints: ["Fixture"], estimatedMinutes: 1 } });
}, 60_000);
afterAll(async () => {
  if (db && ownsFixtures) await db.problem.deleteMany({ where: { slug: { in: [...problems.map((p) => p.slug), draftSlug, freshSlug] } } });
  await db?.$disconnect();
});
const snapshot = () => db.problemVideo.findMany({ orderBy: [{ problemId: "asc" }, { position: "asc" }] });

describe("video lesson seeding against PostgreSQL", () => {
  it("inserts every video for published problems with positions following the seed order", async () => {
    expect(await seedVideos(db)).toEqual({ created: VIDEOS.length, skipped: 0 });
    expect(await db.problemVideo.count()).toBe(VIDEOS.length);
    const task = await db.problem.findUniqueOrThrow({ where: { slug: "task-order" }, include: { videos: { orderBy: { position: "asc" } } } });
    expect(task.videos.map((v) => [v.position, v.youtubeId])).toEqual(VIDEOS.filter((video) => video.problemSlug === "task-order").map((video, index) => [index + 1, video.youtubeId]));
    const stored = (await db.problemVideo.findFirstOrThrow({ where: { youtubeId: "wiGpQwVHdE0" } }));
    expect(stored.segments).toEqual(VIDEOS.find((v) => v.youtubeId === "wiGpQwVHdE0")!.segments);
  });
  it("is idempotent and leaves ids and timestamps untouched on rerun", async () => {
    const before = await snapshot();
    expect(await seedVideos(db)).toEqual({ created: 0, skipped: VIDEOS.length });
    expect(await snapshot()).toEqual(before);
  });
  it("fills in only the missing videos on a partial database", async () => {
    const removed = await db.problemVideo.findFirstOrThrow({ where: { problem: { slug: "slot-insert" } } });
    await db.problemVideo.delete({ where: { id: removed.id } });
    expect(await seedVideos(db)).toEqual({ created: 1, skipped: VIDEOS.length - 1 });
    expect(await db.problemVideo.count()).toBe(VIDEOS.length);
  });
  it("throws a conflict and writes nothing when a stored video differs from the seed", async () => {
    const target = VIDEOS.find((v) => v.problemSlug === "quiet-hours")!;
    await db.problemVideo.updateMany({ where: { problem: { slug: target.problemSlug }, youtubeId: target.youtubeId }, data: { bridge: "Edited in the database by an admin." } });
    // A brand-new video listed first would be inserted if conflicts were detected only while writing.
    const fresh: VideoSeed = { ...VIDEOS[0], problemSlug: freshSlug, youtubeId: "zzzzzzzzzz1", concept: "Fresh" };
    const before = await snapshot();
    await expect(seedVideos(db, [fresh, ...VIDEOS])).rejects.toThrow(/Video seed conflict for quiet-hours/);
    expect(await snapshot()).toEqual(before);
    expect(await db.problemVideo.count({ where: { youtubeId: "zzzzzzzzzz1" } })).toBe(0);
    await db.problemVideo.updateMany({ where: { problem: { slug: target.problemSlug }, youtubeId: target.youtubeId }, data: { bridge: target.bridge } });
    expect(await seedVideos(db)).toEqual({ created: 0, skipped: VIDEOS.length });
  });
  it("refuses a different video already occupying the position, without writing the other missing rows", async () => {
    await db.problemVideo.deleteMany({ where: { problem: { slug: { in: ["task-order", "slot-insert"] } } } });
    await db.problemVideo.create({ data: { problem: { connect: { slug: "task-order" } }, youtubeId: "zzzzzzzzzz2", title: "t", channel: "c", concept: "x", referenceProblem: "r", bridge: "b", position: 1 } });
    const before = await snapshot();
    await expect(seedVideos(db)).rejects.toThrow(/Video seed conflict for task-order: position 1/);
    expect(await snapshot()).toEqual(before);
    expect(await db.problemVideo.count({ where: { problem: { slug: "slot-insert" } } })).toBe(0);
    await db.problemVideo.deleteMany({ where: { youtubeId: "zzzzzzzzzz2" } });
    const restored = VIDEOS.filter((video) => ["task-order", "slot-insert"].includes(video.problemSlug)).length;
    expect(await seedVideos(db)).toEqual({ created: restored, skipped: VIDEOS.length - restored });
  });
  it("rejects unpublished or unknown problems and invalid batches before any write", async () => {
    const before = await snapshot();
    const draft: VideoSeed = { ...VIDEOS[0], problemSlug: draftSlug, youtubeId: "zzzzzzzzzz4" };
    await expect(seedVideos(db, [VIDEOS[0], draft])).rejects.toThrow(/requires published problem/);
    await expect(seedVideos(db, [{ ...VIDEOS[0], problemSlug: "no-such-problem", youtubeId: "zzzzzzzzzz5" }])).rejects.toThrow(/requires published problem/);
    await expect(seedVideos(db, [{ ...VIDEOS[0], youtubeId: "bad id" }])).rejects.toThrow();
    await expect(seedVideos(db, [{ ...VIDEOS[0], segments: [{ startSeconds: 5, endSeconds: 5, label: "x" }] }])).rejects.toThrow();
    expect(await snapshot()).toEqual(before);
  });
  it("cascades when a problem is deleted and enforces database checks against direct writes", async () => {
    const relay = await db.problem.findUniqueOrThrow({ where: { slug: "relay-window" } });
    await db.problemVideo.deleteMany({ where: { problemId: relay.id } });
    const row = (youtubeId: string, position: number, segments: unknown = []) => db.problemVideo.create({ data: { problemId: relay.id, youtubeId, title: "t", channel: "c", concept: "x", referenceProblem: "r", bridge: "b", position, segments: segments as never } });
    await expect(row("not-an-id", 1)).rejects.toThrow();
    await expect(row("zzzzzzzzzz6", 9)).rejects.toThrow();
    await expect(row("zzzzzzzzzz7", 1, { not: "an array" })).rejects.toThrow();
    const made = await row("zzzzzzzzzz8", 1);
    await expect(row("zzzzzzzzzz8", 2)).rejects.toThrow();
    await expect(row("zzzzzzzzzz9", 1)).rejects.toThrow();
    await db.problem.delete({ where: { id: relay.id } });
    expect(await db.problemVideo.count({ where: { id: made.id } })).toBe(0);
  });
});

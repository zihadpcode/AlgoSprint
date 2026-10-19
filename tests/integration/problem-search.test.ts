import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createDatabaseClient } from "@/lib/db/client";
import { PALETTE_RESULTS, searchPublishedProblems } from "@/features/problems/search";

let db: ReturnType<typeof createDatabaseClient>;
const slugs: string[] = [];

async function problem(title: string, status: "PUBLISHED" | "DRAFT" | "ARCHIVED" = "PUBLISHED") {
  const slug = `qa-search-${slugs.length}`;
  slugs.push(slug);
  await db.problem.create({ data: { slug, title, status, publishedAt: status === "PUBLISHED" ? new Date() : null, difficulty: "EASY", pattern: "linear-scan", statement: "Fixture", constraints: ["Fixture"], estimatedMinutes: 10 } });
}

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use TEST_DATABASE_URL pointing to a dedicated database ending in _test.");
  db = createDatabaseClient(url);
  if (await db.problem.count()) throw new Error("Problem search integration tests require an empty problem collection.");
    // More than the old 40-row window of alphabetical contains-matches, all sorting before "Radar".
  for (let index = 0; index < 45; index++) await problem(`Aura ${String(index).padStart(2, "0")} Fixture`);
  await problem("Radar Fixture");
  await problem("Secret 100%_x Draft", "DRAFT");
  await problem("Secret 100%_x Archive", "ARCHIVED");
  await problem("Public 100%_x Match");
  await problem("Public 100ab Decoy");
}, 30_000);
afterAll(async () => { if (db) { await db.problem.deleteMany({ where: { slug: { in: slugs } } }); await db.$disconnect(); } });

describe("command palette problem search", () => {
  it("never returns unpublished problems", async () => {
    const titles = (await searchPublishedProblems(db, "Secret")).map((hit) => hit.title);
    expect(titles).toEqual([]);
  });
  it("matches punctuation literally instead of as LIKE wildcards", async () => {
    expect((await searchPublishedProblems(db, "100%_x")).map((hit) => hit.title)).toEqual(["Public 100%_x Match"]);
    expect(await searchPublishedProblems(db, "%%")).toEqual([]);
  });
  it("ranks a prefix match first even when more contains-matches sort earlier than the limit", async () => {
    const hits = await searchPublishedProblems(db, "ra");
    expect(hits.length).toBeLessThanOrEqual(PALETTE_RESULTS);
    expect(hits[0].title).toBe("Radar Fixture");
  });
  it("returns only public catalogue fields and ignores tiny or control-character queries", async () => {
    const [hit] = await searchPublishedProblems(db, "Radar");
    expect(Object.keys(hit).sort()).toEqual(["difficulty", "pattern", "slug", "title"]);
    expect(await searchPublishedProblems(db, "r")).toEqual([]);
    expect(await searchPublishedProblems(db, "\u0000\u0007")).toEqual([]);
  });
});

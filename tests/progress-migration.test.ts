import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
let db: PGlite;
const user = "30000000-0000-4000-8000-000000000001";
const other = "30000000-0000-4000-8000-000000000002";
const ids = Array.from({ length: 6 }, (_, i) => `40000000-0000-4000-8000-00000000000${i}`);
beforeAll(async () => {
  db = new PGlite(); await db.exec(await readFile("prisma/migrations/202609130001_foundation/migration.sql", "utf8"));
  for (const id of [user, other]) await db.query('INSERT INTO app."User" (id,"updatedAt") VALUES ($1,now())', [id]);
  for (const [i,id] of ids.entries()) await db.query(`INSERT INTO app."Problem" (id,slug,title,difficulty,status,pattern,statement,constraints,"estimatedMinutes","publishedAt",revision,"updatedAt") VALUES ($1,$2,'Fixture','EASY',$3,'fixture','Fixture',ARRAY['Fixture'],10,now(),$4,now())`, [id, `progress-migration-${i}`, i === 3 ? "ARCHIVED" : "PUBLISHED", i === 2 ? 2 : 1]);
  for (const [owner,id] of [[user,ids[0]], [user,ids[5]], [other,ids[0]]]) await db.query(`INSERT INTO app."UserProgress" ("userId","problemId",status,"selfMarked","reviewLater",bookmarked,"solvedAt","updatedAt") VALUES ($1,$2,'SOLVED',true,true,true,'2026-01-01', '2026-01-01')`, [owner,id]);
  for (let i = 0; i < 5; i++) await db.query(`INSERT INTO app."UserSubmission" (id,"userId","problemId","problemRevision",language,mode,status,code,"passedCount","totalCount","createdAt","completedAt") VALUES (gen_random_uuid(),$1,$2,1,'JAVASCRIPT',$3,$4,'private-code',$5,6,'2026-02-01','2026-02-02')`, [user,ids[i],i === 1 ? "RUN" : "SUBMIT",i === 4 ? "INTERNAL_ERROR" : "ACCEPTED",i === 4 ? 0 : 6]);
  await db.exec(await readFile("prisma/migrations/202609160001_progress_verification/migration.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
async function row(id: string, owner = user) { return (await db.query<Record<string, unknown>>('SELECT * FROM app."UserProgress" WHERE "userId"=$1 AND "problemId"=$2', [owner,id])).rows[0]; }
it("backfills current full-suite solves and first attempt dates while preserving manual date and flags", async () => {
  expect(await row(ids[0])).toMatchObject({ status: "SOLVED", selfMarked: false, reviewLater: true, bookmarked: true, verifiedRevision: 1 });
  const saved = await row(ids[0]);
  expect(new Date(saved.solvedAt as string).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  expect(new Date(saved.attemptedAt as string).toISOString()).toBe("2026-02-01T00:00:00.000Z");
  expect(new Date(saved.verifiedAt as string).toISOString()).toBe("2026-02-02T00:00:00.000Z");
});
it("does not verify visible passes, stale revisions, archived content or infrastructure errors", async () => {
  for (const id of ids.slice(1,5)) expect(await row(id)).toMatchObject({ status: "ATTEMPTED", verifiedRevision: null, verifiedAt: null });
});
it("preserves manual-only progress and another owner's independent record", async () => {
  for (const saved of [await row(ids[5]), await row(ids[0], other)]) expect(saved).toMatchObject({ status: "SOLVED", selfMarked: true, reviewLater: true, bookmarked: true, attemptedAt: null, verifiedRevision: null });
});
it("rejects partial, nonpositive, attempted or self-marked verification at the database boundary", async () => {
  for (const assignment of ['"verifiedRevision"=0', '"verifiedAt"=NULL', '"selfMarked"=true', 'status=\'ATTEMPTED\',"solvedAt"=NULL']) {
    await expect(db.query(`UPDATE app."UserProgress" SET ${assignment} WHERE "userId"=$1 AND "problemId"=$2`, [user,ids[0]])).rejects.toMatchObject({ code: "23514" });
  }
  await expect(db.query('UPDATE app."UserProgress" SET "verifiedAt"=now() WHERE "userId"=$1 AND "problemId"=$2', [user,ids[1]])).rejects.toMatchObject({ code: "23514" });
});

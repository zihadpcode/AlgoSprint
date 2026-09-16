import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

let db: PGlite;
const problemId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(await readFile("prisma/migrations/202609130001_foundation/migration.sql", "utf8"));
  await db.exec(await readFile("prisma/migrations/202609160001_progress_verification/migration.sql", "utf8"));
  await db.query(`INSERT INTO app."Problem" (id,slug,title,difficulty,pattern,statement,constraints,"estimatedMinutes","updatedAt") VALUES ($1,'migration-fixture','Fixture','EASY','fixed-window','Fixture',ARRAY['Fixture'],15,now())`, [problemId]);
}, 30_000);
afterAll(async () => { await db?.close(); });

describe("PostgreSQL migration invariants", () => {
  it("creates every application table with RLS enabled", async () => {
    const result = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='app'`);
    expect(result.rows[0].count).toBe(22);
    const unprotected = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='app' AND NOT rowsecurity`);
    expect(unprotected.rows).toEqual([]);
  });
  it("enforces slug uniqueness, check constraints, and foreign keys", async () => {
    await expect(db.query(`INSERT INTO app."Problem" (id,slug,title,difficulty,pattern,statement,constraints,"estimatedMinutes","updatedAt") VALUES (gen_random_uuid(),'migration-fixture','Duplicate','EASY','x','x',ARRAY['x'],15,now())`)).rejects.toMatchObject({ code: "23505" });
    await expect(db.query(`UPDATE app."Problem" SET "estimatedMinutes"=-1 WHERE id=$1`, [problemId])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`INSERT INTO app."ProblemHint" (id,"problemId",position,content) VALUES (gen_random_uuid(),$1,6,'bad position')`, [problemId])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`INSERT INTO app."ProblemHint" (id,"problemId",position,content) VALUES (gen_random_uuid(),gen_random_uuid(),1,'orphan')`)).rejects.toMatchObject({ code: "23503" });
  });
  it("requires solved timestamps and protects problems with user history", async () => {
    await db.query(`INSERT INTO app."User" (id,"updatedAt") VALUES ($1,now())`, [userId]);
    await expect(db.query(`INSERT INTO app."UserProgress" ("userId","problemId",status,"updatedAt") VALUES ($1,$2,'SOLVED',now())`, [userId, problemId])).rejects.toMatchObject({ code: "23514" });
    await db.query(`INSERT INTO app."UserProgress" ("userId","problemId",status,"solvedAt","updatedAt") VALUES ($1,$2,'SOLVED',now(),now())`, [userId, problemId]);
    await expect(db.query(`DELETE FROM app."Problem" WHERE id=$1`, [problemId])).rejects.toMatchObject({ code: "23503" });
    await db.query(`DELETE FROM app."User" WHERE id=$1`, [userId]);
    expect((await db.query(`SELECT 1 FROM app."UserProgress" WHERE "userId"=$1`, [userId])).rows).toEqual([]);
  });
  it("blocks an untrusted database role even if someone later grants table access", async () => {
    await db.query(`INSERT INTO app."TestCase" (id,"problemId",position,visibility,input,output) VALUES (gen_random_uuid(),$1,1,'HIDDEN','{}','42')`, [problemId]);
    await db.exec('CREATE ROLE algosprint_untrusted; SET ROLE algosprint_untrusted;');
    try { await expect(db.query('SELECT * FROM app."TestCase"')).rejects.toMatchObject({ code: "42501" }); }
    finally { await db.exec('RESET ROLE;'); }
    await db.exec('GRANT USAGE ON SCHEMA app TO algosprint_untrusted; GRANT SELECT ON app."TestCase" TO algosprint_untrusted; SET ROLE algosprint_untrusted;');
    try { expect((await db.query('SELECT * FROM app."TestCase"')).rows).toEqual([]); }
    finally { await db.exec('RESET ROLE;'); }
    expect((await db.query('SELECT * FROM app."TestCase"')).rows).toHaveLength(1);
  });
});

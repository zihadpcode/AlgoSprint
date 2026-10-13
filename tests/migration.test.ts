import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

let db: PGlite;
const problemId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";
const lockMigration = "prisma/migrations/202609240001_lock_migration_history/migration.sql";

beforeAll(async () => {
  db = new PGlite();
  // Apply every migration in order, so a later migration that adds a table without RLS fails the RLS test below.
  // Plain PostgreSQL has no migration table or Supabase roles yet; the lock migration must be a no-op there.
  const names = (await readdir("prisma/migrations", { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  expect(names).toContain("202609130001_foundation");
  for (const name of names) await db.exec(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
  await db.query(`INSERT INTO app."Problem" (id,slug,title,difficulty,pattern,statement,constraints,"estimatedMinutes","updatedAt") VALUES ($1,'migration-fixture','Fixture','EASY','fixed-window','Fixture',ARRAY['Fixture'],15,now())`, [problemId]);
}, 30_000);
afterAll(async () => { await db?.close(); });

describe("PostgreSQL migration invariants", () => {
  it("creates every application table with RLS enabled", async () => {
    const result = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='app'`);
    expect(result.rows[0].count).toBe(23);
    const unprotected = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='app' AND NOT rowsecurity`);
    expect(unprotected.rows).toEqual([]);
  });
  it("enforces slug uniqueness, check constraints, and foreign keys", async () => {
    await expect(db.query(`INSERT INTO app."Problem" (id,slug,title,difficulty,pattern,statement,constraints,"estimatedMinutes","updatedAt") VALUES (gen_random_uuid(),'migration-fixture','Duplicate','EASY','x','x',ARRAY['x'],15,now())`)).rejects.toMatchObject({ code: "23505" });
    await expect(db.query(`UPDATE app."Problem" SET "estimatedMinutes"=-1 WHERE id=$1`, [problemId])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`INSERT INTO app."ProblemHint" (id,"problemId",position,content) VALUES (gen_random_uuid(),$1,6,'bad position')`, [problemId])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`INSERT INTO app."ProblemHint" (id,"problemId",position,content) VALUES (gen_random_uuid(),gen_random_uuid(),1,'orphan')`)).rejects.toMatchObject({ code: "23503" });
  });
  it("constrains video lessons: id shape, position, segment array, uniqueness and cascade on problem deletion", async () => {
    const video = `INSERT INTO app."ProblemVideo" (id,"problemId","youtubeId",title,channel,concept,"referenceProblem",bridge,segments,position) VALUES (gen_random_uuid(),$1,$2,'T','C','Concept','Ref','Bridge',$3::jsonb,$4)`;
    const fixture = "20000000-0000-4000-8000-0000000000aa";
    await db.query(`INSERT INTO app."Problem" (id,slug,title,difficulty,pattern,statement,constraints,"estimatedMinutes","updatedAt") VALUES ($1,'video-fixture','Fixture','EASY','fixed-window','Fixture',ARRAY['Fixture'],15,now())`, [fixture]);
    await db.query(video, [fixture, "abcdefghijk", "[]", 1]);
    await expect(db.query(video, [fixture, "abcdefghijk", "[]", 2])).rejects.toMatchObject({ code: "23505" });
    await expect(db.query(video, [fixture, "lmnopqrstuv", "[]", 1])).rejects.toMatchObject({ code: "23505" });
    for (const badId of ["short", "has space!!", "abc<script>"]) await expect(db.query(video, [fixture, badId, "[]", 3])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(video, [fixture, "abcdefghijkl", "[]", 3])).rejects.toMatchObject({ code: "22001" });
    await expect(db.query(video, [fixture, "lmnopqrstuv", "[]", 6])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(video, [fixture, "lmnopqrstuv", '{"startSeconds":1}', 2])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(video, [fixture, "lmnopqrstuv", "[]", 2])).resolves.toBeDefined();
    await expect(db.query(`INSERT INTO app."ProblemVideo" (id,"problemId","youtubeId",title,channel,concept,"referenceProblem",bridge,position) VALUES (gen_random_uuid(),gen_random_uuid(),'abcdefghijk','T','C','C','R','B',1)`)).rejects.toMatchObject({ code: "23503" });
    await db.query(`DELETE FROM app."Problem" WHERE id=$1`, [fixture]);
    expect((await db.query(`SELECT 1 FROM app."ProblemVideo" WHERE "problemId"=$1`, [fixture])).rows).toEqual([]);
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
  it("locks Prisma's migration history away from Supabase's browser roles", async () => {
    // Mirrors Supabase: the Data API roles exist and default privileges granted them everything on the table.
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE public._prisma_migrations (id varchar(36) PRIMARY KEY, migration_name varchar(255) NOT NULL);
      INSERT INTO public._prisma_migrations VALUES ('1', '202609130001_foundation');
      GRANT ALL ON public._prisma_migrations TO anon, authenticated;`);
    await db.exec(await readFile(lockMigration, "utf8"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role};`);
      try {
        await expect(db.query("SELECT * FROM public._prisma_migrations")).rejects.toMatchObject({ code: "42501" });
        await expect(db.query("DELETE FROM public._prisma_migrations")).rejects.toMatchObject({ code: "42501" });
      } finally { await db.exec("RESET ROLE;"); }
    }
    expect((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid = 'public._prisma_migrations'::regclass")).rows).toEqual([{ relrowsecurity: true }]);
    expect((await db.query("SELECT migration_name FROM public._prisma_migrations")).rows).toHaveLength(1);
  });
});

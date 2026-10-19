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
  it("indexes only completed terminal submission payloads for owner-scoped cleanup", async () => {
    const result = await db.query<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE schemaname='app' AND indexname='UserSubmission_retention_payload_idx'`);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].indexdef).toContain('("userId", "createdAt", id)');
    for (const term of ['QUEUED', 'RUNNING', '"completedAt" IS NOT NULL', "code <> ''", 'result IS NOT NULL']) expect(result.rows[0].indexdef).toContain(term);
    expect(result.rows[0].indexdef).not.toMatch(/now\(\)|CURRENT_TIMESTAMP/);
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
  it("keeps existing categories valid and limits category nesting to one level", async () => {
    const cat = (id: string, slug: string, parent: string | null = null) =>
      db.query(`INSERT INTO app."Category" (id,slug,name,"parentId") VALUES ($1,$2,$2,$3)`, [id, slug, parent]);
    const [group, leaf, other, child] = ["30000000-0000-4000-8000-00000000000a", "30000000-0000-4000-8000-00000000000b", "30000000-0000-4000-8000-00000000000c", "30000000-0000-4000-8000-00000000000d"];
    // A row written the pre-migration way (no new columns) is a valid top-level category at position 0.
    await db.query(`INSERT INTO app."Category" (id,slug,name) VALUES ($1,'group-fixture','group-fixture')`, [group]);
    expect((await db.query(`SELECT "parentId",position FROM app."Category" WHERE id=$1`, [group])).rows).toEqual([{ parentId: null, position: 0 }]);
    await cat(leaf, "leaf-fixture", group);
    await cat(other, "other-fixture");
    // Self-parent is rejected by the CHECK, on insert and on update.
    await expect(cat("30000000-0000-4000-8000-00000000000e", "self-fixture", "30000000-0000-4000-8000-00000000000e")).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`UPDATE app."Category" SET "parentId"=id WHERE id=$1`, [other])).rejects.toMatchObject({ code: "23514" });
    // A second level is rejected: under a child, by moving a child under a child, and by turning a group with children into a child.
    await expect(cat(child, "grandchild-fixture", leaf)).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`UPDATE app."Category" SET "parentId"=$1 WHERE id=$2`, [leaf, other])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`UPDATE app."Category" SET "parentId"=$1 WHERE id=$2`, [other, group])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(`UPDATE app."Category" SET position=-1 WHERE id=$1`, [leaf])).rejects.toMatchObject({ code: "23514" });
    // Unknown parents and deleting a group that still has children are refused; unlinking then deleting works.
    await expect(cat(child, "orphan-fixture", "30000000-0000-4000-8000-0000000000ff")).rejects.toMatchObject({ code: "23503" });
    await expect(db.query(`DELETE FROM app."Category" WHERE id=$1`, [group])).rejects.toMatchObject({ code: "23503" });
    // None of the rejected statements changed anything.
    expect((await db.query(`SELECT slug,"parentId" FROM app."Category" WHERE slug LIKE '%-fixture' ORDER BY slug`)).rows).toEqual([
      { slug: "group-fixture", parentId: null }, { slug: "leaf-fixture", parentId: group }, { slug: "other-fixture", parentId: null },
    ]);
    await db.query(`UPDATE app."Category" SET "parentId"=NULL WHERE id=$1`, [leaf]);
    await db.query(`DELETE FROM app."Category" WHERE slug LIKE '%-fixture'`);
  });
  it("refuses hierarchy writes outside READ COMMITTED, where the lock holder's commit would be invisible", async () => {
    const [group, leaf] = ["30000000-0000-4000-8000-0000000000a1", "30000000-0000-4000-8000-0000000000a2"];
    await db.query(`INSERT INTO app."Category" (id,slug,name) VALUES ($1,'iso-group-fixture','iso-group-fixture'),($2,'iso-leaf-fixture','iso-leaf-fixture')`, [group, leaf]);
    try {
      for (const level of ["REPEATABLE READ", "SERIALIZABLE"]) {
        await db.exec(`BEGIN ISOLATION LEVEL ${level}`);
        try {
          await expect(db.query(`UPDATE app."Category" SET "parentId"=$1 WHERE id=$2`, [group, leaf])).rejects.toMatchObject({ code: "25000", message: expect.stringContaining("READ COMMITTED") });
        } finally { await db.exec("ROLLBACK"); }
      }
      expect((await db.query(`SELECT "parentId" FROM app."Category" WHERE id=$1`, [leaf])).rows).toEqual([{ parentId: null }]);
      // Metadata writes (for example, reordering) remain available at any level, and READ COMMITTED still links.
      await db.exec("BEGIN ISOLATION LEVEL REPEATABLE READ");
      try { await db.query(`UPDATE app."Category" SET position=3 WHERE id=$1`, [group]); } finally { await db.exec("ROLLBACK"); }
      await db.query(`UPDATE app."Category" SET "parentId"=$1 WHERE id=$2`, [group, leaf]);
      expect((await db.query(`SELECT "parentId" FROM app."Category" WHERE id=$1`, [leaf])).rows).toEqual([{ parentId: group }]);
    } finally {
      await db.query(`UPDATE app."Category" SET "parentId"=NULL WHERE slug LIKE 'iso-%-fixture'`);
      await db.query(`DELETE FROM app."Category" WHERE slug LIKE 'iso-%-fixture'`);
    }
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

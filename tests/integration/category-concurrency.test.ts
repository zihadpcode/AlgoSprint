import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { connectionOptions } from "@/lib/db/connection";

let observer: Client, writer: Client, child: Client;
const pids = new Map<Client, number>();
const ids: string[] = [];
const pending: Promise<Outcome>[] = [];
const prefix = `qa-category-${randomUUID().slice(0, 8)}`;
const pauseKey = 981230;
type Outcome = { code: string | null; message: string };

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw new Error("Use a dedicated TEST_DATABASE_URL ending in _test.");
  [observer, writer, child] = [new Client(connectionOptions(url)), new Client(connectionOptions(url)), new Client(connectionOptions(url))];
  for (const client of [observer, writer, child]) {
    await client.connect();
    await client.query("SET statement_timeout='8s'; SET lock_timeout='7s'");
    pids.set(client, Number((await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid));
  }
  // Runs after Category_one_level_trigger but before the row/FK write, making the visibility gap deterministic.
  await observer.query(`CREATE FUNCTION app.qa_category_pause() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.slug = current_setting('algosprint.review_pause_slug', true) THEN
      PERFORM pg_advisory_xact_lock(${pauseKey});
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER zz_category_review_pause BEFORE INSERT ON app."Category" FOR EACH ROW EXECUTE FUNCTION app.qa_category_pause();`);
});
afterEach(async () => {
  await observer.query("ROLLBACK"); // Releases the pause before waiting for the actor statements.
  await Promise.all(pending.splice(0));
  await Promise.all([writer.query("ROLLBACK"), child.query("ROLLBACK")]);
  await child.query("SELECT set_config('algosprint.review_pause_slug', '', false)");
  await observer.query('UPDATE app."Category" SET "parentId"=NULL WHERE id=ANY($1::uuid[])', [ids]);
  await observer.query('DELETE FROM app."Category" WHERE id=ANY($1::uuid[])', [ids.splice(0)]);
});
afterAll(async () => {
  if (observer) await observer.query('DROP TRIGGER IF EXISTS zz_category_review_pause ON app."Category"; DROP FUNCTION IF EXISTS app.qa_category_pause()');
  await Promise.all([observer?.end(), writer?.end(), child?.end()]);
});
function newId() { const id = randomUUID(); ids.push(id); return id; }
async function category(label: string, parentId: string | null = null, client = observer) {
  const id = newId(), slug = `${prefix}-${label}`;
  await client.query('INSERT INTO app."Category"(id,slug,name,"parentId") VALUES($1,$2,$2,$3)', [id, slug, parentId]);
  return { id, slug };
}
function run(client: Client, text: string, values: unknown[]) {
  const result = client.query(text, values).then(() => ({ code: null, message: "" }), (error: { code: string; message: string }) => ({ code: error.code, message: error.message }));
  pending.push(result); return result;
}
async function waiting(client: Client, blocker: Client) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='advisory' AND $2=ANY(pg_blocking_pids(pid))) AS waiting", [pids.get(client), pids.get(blocker)]);
    if (result.rows[0].waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("The expected actor was not observed waiting on the specific advisory-lock holder.");
}
async function pauseInsert(slug: string) {
  await child.query("SELECT set_config('algosprint.review_pause_slug', $1, false)", [slug]);
  await observer.query("BEGIN"); await observer.query(`SELECT pg_advisory_xact_lock(${pauseKey})`);
}
async function noSecondLevel() {
  expect((await observer.query(`SELECT child.id FROM app."Category" child JOIN app."Category" parent ON parent.id=child."parentId" WHERE child.id=ANY($1::uuid[]) AND parent."parentId" IS NOT NULL`, [ids])).rows).toEqual([]);
}

it("serializes an ID-only rename against the gap between hierarchy validation and the FK check", async () => {
  const grand = await category("grand"), parent = await category("parent", grand.id);
  const renamedId = newId(), childId = newId(), slug = `${prefix}-paused-child`;
  await pauseInsert(slug);
  const insert = run(child, 'INSERT INTO app."Category"(id,slug,name,"parentId") VALUES($1,$2,$2,$3)', [childId, slug, renamedId]);
  await waiting(child, observer);
  const rename = run(writer, 'UPDATE app."Category" SET id=$1 WHERE id=$2', [renamedId, parent.id]);
  await waiting(writer, child); // Without UPDATE OF id, the rename commits here and the insert creates a second level.
  await observer.query("COMMIT");
  expect((await insert).code).toBe("23503");
  expect((await rename).code).toBeNull();
  await noSecondLevel();
});
it.each(["REPEATABLE READ", "SERIALIZABLE"])("rejects even a top-level ID change under %s while allowing metadata edits", async (isolation) => {
  const parent = await category("top"), renamedId = newId();
  await writer.query(`BEGIN ISOLATION LEVEL ${isolation}`);
  expect((await run(writer, 'UPDATE app."Category" SET id=$1 WHERE id=$2', [renamedId, parent.id])).code).toBe("25000");
  await writer.query("ROLLBACK");
  await writer.query(`BEGIN ISOLATION LEVEL ${isolation}`);
  await writer.query('UPDATE app."Category" SET position=4 WHERE id=$1', [parent.id]); await writer.query("COMMIT");
  expect((await observer.query('SELECT id,position FROM app."Category" WHERE id=$1', [parent.id])).rows).toEqual([{ id: parent.id, position: 4 }]);
});
it("keeps valid READ COMMITTED parent-ID cascades and rejects moving that group under another parent", async () => {
  const parent = await category("cascade-parent"), leaf = await category("cascade-leaf", parent.id), other = await category("cascade-other");
  const renamedId = newId(); await writer.query('UPDATE app."Category" SET id=$1 WHERE id=$2', [renamedId, parent.id]);
  expect((await observer.query('SELECT "parentId" FROM app."Category" WHERE id=$1', [leaf.id])).rows[0].parentId).toBe(renamedId);
  expect((await run(writer, 'UPDATE app."Category" SET id=$1,"parentId"=$2 WHERE id=$3', [newId(), other.id, renamedId])).code).toBe("23514");
  await noSecondLevel();
});
it("waits for a concurrently created non-top-level parent and then rejects a second level", async () => {
  const grand = await category("created-grand");
  await writer.query("BEGIN"); const parent = await category("created-parent", grand.id, writer);
  const insert = run(child, 'INSERT INTO app."Category"(id,slug,name,"parentId") VALUES($1,$2,$2,$3)', [newId(), `${prefix}-created-child`, parent.id]);
  await waiting(child, writer); await writer.query("COMMIT");
  expect((await insert).code).toBe("23514"); await noSecondLevel();
});
it("allows a concurrent top-level parent to become visible before the FK check without creating a second level", async () => {
  await writer.query("BEGIN"); const parent = await category("new-top", null, writer);
  const childId = newId(), slug = `${prefix}-new-top-child`; await pauseInsert(slug);
  const insert = run(child, 'INSERT INTO app."Category"(id,slug,name,"parentId") VALUES($1,$2,$2,$3)', [childId, slug, parent.id]);
  await waiting(child, observer); await writer.query("COMMIT"); await observer.query("COMMIT");
  expect((await insert).code).toBeNull(); await noSecondLevel();
});

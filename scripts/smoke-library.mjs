import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Use a seeded, dedicated TEST_DATABASE_URL ending in _test.");
const db = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const fixtureIds = [randomUUID(), randomUUID(), randomUUID()];
const fixtureSlugs = fixtureIds.map((id) => "qa-http-" + id);
const userId = randomUUID();
const roadmapId = randomUUID();
const roadmapSlug = "qa-roadmap-" + roadmapId;
const origin = "http://127.0.0.1:3101";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3101"], {
  env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", APP_URL: "", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let diagnostic = "";
const collect = (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-5000); };
server.stderr.on("data", collect);
server.stdout.on("data", collect);
try {
  let ready = false;
  let lastFailure = "No response yet";
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${diagnostic}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(2000) });
      if (response.ok) { ready = true; break; }
      lastFailure = `HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`;
    } catch (error) { lastFailure = String(error); }
    await delay(200);
  }
  assert.ok(ready, `Production server must become ready: ${lastFailure}\n${diagnostic}`);
  const library = await fetch(origin + "/problems", { headers: { cookie: "role=ADMIN; sb-access-token=forged" } });
  assert.equal(library.status, 200);
  assert.match(library.headers.get("cache-control") ?? "", /no-store/);
  const html = await library.text();
  // The library is paginated, so locate each foundation problem through search rather than the first page.
  for (const title of ["Relay Window", "Quiet Badge", "Parcel Checkpoints", "Dock Threshold", "Lantern Steps"]) {
    const found = await fetch(origin + "/problems?q=" + encodeURIComponent(title));
    assert.equal(found.status, 200, title);
    assert.ok((await found.text()).includes(title), title);
  }
  assert.ok(html.includes("Ridge Count") || html.includes("Bake Batches"), "First page shows library problems");
  for (const privateField of ["seedHash", "testCases", "starterCode"]) assert.ok(!html.includes(privateField), privateField);
  const search = await fetch(origin + "/problems?q=RELAY");
  const searchHtml = await search.text();
  assert.equal(search.status, 200);
  assert.ok(searchHtml.includes("Relay Window"));
  assert.ok(!searchHtml.includes("Dock Threshold"));
  const empty = await fetch(origin + "/problems?q=no-such-title-ever");
  assert.ok((await empty.text()).includes("No matches yet"));
  const personal = await fetch(origin + "/problems?completion=SOLVED&userId=forged");
  assert.equal(personal.status, 200);
  const personalHtml = await personal.text();
  assert.ok(personalHtml.includes("Sign in to filter your progress"));
  assert.ok(!personalHtml.includes("Relay Window"));
  const page = await fetch(origin + "/problems?page=999", { redirect: "manual" });
  assert.equal(page.status, 307);
  // Out-of-range pages clamp to the last real page (page 1 renders as the bare path).
  assert.match(page.headers.get("location") ?? "", /^\/problems(\?page=[1-9]\d?)?$/);
  for (const slug of ["relay-window", "quiet-badge", "parcel-checkpoints", "dock-threshold", "lantern-steps", "ridge-count", "cheapest-route"]) {
    const card = await fetch(origin + "/problems?q=" + slug.replaceAll("-", " "));
    assert.ok((await card.text()).includes(`/problems/${slug}`), "Card must link to its detail page");
    const detail = await fetch(origin + `/problems/${slug}?userId=forged&role=ADMIN`);
    assert.equal(detail.status, 200, slug);
    assert.match(detail.headers.get("cache-control") ?? "", /no-store/);
    const body = await detail.text();
    for (const section of ["Problem statement", "Examples", "Constraints", "Layered hints", "Reveal guided solutions", "Starter code", "Related problems", "Sign in to write notes", "Editor language", "Run executes the visible examples in your browser and saves nothing", process.env.CODE_RUNNER_ENABLED === "true" ? "Submit checks the full suite on the server" : "Submitting for a verified result is not available yet", "Reset to starter", "Test results", "No output yet", "Actual output: Not run", "Not measured", "Run visible tests", "Submit solution"]) assert.ok(body.includes(section), `${slug}: ${section}`);
    assert.match(body, /<details(?:\s[^>]*)?>/);
    assert.ok(!/<details[^>]*\sopen(?:[\s=>])/.test(body), "Solutions start collapsed");
    for (const field of ["testCases", "seedHash", "HIDDEN"]) assert.ok(!body.includes(field), field);
  }
  const roadmaps = await fetch(origin + "/roadmaps?userId=forged", { headers: { cookie: "role=ADMIN; sb-access-token=forged" } });
  assert.equal(roadmaps.status, 200);
  assert.match(roadmaps.headers.get("cache-control") ?? "", /no-store/);
  const roadmapHtml = await roadmaps.text();
  for (const title of ["Scan, Store, Reuse", "Boundaries to Decisions"]) assert.ok(roadmapHtml.includes(title), title);
  for (const slug of ["scan-store-reuse", "boundaries-to-decisions"]) {
    const detail = await fetch(origin + `/roadmaps/${slug}?userId=forged&role=ADMIN`);
    assert.equal(detail.status, 200); assert.match(detail.headers.get("cache-control") ?? "", /no-store/);
    const body = await detail.text();
    for (const value of ["Suggested next step", "Practice in this order", "Sign in to track this path", 'aria-label="Ordered roadmap steps"']) assert.ok(body.includes(value), value);
    for (const field of ["seedHash", "testCases", "starterCode", "verifiedRevision", "steps recorded solved ·"]) assert.ok(!body.includes(field), field);
  }
  const roadmapPage = await fetch(origin + "/roadmaps?page=999", { redirect: "manual" });
  assert.equal(roadmapPage.status, 307); assert.equal(roadmapPage.headers.get("location"), "/roadmaps");
  for (const slug of ["does-not-exist", "INVALID"]) assert.equal((await fetch(origin + `/roadmaps/${slug}`)).status, 404);
  // Owned fixtures prove the production response also excludes private relations,
  // hidden test payloads and another user's notes (not just private field names).
  await db.query('INSERT INTO app."User" (id, "updatedAt") VALUES ($1, now())', [userId]);
  for (const [index, status] of ["PUBLISHED", "DRAFT", "ARCHIVED"].entries()) {
    await db.query(`INSERT INTO app."Problem" (id, slug, title, difficulty, status, pattern, statement, constraints, "estimatedMinutes", "publishedAt", "updatedAt")
      VALUES ($1, $2, $3::text, 'EASY', $4, 'http-fixture', $3::text, ARRAY['Fixture'], 1, $5, now())`,
    [fixtureIds[index], fixtureSlugs[index], index === 0 ? "PUBLIC-DETAIL-SENTINEL" : "UNPUBLISHED-DETAIL-SENTINEL", status, index === 0 ? new Date() : null]);
  }
  await db.query('INSERT INTO app."UserNote" (id, "userId", "problemId", content, "updatedAt") VALUES ($1, $2, $3, $4, now())', [randomUUID(), userId, fixtureIds[0], "PRIVATE-NOTE-SENTINEL"]);
  await db.query(`INSERT INTO app."TestCase" (id, "problemId", position, visibility, input, output, explanation)
    VALUES ($1, $2, 1, 'HIDDEN', $3::jsonb, $3::jsonb, $4)`, [randomUUID(), fixtureIds[0], JSON.stringify({ secret: "HIDDEN-PAYLOAD-SENTINEL" }), "HIDDEN-EXPLANATION-SENTINEL"]);
  await db.query('INSERT INTO app."ProblemRelation" ("problemId", "relatedId") VALUES ($1, $2)', [fixtureIds[0], fixtureIds[1]]);
  const fixture = await fetch(origin + `/problems/${fixtureSlugs[0]}?userId=${userId}`, { headers: { cookie: `userId=${userId}; role=ADMIN; sb-access-token=forged` } });
  assert.equal(fixture.status, 200);
  const fixtureHtml = await fixture.text();
  assert.ok(fixtureHtml.includes("PUBLIC-DETAIL-SENTINEL"));
  for (const secret of ["PRIVATE-NOTE-SENTINEL", "HIDDEN-PAYLOAD-SENTINEL", "HIDDEN-EXPLANATION-SENTINEL", "UNPUBLISHED-DETAIL-SENTINEL"]) assert.ok(!fixtureHtml.includes(secret), secret);
  for (const unavailable of [fixtureSlugs[1], fixtureSlugs[2], "does-not-exist", "INVALID"]) {
    const response = await fetch(origin + `/problems/${unavailable}`);
    assert.equal(response.status, 404, unavailable);
    assert.ok(!(await response.text()).includes("UNPUBLISHED-DETAIL-SENTINEL"));
  }
  await db.query(`INSERT INTO app."Roadmap" (id, slug, title, description, difficulty, "estimatedMinutes", status, "updatedAt") VALUES ($1, $2, 'UNPUBLISHED-ROADMAP-SENTINEL', 'Fixture', 'EASY', 1, 'DRAFT', now())`, [roadmapId, roadmapSlug]);
  await db.query(`INSERT INTO app."RoadmapStep" (id, "roadmapId", "problemId", position, title) VALUES ($1, $2, $3, 1, 'PRIVATE-STEP-SENTINEL')`, [randomUUID(), roadmapId, fixtureIds[1]]);
  for (const status of ["DRAFT", "PUBLISHED", "ARCHIVED"]) {
    await db.query('UPDATE app."Roadmap" SET status = $1 WHERE id = $2', [status, roadmapId]);
    const response = await fetch(origin + `/roadmaps/${roadmapSlug}?userId=${userId}`);
    assert.equal(response.status, 404, "Unavailable roadmap/step must be 404");
    const listBody = await (await fetch(origin + "/roadmaps")).text();
    for (const secret of ["UNPUBLISHED-ROADMAP-SENTINEL", "PRIVATE-STEP-SENTINEL", "PRIVATE-NOTE-SENTINEL", "HIDDEN-PAYLOAD-SENTINEL"]) assert.ok(!listBody.includes(secret));
  }
  console.log("Library/detail/roadmaps HTTP smoke passed: seeded links, filters, detail sections, collapsed solutions, guest gates, privacy headers, hidden payload exclusion and unpublished 404s.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
  try {
    await db.query('DELETE FROM app."Roadmap" WHERE id = $1', [roadmapId]);
    await db.query('DELETE FROM app."User" WHERE id = $1', [userId]);
    await db.query('DELETE FROM app."Problem" WHERE id = ANY($1::uuid[])', [fixtureIds]);
  } finally { await db.end(); }
}

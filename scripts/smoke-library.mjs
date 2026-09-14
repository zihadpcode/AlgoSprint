import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) throw new Error("Use a seeded, dedicated TEST_DATABASE_URL ending in _test.");
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
  for (const title of ["Relay Window", "Quiet Badge", "Parcel Checkpoints", "Dock Threshold", "Lantern Steps"]) assert.ok(html.includes(title), title);
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
  assert.equal(page.headers.get("location"), "/problems");
  console.log("Library HTTP smoke passed: seeded public cards, search, empty results, personal-filter gate, privacy headers, and bounded pagination.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(3000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

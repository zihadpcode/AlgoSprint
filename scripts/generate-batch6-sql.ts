import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { loadProblems } from "./lib/load-problems";
import { ROADMAPS } from "../src/data/seeds/roadmaps";
import { validateRoadmapReferences } from "../src/lib/validators/roadmap";
import { canonicalJson, problemHash } from "../prisma/seed-data";
import { problemBatchSchema, type ProblemSeed } from "../src/lib/validators/problem";

export const OLD_SOURCE = "1bacb2f947de89e92cb4fc08604132c1b78090e0";
export const BATCH6_SOURCE = "ee5f330f47aaa8377bfc8289190ccd767a64d470";
export const PRODUCTION_BASELINE_SHA256 = "b8aebbdd8b03291987948911034932c13a8693f79e80fa1a94404a30fea5a211";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
type BaselineProblem = { id: string; slug: string; seedHash: string; status: string; kind: string; revision: number; updatedAt: string };
type BaselineRoadmap = { id: string; slug: string; title: string; description: string; difficulty: string; estimatedMinutes: number; status: string; createdAt: string; updatedAt: string; steps: { id: string; slug: string; title: string; description: string; position: number; problemId: string }[] };
export type Batch6Baseline = { problems: BaselineProblem[]; roadmaps: BaselineRoadmap[]; captured_at: string };
const mutationTables = ["Problem", "ProblemExample", "ProblemHint", "StarterCode", "TestCase", "ProblemSolution", "SolutionStep", "ProblemCategory", "ProblemTag", "ProblemInterviewStyle", "ProblemRelation", "Roadmap", "RoadmapStep"];
const appTables = [...mutationTables, "Category", "Tag", "InterviewStyle", "ProblemVideo", "User", "UserProgress", "UserSubmission", "UserNote", "MockInterview", "MockInterviewQuestion"].sort();
function normalize(problem: ProblemSeed) {
  return { ...problem, categories: [...problem.categories].sort(), tags: [...problem.tags].sort(), interviewStyles: [...problem.interviewStyles].sort(), relatedSlugs: [...problem.relatedSlugs].sort(),
    examples: [...problem.examples].sort((a, b) => a.position - b.position), hints: [...problem.hints].sort((a, b) => a.position - b.position), testCases: [...problem.testCases].sort((a, b) => a.position - b.position),
    starterCode: [...problem.starterCode].sort((a, b) => a.language.localeCompare(b.language)), solutions: [...problem.solutions].sort((a, b) => `${a.kind}:${a.language}`.localeCompare(`${b.kind}:${b.language}`)).map((solution) => ({ ...solution, steps: [...solution.steps].sort((a, b) => a.position - b.position) })) };
}
function quote(value: unknown) {
  const json = JSON.stringify(value); let tag = "$batch6_payload$";
  while (json.includes(tag)) tag = tag.slice(0, -1) + "x$";
  return `${tag}${json}${tag}::jsonb`;
}
const count = (table: string) => `GET DIAGNOSTICS affected = ROW_COUNT; created := jsonb_set(created, ARRAY['${table}'], to_jsonb(COALESCE((created->>'${table}')::int,0)+affected));`;
const populateChildren = (table: string, field: string) => `INSERT INTO app."${table}" SELECT (jsonb_populate_record(NULL::app."${table}", entries.value || jsonb_build_object('id',gen_random_uuid(),'problemId',problem_id))).* FROM jsonb_array_elements(seed->'${field}') AS entries(value); ${count(table)}`;

// PostgreSQL constructs the same normalized JSON object as the validated source.
// Only its digest is embedded for the original 100 problems, keeping this SQL
// small while detecting stale seed hashes and changed owned child content.
const projectProblem = `SELECT jsonb_build_object('schemaVersion',1,'slug',p.slug,'title',p.title,'difficulty',p.difficulty,'kind',p.kind,'status',p.status,'pattern',p.pattern,'statement',p.statement,'constraints',p.constraints,'estimatedMinutes',p."estimatedMinutes",'timeLimitMs',p."timeLimitMs",'memoryLimitKb',p."memoryLimitKb",
 'examples',(SELECT COALESCE(jsonb_agg(to_jsonb(x)-'id'-'problemId' ORDER BY x.position),'[]'::jsonb) FROM app."ProblemExample" x WHERE x."problemId"=p.id),
 'hints',(SELECT COALESCE(jsonb_agg(to_jsonb(x)-'id'-'problemId' ORDER BY x.position),'[]'::jsonb) FROM app."ProblemHint" x WHERE x."problemId"=p.id),
 'testCases',(SELECT COALESCE(jsonb_agg(to_jsonb(x)-'id'-'problemId' ORDER BY x.position),'[]'::jsonb) FROM app."TestCase" x WHERE x."problemId"=p.id),
 'starterCode',(SELECT COALESCE(jsonb_agg(to_jsonb(x)-'id'-'problemId' ORDER BY x.language::text),'[]'::jsonb) FROM app."StarterCode" x WHERE x."problemId"=p.id),
 'solutions',(SELECT COALESCE(jsonb_agg((to_jsonb(x)-'id'-'problemId') || jsonb_build_object('steps',(SELECT COALESCE(jsonb_agg(to_jsonb(s)-'id'-'solutionId' ORDER BY s.position),'[]'::jsonb) FROM app."SolutionStep" s WHERE s."solutionId"=x.id)) ORDER BY x.kind::text,x.language::text),'[]'::jsonb) FROM app."ProblemSolution" x WHERE x."problemId"=p.id),
 'categories',(SELECT COALESCE(jsonb_agg(x.slug ORDER BY x.slug),'[]'::jsonb) FROM app."Category" x JOIN app."ProblemCategory" j ON j."categoryId"=x.id WHERE j."problemId"=p.id),
 'tags',(SELECT COALESCE(jsonb_agg(x.slug ORDER BY x.slug),'[]'::jsonb) FROM app."Tag" x JOIN app."ProblemTag" j ON j."tagId"=x.id WHERE j."problemId"=p.id),
 'interviewStyles',(SELECT COALESCE(jsonb_agg(x.slug ORDER BY x.slug),'[]'::jsonb) FROM app."InterviewStyle" x JOIN app."ProblemInterviewStyle" j ON j."styleId"=x.id WHERE j."problemId"=p.id),
 'relatedSlugs',(SELECT COALESCE(jsonb_agg(x.slug ORDER BY x.slug),'[]'::jsonb) FROM app."Problem" x JOIN app."ProblemRelation" j ON j."relatedId"=x.id WHERE j."problemId"=p.id)) FROM app."Problem" p WHERE p.slug=target_slug`;

export async function generateBatch6Sql(baselinePath: string, outputPath: string, expectedBaselineSha256: string) {
  execFileSync("git", ["diff", "--exit-code", BATCH6_SOURCE, "--", "src/data/seeds/problems", "src/data/seeds/roadmaps.ts"]);
  if (execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "src/data/seeds/problems"], { encoding: "utf8" }).trim()) throw new Error("Unexpected untracked problem source.");
  const oldPaths = execFileSync("git", ["ls-tree", "-r", "--name-only", OLD_SOURCE, "src/data/seeds/problems"], { encoding: "utf8" }).trim().split("\n").filter((path) => path.endsWith(".json"));
  const oldSources = problemBatchSchema.parse(oldPaths.map((path) => JSON.parse(execFileSync("git", ["show", `${OLD_SOURCE}:${path}`], { encoding: "utf8" }))));
  if (oldSources.length !== 100) throw new Error("Unexpected original source scope.");
  const oldHashes = new Map(oldSources.map((problem) => [problem.slug, problemHash(problem)]));
  const baselineText = await readFile(baselinePath, "utf8");
  if (sha(baselineText) !== expectedBaselineSha256) throw new Error("Reviewed baseline hash changed.");
  const baseline = JSON.parse(baselineText) as Batch6Baseline;
  const problems = await loadProblems(); const bySlug = new Map(problems.map((problem) => [problem.slug, problem]));
  if (problems.length !== 113 || baseline.problems.length !== 100 || baseline.roadmaps.length !== 18 || baseline.roadmaps.reduce((sum, roadmap) => sum + roadmap.steps.length, 0) !== 307) throw new Error("Unexpected reviewed scope.");
  if (new Set(baseline.problems.map((row) => row.id)).size !== 100 || new Set(baseline.problems.map((row) => row.slug)).size !== 100) throw new Error("Duplicate baseline identities.");
  for (const row of baseline.problems) {
    const source = bySlug.get(row.slug);
    if (!source || row.seedHash !== oldHashes.get(row.slug) || row.seedHash !== problemHash(source) || row.status !== "PUBLISHED" || row.kind !== "CODING" || !Number.isInteger(row.revision) || row.revision < 1) throw new Error(`Original problem baseline mismatch: ${row.slug}`);
  }
  const oldSlugs = new Set(baseline.problems.map((row) => row.slug)); const additions = problems.filter((problem) => !oldSlugs.has(problem.slug));
  const roadmaps = validateRoadmapReferences(ROADMAPS, new Set(problems.filter((problem) => problem.status === "PUBLISHED").map((problem) => problem.slug)));
  const newRoadmaps = roadmaps.filter((roadmap) => !baseline.roadmaps.some((row) => row.slug === roadmap.slug));
  if (additions.length !== 13 || additions.some((problem) => problem.status !== "PUBLISHED") || roadmaps.length !== 19 || newRoadmaps.length !== 1 || newRoadmaps[0].slug !== "capstone-mix-2" || newRoadmaps[0].steps.length !== 13) throw new Error("Unexpected additive source scope.");
  for (const row of baseline.roadmaps) {
    const source = roadmaps.find((roadmap) => roadmap.slug === row.slug); if (!source) throw new Error("Unknown baseline roadmap");
    const { steps, status } = row;
    const metadata = { slug: row.slug, title: row.title, description: row.description, difficulty: row.difficulty, estimatedMinutes: row.estimatedMinutes };
    const expected = { ...source, status: "PUBLISHED" };
    const actual = { ...metadata, status, steps: steps.map(({ slug, title, description, position, problemId }, index) => {
      if (position !== index + 1 || baseline.problems.find((problem) => problem.slug === slug)?.id !== problemId) throw new Error("Roadmap problem identity mismatch"); return { problemSlug: slug, title, description };
    }) };
    if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error(`Old roadmap content changed: ${row.slug}`);
  }
  const canonical = new PGlite(); const oldProblems = [];
  try {
    for (const row of baseline.problems) {
      const projected = normalize(bySlug.get(row.slug)!);
      const digest = await canonical.query<{ hash: string }>("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') AS hash", [JSON.stringify(projected)]);
      oldProblems.push({ ...row, contentSha256: digest.rows[0].hash });
    }
  } finally { await canonical.close(); }
  const payload = { source: BATCH6_SOURCE, baselineSha256: expectedBaselineSha256, capturedAt: baseline.captured_at, oldProblems, oldRoadmaps: baseline.roadmaps, problems: additions.map((problem) => ({ seed: normalize(problem), hash: problemHash(problem) })), roadmap: newRoadmaps[0] };
  const payloadSha = sha(canonicalJson(payload));
  const sql = `-- Source ${BATCH6_SOURCE}; reviewed baseline ${expectedBaselineSha256}.
-- All data changes are INSERT-only. One explicit transaction; timeouts apply before DO starts.
BEGIN;
SET LOCAL lock_timeout='1s';
SET LOCAL statement_timeout='25s';
SET LOCAL idle_in_transaction_session_timeout='5s';
SET LOCAL transaction_timeout='30s';
SET LOCAL TIME ZONE 'UTC';
DO $algosprint_batch6$
DECLARE
 source jsonb := ${quote(payload)};
 item jsonb; seed jsonb; solution jsonb; step jsonb; actual jsonb; previous jsonb := '{}'::jsonb; created jsonb := '{}'::jsonb;
 target_slug text; table_name text; problem_id uuid; solution_id uuid; roadmap_id uuid; new_problem_ids uuid[] := ARRAY[]::uuid[];
 affected int; problems_created int := 0; roadmaps_created int := 0; position_index int; expected_count int;
BEGIN
 PERFORM pg_advisory_xact_lock(713013::bigint); PERFORM pg_advisory_xact_lock(712012::bigint);
 LOCK TABLE ${appTables.map((table) => `app."${table}"`).join(", ")} IN SHARE ROW EXCLUSIVE MODE;
 IF (SELECT array_agg(tablename::text ORDER BY tablename COLLATE "C") FROM pg_tables WHERE schemaname='app') IS DISTINCT FROM ARRAY[${appTables.map((table) => `'${table}'`).join(",")}]::text[] THEN RAISE EXCEPTION 'Unexpected application table set'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid=ANY(ARRAY[${mutationTables.map((table) => `'app."${table}"'::regclass`).join(",")}])) OR EXISTS(SELECT 1 FROM pg_rewrite WHERE rulename<>'_RETURN' AND ev_class=ANY(ARRAY[${mutationTables.map((table) => `'app."${table}"'::regclass`).join(",")}])) THEN RAISE EXCEPTION 'Unexpected insert trigger or rewrite rule'; END IF;
 IF EXISTS(SELECT 1 FROM app."Problem" p WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(source->'oldProblems') old WHERE old->>'slug'=p.slug) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(source->'problems') desired WHERE desired->'seed'->>'slug'=p.slug)) THEN RAISE EXCEPTION 'Unknown existing problem'; END IF;
 IF EXISTS(SELECT 1 FROM app."Roadmap" r WHERE r.slug<>source->'roadmap'->>'slug' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(source->'oldRoadmaps') old WHERE old->>'slug'=r.slug)) THEN RAISE EXCEPTION 'Unknown existing roadmap'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(source->'oldProblems') LOOP
  SELECT jsonb_build_object('id',p.id,'slug',p.slug,'seedHash',p."seedHash",'status',p.status,'kind',p.kind,'revision',p.revision,'updatedAt',p."updatedAt") INTO actual FROM app."Problem" p WHERE p.id=(item->>'id')::uuid;
  IF actual IS DISTINCT FROM item-'contentSha256' THEN RAISE EXCEPTION 'Original problem ID/hash/status/revision/timestamp drift: %',item->>'slug'; END IF;
  target_slug := item->>'slug'; ${projectProblem} INTO actual;
  IF encode(sha256(convert_to(actual::text,'UTF8')),'hex') IS DISTINCT FROM item->>'contentSha256' THEN RAISE EXCEPTION 'Original problem complete content drift: %',target_slug; END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(source->'oldRoadmaps') LOOP
  SELECT to_jsonb(r) INTO actual FROM app."Roadmap" r WHERE r.id=(item->>'id')::uuid;
  IF actual IS DISTINCT FROM item-'steps' THEN RAISE EXCEPTION 'Original roadmap metadata drift'; END IF;
  SELECT COALESCE(jsonb_agg((to_jsonb(s)-'roadmapId')||jsonb_build_object('slug',p.slug) ORDER BY s.position),'[]'::jsonb) INTO actual FROM app."RoadmapStep" s JOIN app."Problem" p ON p.id=s."problemId" WHERE s."roadmapId"=(item->>'id')::uuid;
  IF actual IS DISTINCT FROM item->'steps' THEN RAISE EXCEPTION 'Original roadmap step ID/content drift'; END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(source->'problems') LOOP
  seed := item->'seed'; target_slug := seed->>'slug';
  IF EXISTS(SELECT 1 FROM app."Problem" WHERE slug=target_slug) THEN
   ${projectProblem} INTO actual;
   IF actual IS DISTINCT FROM seed OR NOT EXISTS(SELECT 1 FROM app."Problem" p WHERE p.slug=target_slug AND p."seedHash"=item->>'hash' AND p.revision=1 AND p.status='PUBLISHED' AND p.kind='CODING' AND p."publishedAt" IS NOT NULL) THEN RAISE EXCEPTION 'New problem conflict: %',target_slug; END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(seed->'categories') ref WHERE NOT EXISTS(SELECT 1 FROM app."Category" c WHERE c.slug=ref)) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(seed->'tags') ref WHERE NOT EXISTS(SELECT 1 FROM app."Tag" t WHERE t.slug=ref)) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(seed->'interviewStyles') ref WHERE NOT EXISTS(SELECT 1 FROM app."InterviewStyle" s WHERE s.slug=ref)) THEN RAISE EXCEPTION 'Missing taxonomy reference'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM app."Roadmap" WHERE slug=source->'roadmap'->>'slug') THEN
  SELECT jsonb_build_object('slug',r.slug,'title',r.title,'description',r.description,'difficulty',r.difficulty,'estimatedMinutes',r."estimatedMinutes",'steps',(SELECT COALESCE(jsonb_agg(jsonb_build_object('problemSlug',p.slug,'title',s.title,'description',s.description) ORDER BY s.position),'[]'::jsonb) FROM app."RoadmapStep" s JOIN app."Problem" p ON p.id=s."problemId" WHERE s."roadmapId"=r.id)) INTO actual FROM app."Roadmap" r WHERE r.slug=source->'roadmap'->>'slug' AND r.status='PUBLISHED';
  IF actual IS DISTINCT FROM source->'roadmap' OR EXISTS(SELECT 1 FROM (SELECT s.position,row_number() OVER(ORDER BY s.position) expected FROM app."RoadmapStep" s JOIN app."Roadmap" r ON r.id=s."roadmapId" WHERE r.slug=source->'roadmap'->>'slug') ordered WHERE position<>expected) THEN RAISE EXCEPTION 'New roadmap conflict'; END IF;
 END IF;
 FOR table_name IN SELECT tablename::text FROM pg_tables WHERE schemaname='app' ORDER BY tablename LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM app.%I t',table_name) INTO actual;
  previous := previous || jsonb_build_object(table_name,actual);
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(source->'problems') LOOP
  seed := item->'seed'; target_slug := seed->>'slug'; IF EXISTS(SELECT 1 FROM app."Problem" WHERE slug=target_slug) THEN CONTINUE; END IF;
  problem_id := gen_random_uuid(); new_problem_ids := array_append(new_problem_ids,problem_id);
  INSERT INTO app."Problem" SELECT (jsonb_populate_record(NULL::app."Problem",seed||jsonb_build_object('id',problem_id,'seedHash',item->>'hash','revision',1,'publishedAt',now(),'createdAt',now(),'updatedAt',now()))).*; ${count("Problem")}
  ${populateChildren("ProblemExample", "examples")}
  ${populateChildren("ProblemHint", "hints")}
  ${populateChildren("StarterCode", "starterCode")}
  ${populateChildren("TestCase", "testCases")}
  FOR solution IN SELECT value FROM jsonb_array_elements(seed->'solutions') LOOP
   solution_id := gen_random_uuid(); INSERT INTO app."ProblemSolution" SELECT (jsonb_populate_record(NULL::app."ProblemSolution",solution||jsonb_build_object('id',solution_id,'problemId',problem_id))).*; ${count("ProblemSolution")}
   INSERT INTO app."SolutionStep" SELECT (jsonb_populate_record(NULL::app."SolutionStep",entries.value||jsonb_build_object('id',gen_random_uuid(),'solutionId',solution_id))).* FROM jsonb_array_elements(solution->'steps') AS entries(value); ${count("SolutionStep")}
  END LOOP;
  INSERT INTO app."ProblemCategory" SELECT problem_id,c.id FROM app."Category" c JOIN jsonb_array_elements_text(seed->'categories') ref ON c.slug=ref; ${count("ProblemCategory")}
  INSERT INTO app."ProblemTag" SELECT problem_id,t.id FROM app."Tag" t JOIN jsonb_array_elements_text(seed->'tags') ref ON t.slug=ref; ${count("ProblemTag")}
  INSERT INTO app."ProblemInterviewStyle" SELECT problem_id,s.id FROM app."InterviewStyle" s JOIN jsonb_array_elements_text(seed->'interviewStyles') ref ON s.slug=ref; ${count("ProblemInterviewStyle")}
  problems_created := problems_created+1;
  -- LOCAL_REHEARSAL_LATE_FAILURE_MARKER
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(source->'problems') LOOP
  seed := item->'seed'; SELECT id INTO problem_id FROM app."Problem" WHERE slug=seed->>'slug'; IF NOT (problem_id=ANY(new_problem_ids)) THEN CONTINUE; END IF;
  INSERT INTO app."ProblemRelation" SELECT problem_id,p.id FROM app."Problem" p JOIN jsonb_array_elements_text(seed->'relatedSlugs') ref ON p.slug=ref; ${count("ProblemRelation")}
 END LOOP;
 seed := source->'roadmap';
 IF NOT EXISTS(SELECT 1 FROM app."Roadmap" WHERE slug=seed->>'slug') THEN
  roadmap_id := gen_random_uuid(); INSERT INTO app."Roadmap" SELECT (jsonb_populate_record(NULL::app."Roadmap",seed||jsonb_build_object('id',roadmap_id,'status','PUBLISHED','createdAt',now(),'updatedAt',now()))).*; ${count("Roadmap")}
  position_index := 0;
  FOR step IN SELECT value FROM jsonb_array_elements(seed->'steps') LOOP
   position_index := position_index+1; SELECT id INTO problem_id FROM app."Problem" WHERE slug=step->>'problemSlug';
   INSERT INTO app."RoadmapStep" SELECT (jsonb_populate_record(NULL::app."RoadmapStep",step||jsonb_build_object('id',gen_random_uuid(),'roadmapId',roadmap_id,'problemId',problem_id,'position',position_index))).*; ${count("RoadmapStep")}
  END LOOP; roadmaps_created := 1;
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(source->'problems') LOOP
  target_slug := item->'seed'->>'slug'; ${projectProblem} INTO actual;
  IF actual IS DISTINCT FROM item->'seed' OR NOT EXISTS(SELECT 1 FROM app."Problem" p WHERE p.slug=target_slug AND p."seedHash"=item->>'hash' AND p.revision=1 AND p.status='PUBLISHED' AND p.kind='CODING') THEN RAISE EXCEPTION 'Final new problem contract mismatch'; END IF;
 END LOOP;
 SELECT jsonb_build_object('slug',r.slug,'title',r.title,'description',r.description,'difficulty',r.difficulty,'estimatedMinutes',r."estimatedMinutes",'steps',(SELECT COALESCE(jsonb_agg(jsonb_build_object('problemSlug',p.slug,'title',s.title,'description',s.description) ORDER BY s.position),'[]'::jsonb) FROM app."RoadmapStep" s JOIN app."Problem" p ON p.id=s."problemId" WHERE s."roadmapId"=r.id)) INTO actual FROM app."Roadmap" r WHERE r.slug=source->'roadmap'->>'slug' AND r.status='PUBLISHED';
 IF actual IS DISTINCT FROM source->'roadmap' OR EXISTS(SELECT 1 FROM (SELECT s.position,row_number() OVER(ORDER BY s.position) expected FROM app."RoadmapStep" s JOIN app."Roadmap" r ON r.id=s."roadmapId" WHERE r.slug=source->'roadmap'->>'slug') ordered WHERE position<>expected) THEN RAISE EXCEPTION 'Final roadmap contract mismatch'; END IF;
 IF (SELECT count(*) FROM app."Problem")<>113 OR (SELECT count(*) FROM app."Roadmap")<>19 OR (SELECT count(*) FROM app."RoadmapStep")<>320 THEN RAISE EXCEPTION 'Unexpected final problem/roadmap/step counts'; END IF;
 FOR table_name IN SELECT tablename::text FROM pg_tables WHERE schemaname='app' ORDER BY tablename LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM app.%I t',table_name) INTO actual;
  expected_count := jsonb_array_length(previous->table_name)+COALESCE((created->>table_name)::int,0);
  IF NOT (actual @> (previous->table_name)) OR jsonb_array_length(actual)<>expected_count THEN RAISE EXCEPTION 'Existing rows/history changed or unexpected writes: %',table_name; END IF;
 END LOOP;
 RAISE NOTICE 'BATCH6_RESULT problems_created=% roadmaps_created=% rows_created=% source=${BATCH6_SOURCE} payload_sha256=${payloadSha}',problems_created,roadmaps_created,created;
END $algosprint_batch6$;
COMMIT;
`;
  await writeFile(outputPath, sql, { mode: 0o600 });
  const manifest = { source: BATCH6_SOURCE, baselineSha256: expectedBaselineSha256, normalizedPayloadSha256: payloadSha, sqlSha256: sha(sql), baselineCounts: { problems: 100, roadmaps: 18, steps: 307 }, finalCounts: { problems: 113, roadmaps: 19, steps: 320 }, newSlugs: additions.map((problem) => problem.slug), roadmap: newRoadmaps[0].slug, insertOnlyTables: mutationTables, noProductionExecution: true };
  await writeFile(`${outputPath}.manifest.json`, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 }); return manifest;
}

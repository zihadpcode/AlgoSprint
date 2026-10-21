import { pythonSolutionEntriesSchema } from "./python-solutions";
import { SIGNATURES } from "../../src/features/submissions/signatures";
import { pythonEntryPoint } from "../../src/features/submissions/python-names";

// Produces reviewable DML only. Caller must independently obtain the intended database fingerprint.
export function pythonSolutionRolloutSql(input: unknown, baseline: string) {
  const entries = pythonSolutionEntriesSchema.parse(input);
  if (!/^[a-f0-9]{32}$/.test(baseline)) throw new Error("Invalid production baseline");
  const data = JSON.stringify(entries.map((entry) => ({ ...entry, entryPoint: pythonEntryPoint(SIGNATURES[entry.slug].entryPoint) })));
  if (["$python_solutions$", "$rollout$"].some((delimiter) => data.includes(delimiter))) throw new Error("SQL literal delimiter collision");
  return `-- Insert-only Python editorial add-on. No Problem, starter or history changes.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE app."Problem", app."StarterCode" IN SHARE MODE;
LOCK TABLE app."ProblemSolution", app."SolutionStep" IN SHARE ROW EXCLUSIVE MODE;
DO $rollout$
DECLARE
  desired constant jsonb := $python_solutions$${data}$python_solutions$::jsonb;
  problems_before jsonb;
  starters_before jsonb;
  solutions_before jsonb;
  steps_before jsonb;
  entry jsonb;
  existing jsonb;
  problem_id uuid;
  solution_id uuid;
BEGIN
  IF (SELECT md5(string_agg(id::text || ':' || revision::text || ':' || coalesce("seedHash",''),',' ORDER BY id)) FROM app."Problem")
    IS DISTINCT FROM '${baseline}' THEN RAISE EXCEPTION 'Problem identity/revision/seed-hash drift'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) INTO problems_before FROM app."Problem" p;
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) INTO starters_before FROM app."StarterCode" s;
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) INTO solutions_before FROM app."ProblemSolution" s;
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) INTO steps_before FROM app."SolutionStep" s;

  -- Check every contract and existing approach before the first insert.
  FOR entry IN SELECT value FROM jsonb_array_elements(desired) LOOP
    SELECT p.id INTO problem_id FROM app."Problem" p WHERE p.slug=entry->>'slug'
      AND p.status='PUBLISHED' AND p.kind='CODING' AND p."seedHash"=entry->>'seedHash';
    IF problem_id IS NULL THEN RAISE EXCEPTION 'Published problem contract differs: %',entry->>'slug'; END IF;
    IF NOT EXISTS (SELECT 1 FROM app."StarterCode" WHERE "problemId"=problem_id AND language='PYTHON' AND "entryPoint"=entry->>'entryPoint')
      THEN RAISE EXCEPTION 'Python starter missing or mismatched: %',entry->>'slug'; END IF;
    SELECT (to_jsonb(s)-'id'-'problemId') || jsonb_build_object('steps',
      (SELECT coalesce(jsonb_agg(to_jsonb(t)-'id'-'solutionId' ORDER BY t.position),'[]'::jsonb)
       FROM app."SolutionStep" t WHERE t."solutionId"=s.id)) INTO existing
      FROM app."ProblemSolution" s WHERE s."problemId"=problem_id AND s.language='PYTHON'
      AND s.kind::text=entry->'solution'->>'kind';
    IF existing IS NOT NULL AND existing IS DISTINCT FROM entry->'solution'
      THEN RAISE EXCEPTION 'Existing Python editorial differs: %',entry->>'slug'; END IF;
  END LOOP;

  FOR entry IN SELECT value FROM jsonb_array_elements(desired) LOOP
    SELECT id INTO problem_id FROM app."Problem" WHERE slug=entry->>'slug';
    IF EXISTS (SELECT 1 FROM app."ProblemSolution" WHERE "problemId"=problem_id AND language='PYTHON'
      AND kind::text=entry->'solution'->>'kind') THEN CONTINUE; END IF;
    solution_id := pg_catalog.gen_random_uuid();
    INSERT INTO app."ProblemSolution" (id,"problemId",kind,language,title,intuition,approach,pseudocode,code,
      "timeComplexity","spaceComplexity","commonMistakes","interviewExplanation")
    SELECT solution_id,problem_id,s.kind::app."SolutionKind",'PYTHON'::app."Language",s.title,s.intuition,s.approach,s.pseudocode,s.code,
      s."timeComplexity",s."spaceComplexity",s."commonMistakes",s."interviewExplanation"
    FROM jsonb_to_record(entry->'solution') s(kind text,title text,intuition text,approach text,pseudocode text,code text,
      "timeComplexity" text,"spaceComplexity" text,"commonMistakes" text[],"interviewExplanation" text);
    INSERT INTO app."SolutionStep" (id,"solutionId",position,title,content)
    SELECT pg_catalog.gen_random_uuid(),solution_id,t.position,t.title,t.content
      FROM jsonb_to_recordset(entry->'solution'->'steps') t(position integer,title text,content text);
  END LOOP;

  FOR entry IN SELECT value FROM jsonb_array_elements(desired) LOOP
    SELECT (to_jsonb(s)-'id'-'problemId') || jsonb_build_object('steps',
      (SELECT coalesce(jsonb_agg(to_jsonb(t)-'id'-'solutionId' ORDER BY t.position),'[]'::jsonb)
       FROM app."SolutionStep" t WHERE t."solutionId"=s.id)) INTO existing
      FROM app."ProblemSolution" s JOIN app."Problem" p ON p.id=s."problemId"
      WHERE p.slug=entry->>'slug' AND s.language='PYTHON' AND s.kind::text=entry->'solution'->>'kind';
    IF existing IS DISTINCT FROM entry->'solution' THEN RAISE EXCEPTION 'Python editorial readback failed'; END IF;
  END LOOP;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM app."Problem" p)
    IS DISTINCT FROM problems_before THEN RAISE EXCEPTION 'Problem rows changed'; END IF;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) FROM app."StarterCode" s)
    IS DISTINCT FROM starters_before THEN RAISE EXCEPTION 'Starter rows changed'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(solutions_before) old(row)
    LEFT JOIN app."ProblemSolution" s ON s.id=(old.row->>'id')::uuid
    WHERE to_jsonb(s) IS DISTINCT FROM old.row) THEN RAISE EXCEPTION 'Existing solution changed'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(steps_before) old(row)
    LEFT JOIN app."SolutionStep" s ON s.id=(old.row->>'id')::uuid
    WHERE to_jsonb(s) IS DISTINCT FROM old.row) THEN RAISE EXCEPTION 'Existing walkthrough changed'; END IF;
END;
$rollout$;
SELECT (SELECT count(*) FROM app."ProblemSolution" WHERE language='PYTHON') AS "pythonSolutions",
  (SELECT count(DISTINCT "problemId") FROM app."ProblemSolution" WHERE language='PYTHON') AS "pythonProblems",
  (SELECT md5(string_agg(id::text || ':' || revision::text || ':' || coalesce("seedHash",''),',' ORDER BY id)) FROM app."Problem") AS "problemBaseline";
COMMIT;
`;
}

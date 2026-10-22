import { z } from "zod";
import { videoBatchSchema } from "../../src/lib/validators/video";

// Reviewable video-only DML. This function never opens a database connection or executes SQL.
export function videoRolloutSql(input: unknown, baseline: string, expectedPublishedCount = 125, expectedExistingRows: unknown = []) {
  const videos = videoBatchSchema.parse(input);
  if (!/^[a-f0-9]{32}$/.test(baseline)) throw new Error("Invalid production problem baseline");
  if (!Number.isSafeInteger(expectedPublishedCount) || expectedPublishedCount < 1 || expectedPublishedCount > 1000) throw new Error("Invalid expected published problem count");
  const positions = new Map<string, number>();
  const desired = videos.map((video) => {
    const position = (positions.get(video.problemSlug) ?? 0) + 1;
    positions.set(video.problemSlug, position);
    return { ...video, position };
  });
  const pinned = z.array(z.object({ id: z.uuid(), problemId: z.uuid(), youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/), createdAt: z.string().min(1) }).passthrough()).max(500).parse(expectedExistingRows);
  const pinnedData = JSON.stringify(pinned);
  const data = JSON.stringify(desired);
  if (["$video_payload$", "$video_rollout$"].some((delimiter) => data.includes(delimiter) || pinnedData.includes(delimiter))) throw new Error("SQL literal delimiter collision");
  return `-- Insert-only verified video add-on. No problem, starter, solution or user-history writes.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(712013::bigint);
LOCK TABLE app."Problem" IN SHARE MODE;
LOCK TABLE app."ProblemVideo" IN SHARE ROW EXCLUSIVE MODE;
DO $video_rollout$
DECLARE
  desired constant jsonb := $video_payload$${data}$video_payload$::jsonb;
  expected_old constant jsonb := $video_payload$${pinnedData}$video_payload$::jsonb;
  problems_before jsonb;
  videos_before jsonb;
  entry jsonb;
  current_content jsonb;
  problem_id uuid;
BEGIN
  IF (SELECT count(*) FROM app."Problem" WHERE status='PUBLISHED') <> ${expectedPublishedCount}
    THEN RAISE EXCEPTION 'Published problem count differs'; END IF;
  IF (SELECT md5(string_agg(id::text || ':' || revision::text || ':' || coalesce("seedHash",''),',' ORDER BY id)) FROM app."Problem")
    IS DISTINCT FROM '${baseline}' THEN RAISE EXCEPTION 'Problem identity/revision/seed-hash drift'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) INTO problems_before FROM app."Problem" p;
  SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.id),'[]'::jsonb) INTO videos_before FROM app."ProblemVideo" v;

  FOR entry IN SELECT value FROM jsonb_array_elements(expected_old) LOOP
    IF NOT EXISTS (SELECT 1 FROM app."ProblemVideo" v WHERE v.id=(entry->>'id')::uuid AND to_jsonb(v)=entry)
      THEN RAISE EXCEPTION 'Pinned existing video row differs or is missing'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM app."ProblemVideo" v JOIN app."Problem" p ON p.id=v."problemId"
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(desired) d(row)
      WHERE d.row->>'problemSlug'=p.slug AND d.row->>'youtubeId'=v."youtubeId"))
    THEN RAISE EXCEPTION 'Unmanaged existing video row'; END IF;

  -- Check all content and display positions before the first insert.
  FOR entry IN SELECT value FROM jsonb_array_elements(desired) LOOP
    SELECT id INTO problem_id FROM app."Problem" WHERE slug=entry->>'problemSlug' AND status='PUBLISHED' AND kind='CODING';
    IF problem_id IS NULL THEN RAISE EXCEPTION 'Published problem missing: %', entry->>'problemSlug'; END IF;
    SELECT to_jsonb(v)-'id'-'createdAt'-'problemId' INTO current_content FROM app."ProblemVideo" v
      WHERE v."problemId"=problem_id AND v."youtubeId"=entry->>'youtubeId';
    IF current_content IS NOT NULL AND current_content IS DISTINCT FROM entry-'problemSlug'
      THEN RAISE EXCEPTION 'Existing video content or position differs: %/%',entry->>'problemSlug',entry->>'youtubeId'; END IF;
    IF EXISTS (SELECT 1 FROM app."ProblemVideo" WHERE "problemId"=problem_id AND position=(entry->>'position')::integer AND "youtubeId"<>entry->>'youtubeId')
      THEN RAISE EXCEPTION 'Existing video position occupied: %/%',entry->>'problemSlug',entry->>'position'; END IF;
  END LOOP;

  FOR entry IN SELECT value FROM jsonb_array_elements(desired) LOOP
    SELECT id INTO problem_id FROM app."Problem" WHERE slug=entry->>'problemSlug';
    IF EXISTS (SELECT 1 FROM app."ProblemVideo" WHERE "problemId"=problem_id AND "youtubeId"=entry->>'youtubeId') THEN CONTINUE; END IF;
    INSERT INTO app."ProblemVideo" (id,"problemId","youtubeId",title,channel,concept,"referenceProblem",bridge,segments,position)
    VALUES (pg_catalog.gen_random_uuid(),problem_id,entry->>'youtubeId',entry->>'title',entry->>'channel',entry->>'concept',
      entry->>'referenceProblem',entry->>'bridge',entry->'segments',(entry->>'position')::integer);
  END LOOP;

  FOR entry IN SELECT value FROM jsonb_array_elements(desired) LOOP
    SELECT to_jsonb(v)-'id'-'createdAt'-'problemId' INTO current_content FROM app."ProblemVideo" v
      JOIN app."Problem" p ON p.id=v."problemId" WHERE p.slug=entry->>'problemSlug' AND v."youtubeId"=entry->>'youtubeId';
    IF current_content IS DISTINCT FROM entry-'problemSlug' THEN RAISE EXCEPTION 'Video readback failed'; END IF;
  END LOOP;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM app."Problem" p)
    IS DISTINCT FROM problems_before THEN RAISE EXCEPTION 'Problem rows changed'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(videos_before) old(row)
    LEFT JOIN app."ProblemVideo" v ON v.id=(old.row->>'id')::uuid
    WHERE to_jsonb(v) IS DISTINCT FROM old.row) THEN RAISE EXCEPTION 'Existing video row changed'; END IF;
END;
$video_rollout$;
SELECT (SELECT count(*) FROM app."ProblemVideo") AS "videoRows",
  (SELECT count(DISTINCT "problemId") FROM app."ProblemVideo") AS "problemsWithVideos",
  (SELECT md5(string_agg(id::text || ':' || revision::text || ':' || coalesce("seedHash",''),',' ORDER BY id)) FROM app."Problem") AS "problemBaseline";
COMMIT;
`;
}

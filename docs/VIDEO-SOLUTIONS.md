# Video lessons

A problem can carry short YouTube lessons on the concept it needs. This page covers the data model, how to add a video
without inventing anything, the framing rule the UI enforces, and the privacy trade-offs.

## The framing rule

An external video here is **a related lesson using its own example and interface**. Exact local walkthroughs are labeled separately and follow the selected JavaScript or Python optimal solution. Usually an external video solves a different
*reference problem* (for example "Daily Temperatures" for a histogram-area problem). The page therefore:

- explains in visible framing that external lessons may solve related problems and bridge notes identify the adaptations
  (`VIDEO_FRAMING` in `src/components/problems/video-lesson.tsx`); exact originals are labeled separately;
- names the **concept**, the video's **reference problem**, and a **bridge** of two to three sentences that connects the
  concept to this problem's own statement;
- shows **timestamp chips** only when chapter ranges exist, to skip intros and go to where the idea is explained.

Write the bridge for the problem, not the video. It must be specific to the target statement (what is the same, what is
different, which rule in the statement the video does not cover). A close reference variant may be attached when its origin is clear and the bridge identifies the similarity and the rules the learner must adapt. A broad introductory prerequisite is useful context, but does not count as a complete language-specific solution video.

Placement: the card sits **after the layered hints and before the guided solutions**, collapsed inside a
`<details>` "Reveal video lesson" control, the same interaction the solutions use. The concept name and the bridge can
hint at the approach, so they are not shown until the learner opens it; only the framing sentence is visible. The
pattern name is already shown in the page header, so the card does not reveal it.

## Data model

Table `app."ProblemVideo"` (Prisma model `ProblemVideo`, migration `202610130001_problem_videos`):

| column | notes |
| --- | --- |
| `id` | uuid primary key; never sent to the browser |
| `problemId` | foreign key to `Problem`, `ON DELETE CASCADE` |
| `youtubeId` | `VARCHAR(11)`, database check `^[A-Za-z0-9_-]{11}$` |
| `title`, `channel` | as returned by YouTube oEmbed |
| `concept`, `referenceProblem`, `bridge` | the lesson framing described above |
| `segments` | JSON array of `{startSeconds, endSeconds, label}`, possibly empty; database check that it is an array of at most 12 |
| `position` | 1 to 5, display order within a problem |
| `createdAt` | |

Constraints: unique `(problemId, youtubeId)` and `(problemId, position)`, index on `problemId`, non-blank text checks.
Row level security is enabled with no policies (like every `app` table), so only the owning database role can read or
write it. The page reads it through the trusted Prisma connection with an explicit `select`; `queryProblem` returns
`youtubeId, title, channel, concept, referenceProblem, bridge, segments`, ordered by `position`, plus verified
`codingLanguages` from the static source registry. It also returns local `walkthroughs` from the reviewed manifest,
projecting only playback metadata and excluding internal integrity hashes. Exact recordings are withheld if the current
statement, examples, optimal solution or seed identity no longer match their source hash. These annotations apply only to published
problems, guests included. Stored segments are re-validated on read; malformed ones are dropped, never rendered.

Seed data lives in `src/data/seeds/videos.ts` (not in the problem JSON, which is insert-only and hash-protected).
`prisma/seed-videos.ts` is insert-only: it creates missing rows, skips identical rows, and throws
`Video seed conflict ...` before writing anything if an existing row for the same problem and video differs from the seed
or if a different video already occupies the position. It never updates a row. The order of entries per problem in the
seed list defines `position`. Validation (`src/lib/validators/video.ts`, run by `npm run seed:validate`) requires every
problem slug to exist and be PUBLISHED, an 11-character id, bounded text, `endSeconds > startSeconds`, segments sorted and
non-overlapping, no duplicate video per problem and at most 5 per problem.

Production video publication uses the guarded video-only SQL exporter below. Do not run the general problem seed to publish videos. No schema migration is needed for language labels or local walkthroughs.

## Adding a video safely

Never write a video id, title, channel or timestamp from memory or from a guess.

1. Find candidates on YouTube itself (search results or the channel). Prefer well-known educational channels.
2. Verify that the video exists and is embeddable. This must return HTTP 200 with a `title` and `author_name`:

   ```sh
   curl -s -w '\nHTTP %{http_code}\n' 'https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DVIDEO_ID&format=json'
   ```

   Copy `title` and `author_name` into `title` and `channel`. Check that the title plausibly matches the concept.
3. Segments: only use chapters the creator published in the video description (open the video and read the chapter
   list), copying their start times; a segment ends where the next chapter starts and the last one ends at the video
   length. Skip a chapter that only reads the problem statement. If you cannot verify chapters, leave `segments: []`.
   Do not estimate times by watching and guessing.
4. Write `concept`, `referenceProblem` and a `bridge` after reading the target problem's statement and examples.
5. Add the entry to `src/data/seeds/videos.ts`, then run `npm run seed:validate`, `node --import tsx scripts/verify-videos.mjs`
   (re-checks every id, title and channel against oEmbed; needs network), and the tests.
6. Chapters can be edited by the creator later. Re-run the verify script from time to time; a changed or removed video
   needs a new migration/seed decision, because existing seeded rows are never overwritten.

## Privacy and embedding

- The player uses the privacy-enhanced domain `https://www.youtube-nocookie.com/embed/<id>` with `rel=0`.
- Nothing is requested from YouTube when the page loads: the card shows text and a "Load video player" button, with no
  thumbnail. The iframe is only created after a click on that button or on a timestamp chip, and only then is
  `autoplay=1` added (the click is the learner's consent to play).
- The URL is built by `embedUrl` in `src/lib/youtube.ts` from the validated 11-character id and an integer number of
  seconds only; any other id throws. Tests assert the origin, path and query for hostile inputs.
- The site sends `Referrer-Policy: no-referrer` globally, and YouTube embeds can refuse to play without a referrer. The
  iframe element alone sets `referrerpolicy="strict-origin-when-cross-origin"`; the global header is unchanged.
- The iframe has a descriptive `title`, `allowfullscreen`, and an explicit `allow` list. Chips are real buttons.
  A plain "Watch on YouTube" link (new tab, `noopener noreferrer`) is always shown.
- The site sends a Content-Security-Policy restricting base URLs, objects, forms and page framing. It does not restrict
  `frame-src`; the YouTube iframe retains the explicit player attributes above. Embedded YouTube may still set its own
  cookies and collect data once the player is loaded, even on the nocookie domain.

## October 13 browser verification

The rebased candidate `a4efd51` was built with Next.js 16.3.8 and Node 24 against a dedicated local PostgreSQL test database (100 problems, 18 paths, 18 video mappings). In Chrome, Dock Threshold initially had no iframe. Enter opened the lesson, Enter loaded the player, and actual video playback was observed with `paused: false`, ready state 4 and advancing time. Enter on the coding chapter replaced the iframe URL with `start=310`; playback continued in that chapter. The iframe used youtube-nocookie.com and its explicit strict-origin-when-cross-origin referrer policy. Captured warnings/errors were empty. The test player tab was closed; no account data was saved.

[Actual local playback capture](screenshots/2026-10-13-video-local-playback.jpg), captured at 1710×929. This is a local production-build playback check for one representative lesson, not a production rollout or a check of every video on every browser.

## October 13 production rollout

PR63 merged as `2028fbd` after both final-head checks passed at `54c436b` (540 unit/component/migration tests and 104 PostgreSQL integration tests, plus the full build/trace/smoke pipeline). Before merge, the additive migration was applied through the authenticated Supabase connector with the repository SQL unchanged. The wrapper guarded all three existing Prisma migration checksums and atomically recorded the fourth migration with checksum `52bce6a689b7b4724bf38d4c255acc7a5246fa970f8e52234dffe9e3829330ed`. Readback confirmed four completed migrations, RLS enabled and no SELECT grant for anon/authenticated. Advisors reported no ERRORs; the existing leaked-password WARN and default-deny RLS INFO findings remain.

A separately reviewed video-only SQL transaction inserted 18 mappings for 14 unique videos over 18 problems. It used source fixture `85fb344`, byte-identical in final `54c436b`, the approved 100-problem/18-path snapshot, source validation, bounded locks/timeouts and all-row conflict checks. SQL SHA256: `15a8311eb7bf4eb42736355e83ccdc9b922d9bf824f9bd2a3660bdb5efd4cd6b`. Independent local PostgreSQL tests passed first insertion, unchanged repeat, UUID rejection and content/position conflicts. Production readback matched every source video object; the prior 100 problems, 18 paths and 307 steps remained unchanged. Repeat execution also preserved video IDs/timestamps. No submission-history cleanup was enabled.

Vercel deployment `dpl_2tPvDHVjdBDdgSbGm4Dvr6rLcVYx` is Ready at the canonical domain and matches GitHub's merge status. Chrome production verification on Dock Threshold found no iframe initially, then keyboard reveal/chapter activation loaded the nocookie player at 58 seconds. Actual playback reached 65 seconds with `paused: false` and ready state 4; captured browser warnings/errors were empty. [Production playback capture](screenshots/2026-10-13-video-production-playback.jpg), 1710×929. JavaScript public-example execution also passed 2/2 after correcting the sample's no-match branch; the runner correctly rejected the earlier sample. Device recovery stayed off, nothing was submitted or saved, and both temporary tabs were closed. These checks do not complete broader authenticated, cross-account or accessibility acceptance.


## Language coverage and original walkthroughs

The original 45 `VIDEOS` entries remain unchanged and in the same per-problem positions. `video-additions.json` appends verified references; JavaScript additions must have matching-main-algorithm evidence. Existing references remain useful even when they are only prerequisites.

`video-sources.json` is a deduplicated registry keyed by YouTube ID. It records verified title/channel, instruction languages and their evidence URLs, published chapters when known, and per-problem reference classifications. A channel publishing Python source code elsewhere is not proof that its video teaches Python. Unknown instruction languages are never inferred from a problem name. `PREREQUISITE_ONLY` and `UNVERIFIED_LANGUAGE` references do not count toward complete coverage. Preserved metadata is historical; `latestVerifiedMetadata`, when present, records later creator title/channel changes without rewriting existing rows.

Exact original recordings are listed in `problem-walkthroughs.json`. Each entry identifies its problem and language, local MP4, WebVTT captions and plain-text transcript, duration, dimensions, renderer version, and media/text SHA-256 hashes. `sourceHash` must match the current statement, examples and optimal guided solution produced by `loadWalkthroughJobs()`. JavaScript and Python recordings are distinct language-specific artifacts. Changes to an optimal solution or statement require regenerating the affected recordings.

Coverage validation requires one meaningful reference or exact original for each of the 125 published problems in both supported languages: 250 pairs. It verifies local paths, the 12 MiB media cap, source/media/text hashes, nonempty transcripts and ordered caption cues within the video duration. Independent media decoding and content review remain part of release verification; a valid hash alone does not prove a usable recording.

```sh
node --import tsx scripts/validate-video-coverage.ts --references-only
node --import tsx scripts/validate-video-coverage.ts
npm run seed:validate
```

The first command reports external-reference gaps without claiming readiness. The strict command and `seed:validate` require the complete 250-pair set and verify the original assets; CI runs the same seed validation.

## Insert-only video publication

Export SQL for review with the production fingerprint obtained independently using:

```sql
SELECT md5(string_agg(id::text || ':' || revision::text || ':' || coalesce("seedHash",''), ',' ORDER BY id))
FROM app."Problem";
```

```sh
node --import tsx scripts/export-video-rollout.ts --baseline <fingerprint> --expected-existing <baseline.json> --output <new-file.sql>
```

The optional baseline JSON contains `existing_videos`, copied from a read-only `to_jsonb(ProblemVideo)` query including IDs and creation timestamps. The exporter opens no database connection and refuses to overwrite an output file. Its SQL serializes with the existing video seed, locks Problem/ProblemVideo with bounded timeouts, requires the published count and problem fingerprint, pins provided old rows, rejects unmanaged pairs or any content/position conflict, inserts missing rows only, and verifies readback plus unchanged problem and prior-video snapshots. Repeating an identical batch preserves all IDs and timestamps. It writes no starters, solutions, problem statements or user history.

Apply only the reviewed video-only transaction after the matching application and original media are ready. Preserve the prior 45 rows during production readback and run the complete language coverage checks against the deployed result. oEmbed verifies identity and availability at inspection time; it does not guarantee playback in every browser or region, so keep the external watch link and test representative playback.

## Regenerating reviewed original recordings

Prepare source-bound jobs, then render selected problem/language pairs:

```sh
node --import tsx scripts/prepare-walkthrough-jobs.ts --output /tmp/jobs.json
python3 scripts/render-problem-walkthroughs.py --input /tmp/jobs.json --ffmpeg <pinned-binary> --only slug:LANGUAGE
python3 scripts/render-problem-walkthroughs.py --input /tmp/jobs.json --ffmpeg <pinned-binary> --only slug:LANGUAGE --run
```

The renderer defaults to a dry run. Rendering uses local macOS speech synthesis and Pillow; it does not call a paid speech API. Code pages use at least 22-pixel text, and caption timing follows the measured PCM narration. Publish only the reviewed aggregate manifest after validating source hashes, all asset hashes, readable pages, captions and full media decoding. The browser uses an opt-in native video player with captions and a transcript link.

## October 22 complete language-coverage validation

The catalog contains 198 mappings over 165 verified YouTube sources. Meaningful related references cover 155 problem/language pairs; 52 JavaScript and 43 Python exact recordings fill the remaining 95 pairs. Strict validation passes all 250 pairs across 125 published problems. The original 45 mappings remain byte-equivalent and keep their positions.

All 95 recordings passed complete H.264/AAC decoding, audible-narration checks, source/media/text hashes, fast-start MP4 inspection, and exact narration/transcript/caption comparisons with ordered cues inside the video duration. Their combined MP4 size is 61,930,018 bytes; the largest is 1,206,599 bytes. Sampled implementation frames, including the long Booth Bookings and Scale Splits solutions, are readable and unclipped.

Node 24 validation passed 973 unit/component tests with two optional skips, lint, TypeScript, the production build, traced sandbox execution and unconfigured-auth HTTP smoke. Real PostgreSQL tests cover insert/repeat/conflict rollback and source drift. All 95 recordings also match the fully seeded public detail query, which returns playback metadata without integrity hashes. Fresh oEmbed identity checks passed all 165 sources.

Chrome checks against the local production build played the JavaScript and Python Scale Splits recordings with advancing time and ready state 4. Changing the video language updated the editor/editorial selectors and unloaded the old player; changing back from the editor also unloaded playback. Captured browser warnings/errors were empty. These representative checks do not guarantee every external video plays in every browser or region.

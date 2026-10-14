# Video lessons

A problem can carry short YouTube lessons on the concept it needs. This page covers the data model, how to add a video
without inventing anything, the framing rule the UI enforces, and the privacy trade-offs.

## The framing rule

A video here is **a lesson on a concept, not a solution to this problem**. Usually the video solves a different
*reference problem* (for example "Daily Temperatures" for a histogram-area problem). The page therefore:

- says in fixed text, always visible, that the video uses a different example problem and is not a walkthrough of
  this problem (`VIDEO_FRAMING` in `src/components/problems/video-lesson.tsx`; a test pins the wording);
- names the **concept**, the video's **reference problem**, and a **bridge** of two to three sentences that connects the
  concept to this problem's own statement;
- shows **timestamp chips** only when chapter ranges exist, to skip intros and go to where the idea is explained.

Write the bridge for the problem, not the video. It must be specific to the target statement (what is the same, what is
different, which rule in the statement the video does not cover). If the reference problem is essentially the same task
as the target, do not attach the video: it would be a walkthrough in disguise. A close variant may be included only when the bridge explicitly identifies the similarity and a meaningful rule the learner must adapt; the Ticket Pair pilot names its tie-break and no-match rules.

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
only `youtubeId, title, channel, concept, referenceProblem, bridge, segments`, ordered by `position`, for published
problems, guests included. Stored segments are re-validated on read; malformed ones are dropped, never rendered.

Seed data lives in `src/data/seeds/videos.ts` (not in the problem JSON, which is insert-only and hash-protected).
`prisma/seed-videos.ts` is insert-only: it creates missing rows, skips identical rows, and throws
`Video seed conflict ...` before writing anything if an existing row for the same problem and video differs from the seed
or if a different video already occupies the position. It never updates a row. The order of entries per problem in the
seed list defines `position`. Validation (`src/lib/validators/video.ts`, run by `npm run seed:validate`) requires every
problem slug to exist and be PUBLISHED, an 11-character id, bounded text, `endSeconds > startSeconds`, segments sorted and
non-overlapping, no duplicate video per problem and at most 5 per problem.

Production seeding is a separate, deliberate step: run `npm run db:seed` against production only after the migration
has been deployed.

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
- There is no Content-Security-Policy, so the iframe is governed by its attributes only (see `SECURITY-REVIEW.md`).
  Embedded YouTube may still set its own cookies and collect data once the player is loaded, even on the nocookie domain.

## October 13 browser verification

The rebased candidate `a4efd51` was built with Next.js 16.3.8 and Node 24 against a dedicated local PostgreSQL test database (100 problems, 18 paths, 18 video mappings). In Chrome, Dock Threshold initially had no iframe. Enter opened the lesson, Enter loaded the player, and actual video playback was observed with `paused: false`, ready state 4 and advancing time. Enter on the coding chapter replaced the iframe URL with `start=310`; playback continued in that chapter. The iframe used youtube-nocookie.com and its explicit strict-origin-when-cross-origin referrer policy. Captured warnings/errors were empty. The test player tab was closed; no account data was saved.

[Actual local playback capture](screenshots/2026-10-13-video-local-playback.jpg), captured at 1710×929. This is a local production-build playback check for one representative lesson, not a production rollout or a check of every video on every browser.

## October 13 production rollout

PR63 merged as `2028fbd` after both final-head checks passed at `54c436b` (540 unit/component/migration tests and 104 PostgreSQL integration tests, plus the full build/trace/smoke pipeline). Before merge, the additive migration was applied through the authenticated Supabase connector with the repository SQL unchanged. The wrapper guarded all three existing Prisma migration checksums and atomically recorded the fourth migration with checksum `52bce6a689b7b4724bf38d4c255acc7a5246fa970f8e52234dffe9e3829330ed`. Readback confirmed four completed migrations, RLS enabled and no SELECT grant for anon/authenticated. Advisors reported no ERRORs; the existing leaked-password WARN and default-deny RLS INFO findings remain.

A separately reviewed video-only SQL transaction inserted 18 mappings for 14 unique videos over 18 problems. It used source fixture `85fb344`, byte-identical in final `54c436b`, the approved 100-problem/18-path snapshot, source validation, bounded locks/timeouts and all-row conflict checks. SQL SHA256: `15a8311eb7bf4eb42736355e83ccdc9b922d9bf824f9bd2a3660bdb5efd4cd6b`. Independent local PostgreSQL tests passed first insertion, unchanged repeat, UUID rejection and content/position conflicts. Production readback matched every source video object; the prior 100 problems, 18 paths and 307 steps remained unchanged. Repeat execution also preserved video IDs/timestamps. No submission-history cleanup was enabled.

Vercel deployment `dpl_2tPvDHVjdBDdgSbGm4Dvr6rLcVYx` is Ready at the canonical domain and matches GitHub's merge status. Chrome production verification on Dock Threshold found no iframe initially, then keyboard reveal/chapter activation loaded the nocookie player at 58 seconds. Actual playback reached 65 seconds with `paused: false` and ready state 4; captured browser warnings/errors were empty. [Production playback capture](screenshots/2026-10-13-video-production-playback.jpg), 1710×929. JavaScript public-example execution also passed 2/2 after correcting the sample's no-match branch; the runner correctly rejected the earlier sample. Device recovery stayed off, nothing was submitted or saved, and both temporary tabs were closed. These checks do not complete broader authenticated, cross-account or accessibility acceptance.

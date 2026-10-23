# AlgoSprint portfolio copy

## 🟦 Project description

AlgoSprint is a deployed full-stack coding interview preparation project built with Next.js, React, TypeScript, PostgreSQL, Prisma and Supabase Auth. Its catalog contains 125 original coding problems, 20 learning paths with 332 steps and 105 noncoding interview prompts. All coding problems have JavaScript/Python execution and video coverage; Python guided solutions cover all 264 existing approaches. The October 22 release is deployed and has representative production playback evidence. It includes private notes and bookmarks, learning roadmaps, progress tracking, JavaScript/Python execution and timed mock interviews with saved explanations and transparent self-assessment reports. JavaScript visible examples run in browser workers and save nothing. Python Run requires sign-in, runs in managed Vercel Sandbox VMs and saves an attempt. Verified JavaScript submissions use QuickJS WebAssembly or a configured external Judge0 service; Python submissions use Vercel Sandbox. Server-side authorization protects account data, while structured validation, database constraints and transactional workflows handle conflicting edits and repeated requests.

## 🟩 Resume bullet options

Choose two or three that fit the role. These describe implemented code; do not add user counts, speed improvements or deployment claims without evidence.

- Built a full-stack interview practice platform with Next.js, TypeScript, Prisma, PostgreSQL and Supabase Auth, including an original problem library, learning roadmaps, private notes and bookmarks, and progress dashboards.
- Implemented server-authorized content administration with structured validation, optimistic conflict detection, transactional imports and protected publication workflows.
- Developed private timed mock interviews with randomized question selection, frozen question snapshots, server-enforced deadlines, stale-save protection and self-assessment reports.
- Implemented JavaScript practice with browser workers and QuickJS WebAssembly, plus authenticated Python execution in managed Vercel Sandbox VMs, recording verified solves while withholding hidden test payloads and diagnostics.
- Published language-specific video guidance for all 125 coding problems, combining verified external references with 95 narrated and captioned original walkthroughs and shared editor, solution and video language selection.
- Added deterministic problem generators with trusted references and a separate reviewable draft workflow, supported by unit, component, migration and PostgreSQL integration tests.

## 🟨 Accurate demo narration

“I built AlgoSprint to practice the engineering behind an interview preparation product. I can organize original problems into learning paths, keep my notes private, track practice and rehearse explanations in timed sessions. The interview score reflects my own structured assessment; it is not an automated correctness or hiring-readiness score. JavaScript visible examples run in my browser. Python practice runs require sign-in and save an attempt; signed-in submissions check hidden cases in the selected language's sandbox.”

[The live demo](https://algosprint-brown.vercel.app) is deployed on Vercel with Supabase. Registration, confirmation, login/logout, saved-practice flows and accepted/failing QuickJS submissions have recorded production evidence in [DEPLOYMENT.md](DEPLOYMENT.md). The [Python production canary](evidence/python-production-2026-10-21.md) records correct, wrong-answer and runtime-error Run results plus an accepted Submit and verified progress. Representative JavaScript/Python and YouTube playback passed after the October 22 release; it does not verify every video in every browser or region. Further live privacy, session, interview, mobile and accessibility acceptance checks remain open. Do not describe the app as production-proven, used by real customers, fully accessible, an AI interviewer, or a plagiarism/proctoring system.

## 🟪 Evidence to link

Link the repository if its visibility permits the intended audience, the relevant merged pull requests, the final CI run, and actual captured screens. Add a live URL only after deployment and verification. Describe scale or performance only after reproducible measurements; the current suite is engineering evidence, not a load-test claim.

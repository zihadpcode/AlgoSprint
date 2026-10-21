# Python production verification — October 21, 2026

PR90 head `0758cbeed7fe95b3c38ede09d8ffef396c439283` passed both GitHub validations and Vercel preview before merge `3ede853031547525a02e0f0e1143fe45738ea7bc`. Merged-main validation [39686121379](https://github.com/zihadpcode/AlgoSprint/actions/runs/39686121379) passed. Local activation validation recorded 955 passing unit tests, two optional skips, a production build and lint. Independent review found no remaining activation blocker. The runtime source matches the committed 25-VM matrix and five supervisor probes; those 30 VMs were all confirmed stopped.

The reviewed production deployment was rebuilt with `PYTHON_RUNNER=vercel-sandbox`; the existing `CODE_RUNNER_ENABLED=true` and `CODE_RUNNER_PROVIDER=sandbox` settings were retained. Deployment `13W2btZgmyKUUF1odJsm4ggqpguF`, URL `https://algosprint-2pfelk77h-zihadpcode-7061.vercel.app`, became Ready and received the canonical `https://algosprint-brown.vercel.app` alias.

## Real signed-in canary

An existing browser session on the canonical host exercised Relay Window, revision 2. No fabricated authentication, copied cookies or new account was used.

| Check | Observed result | Persisted attempt |
| --- | --- | --- |
| Correct Python Run | Accepted, 2/2 visible tests, 55 ms | `1bff285e-35c7-4be0-b986-74bcbc42a6e5` |
| Incorrect Python Run | Wrong answer, 0/2, 71 ms | `4f5e0dee-fb38-43ef-90a7-f8da6d90f6f0` |
| Failing Python Run | Runtime error, 0/2, 95 ms | `c5518048-5101-4a2f-958f-8ecb0c1cb0d5` |
| Correct Python Submit | Accepted, 6/6, 64 ms, peak RSS 15,016 KB | `c5440e34-296f-4a5b-8ef5-01e006378b39` |
| JavaScript Run | Passed, 2/2, browser-only, nothing saved | None |
| JavaScript Submit | Accepted, 6/6, 15 ms | `3eb40358-6654-4fbd-9c97-2155c0d8e668` |

Browser Submit displayed only the summary and explicitly withheld hidden details. The page showed “Solved · verified” and the solved count increased from one to two. A separate production database read confirmed all five saved attempts completed with the expected language, mode, verdict, integer runtime and problem revision; progress was `SOLVED`, `verifiedRevision=2`, with a verification timestamp.

These ordinary saved attempts and progress remain in the account. Browser automation became unavailable after the successful checks, while preparing an additional history screenshot; the completed verdicts above were already observed and independently read back.

## Starter rollout and preservation

The first transaction inserted only Relay Window's exact reviewed Python starter. After the canary, a second guarded transaction inserted the remaining 124. Both pinned published problem identities, revisions and seed hashes and compared full Problem-row snapshots before and after. They preserved every existing starter and performed no Problem, submission, progress, auth or schema update.

Full rollout SQL SHA256: `2711844691a9de5044f34a422370004217f8a229960edfbf3e3bf372e7918e14`. Local rehearsal passed canary-first application, unchanged repeat, conflicting starter rollback, revision drift and slug identity drift. A separate production query after commit compared all entry points and code against the reviewed generator: **125 desired, 125 exact matches**. Counts were 125 Python starters, 125 JavaScript starters and 125 published coding problems.

The problem ID/revision/seed-hash fingerprint remained `01f732e17becd4adfaa1add51f5f1766`. Full in-transaction snapshots provided the stronger all-column preservation check; the fingerprint alone does not cover every content column.

At `2026-10-21T22:33:02.774Z`, a fully paginated Sandbox listing returned 219 total historical sessions and **zero running, pending or stopping sessions**. Temporary caller credential files were removed after that check.

## Rollback

Remove the production `PYTHON_RUNNER` setting and redeploy the reviewed production source. The capability gate then disables Python Run/Submit and rejects new execution before reserving attempts; existing starter languages remain selectable. Keep starters and saved history. Runtime changes still require the relevant hosted isolation and resource-boundary checks; this representative authenticated canary does not verify correct Python solutions for every published problem.

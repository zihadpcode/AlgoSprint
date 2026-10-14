# Dependency security review

Report updated: 2026-10-13 after the Monaco 0.57.0 upgrade. The October 12 independent `npm audit --package-lock-only --omit=dev` on Node 24 reproduced 10 package findings before the update (one critical, six high, three moderate) and six afterwards (zero critical, four high, two moderate). After Monaco 0.57.0, `npm audit --omit=dev` still reports six affected packages: four high tooling findings and two low editor/sanitizer findings, with zero moderate or critical findings. These package-level counts include affected dependents and are not counts of distinct vulnerabilities. Re-run the audit when dependencies change. Reachability statements below describe the inspected integration, not a proof that every possible attack is excluded; do not use `npm audit fix --force` without compatibility review.

## Fixed

| Package | From → to | Why |
| --- | --- | --- |
| `next`, `@next/env`, `eslint-config-next` | 16.3.5 → 16.3.8 | The critical [`next/og` ImageResponse advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) affects versions >=16.2.0 and <16.3.6; its first fix is 16.3.6, included in this update. The [16.3.8 release](https://github.com/vercel/next.js/releases/tag/v16.3.8) fixes additional SSRF, cache and information-disclosure advisories. This is a patch update, validated by the recorded unit/integration, build, trace and HTTP smoke checks, rather than a guarantee of unchanged APIs. No app call sites for `next/og`, `ImageResponse`, `use cache` or Draft Mode were identified; that limits the known exposure without establishing that all framework advisories were unreachable. |
| `sharp` (and its `@img/*` binaries) | 0.35.4 → 0.35.5 | [High advisory in bundled librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). Transitive through Next's image tooling; no app `next/image` call site was identified. |
| `source-map-js` | 1.2.1 → 1.2.2 | [High, event-loop denial of service through crafted indexed source maps](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). Transitive through source-map/CSS tooling, including non-dev PostCSS dependencies. No app endpoint accepting source maps was identified; the dependency is patched regardless of that assessment. |
| `fast-uri` | 3.1.7 → 3.1.8 | [Moderate, inconsistent host normalisation](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj). |
| `brace-expansion` | patch updates | Transitive development tooling. |
| `monaco-editor` / bundled DOMPurify | 0.56.0 / 3.4.8 → 0.57.0 / 3.4.15 | The [official changelog](https://raw.githubusercontent.com/microsoft/monaco-editor/v0.57.0/CHANGELOG.md) records the sanitizer update. It removes the previously reported moderate findings; two low findings remain below. Existing editor imports and the bundled same-origin worker path are retained. |

## Open, with reasoning

| Finding | Severity | Reachable? | Why it is not fixed now |
| --- | --- | --- | --- |
| `prisma` → `@prisma/config` → `deepmerge-ts` ([stack exhaustion on recursive objects](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)) | high | No request-time call site identified. `prisma` is a **development** dependency used for generation, migration and seed commands; its configuration is the repository's own `prisma.config.ts`. This does not assess arbitrary untrusted tooling configurations. | The October 12 audit suggested `prisma@6.19.3`, a **downgrade** from 7.10.0 that would require a separate Prisma/schema/adapter compatibility review. Do not apply it as an automatic audit fix. Recheck current compatible patched releases during the next dependency review. |
| `prisma` → `mysql2` ([auth-plugin downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), [unbounded zlib inflate](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3)) | high | No app MySQL connection path identified. This dependency belongs to Prisma tooling; the app uses PostgreSQL. | Same Prisma compatibility limitation as above. |
| `monaco-editor` → `dompurify` | low | Bundled in the browser. No matching vulnerable call pattern was identified in the inspected Monaco 0.57 integration; see the limits below. | Current stable Monaco 0.57.0 bundles DOMPurify 3.4.15. A future compatible Monaco release needs the patched bundled sanitizer. npm's suggested downgrade to 0.56.0 would restore the earlier moderate findings and was not applied. |

Monaco 0.57 bundles DOMPurify 3.4.15 and uses sanitization hooks for hover/markdown rendering. Its inspected `esm/vs/base/browser/domSanitize.js` wrapper passes HTML strings with per-call configuration, removes its hooks after each call, and does not enable `IN_PLACE` or call persistent `setConfig()`. This is a call-pattern assessment, not an exhaustive browser exploit test.

Two low advisories remain: [rawtext-root serialization/reparse](https://github.com/cure53/DOMPurify/security/advisories/GHSA-6688-9rhm-gjv2) and [node-removing afterSanitize hooks](https://github.com/cure53/DOMPurify/security/advisories/GHSA-p98j-92pf-mc4p). Both require `IN_PLACE`; the first patched DOMPurify version is 3.4.16. Updating a separate package does not replace Monaco's bundled sanitizer code.

Upgrade verification used Node 24 / Next 16.3.8: 33 focused editor/runner tests, lint, production build with TypeScript and the 210-file sandbox trace passed. Real Chrome on the local production build verified editor typing, undo/redo, a JavaScript→Python→JavaScript cycle preserving the draft, both public examples passing, reset cancel/confirm, and Tab moving from the editor to Run visible tests. A bundled same-origin worker appeared in the browser asset inventory; no browser warnings or errors were captured. The Python starter was an owned local-test fixture and was removed afterwards; no production content or authenticated draft behavior is claimed by this check.

## Not available

October 12 read-only GitHub API checks reported Dependabot vulnerability alerts and secret scanning disabled. The code-scanning endpoint returned `404: no analysis found` with a permission/scope diagnostic; this establishes that no analysis was available to that check, not that code scanning was conclusively disabled. The dependency audit above was run manually and is not continuous monitoring. Enabling Dependabot alerts and secret scanning requires repository administration; no repository security setting was changed by this review.

## Related controls already in place

Row-level security is enabled on every `app` table and the browser roles hold no grants (a read-only catalog query against production on October 13 found RLS enabled on all 22 `app` tables and no `USAGE` on the `app` schema for `anon`, `authenticated` or `service_role`); Supabase's security advisors report only the accepted INFO notes and the Pro-plan-only leaked-password warning (see `docs/DEPLOYMENT.md`).

## Known gaps from the October 13 code review

These are observations, not exploited issues; none is fixed by this document.

- **Browser test runner is not a security boundary.** Visible tests run in a same-origin Web Worker that shadows `fetch` and similar globals. In headless Chrome on October 13, deleting that shadowing property restored `fetch` inside such a worker. Learner code a person chooses to paste and run could therefore reach same-origin and external endpoints. Moving the worker to an opaque origin (for example a `data:` URL worker) would reduce this, but needs a real-browser check first.
- **No Content-Security-Policy header.** `next.config.ts` sends `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and a `Permissions-Policy` that disables camera, microphone and geolocation. A CSP would need to account for Monaco's workers and styles; none has been attempted.
- **Video lessons embed a third-party iframe with no CSP to constrain it.** Because no Content-Security-Policy exists (previous point), nothing restricts `frame-src` or what the embed may do beyond its own attributes: the `youtube-nocookie.com` host built from a validated 11-character id, an explicit `referrerpolicy`, a fixed `allow` list, and creation only after a click. `X-Frame-Options: DENY` protects this site from being framed; it does not limit what this site frames. Once loaded, YouTube can still set cookies and receive the viewer's IP and requests. See `VIDEO-SOLUTIONS.md`.
- **No explicit app-side other-session revocation after a password reset.** `updatePassword` calls `updateUser` and nothing else. Whether the provider revokes other sessions on a password change was not verified, so this records the absence of an app-side step, not a confirmed live-session risk.
- **No retention limit on `UserSubmission`.** Each execution stores up to 20,000 characters of code. Per-user limits (5 per minute, 30 per hour) bound the rate but not the total; on a free-plan database that is a slow storage risk, not an immediate one.
- **Fixed after the review: GitHub Actions in `ci.yml` are pinned to commit SHAs** (`actions/checkout` v7.0.1 and `actions/setup-node` v7.1.0, resolved through the GitHub API on October 13), so a moved tag cannot change what CI runs. The cost is that updates are manual: nothing here watches for new releases or advisories for these actions.


## Video schema follow-up

The October 13 video migration adds one private table, taking `app` to 23 tables. `ProblemVideo` has RLS enabled and revoked PUBLIC/anon/authenticated table privileges; production readback confirmed browser SELECT denial. Fresh security advisors reported no ERRORs, with 24 expected RLS/no-policy INFO findings (23 app tables and Prisma history) and the existing leaked-password WARN. Default-deny RLS is intentional for trusted server-only Prisma access; see [the deployment record](DEPLOYMENT.md).

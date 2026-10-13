# Dependency security review

Report corrected: 2026-10-13 against `920c20b`. The package manifest and lockfile are unchanged from the reviewed Next.js update. The October 12 independent `npm audit --package-lock-only --omit=dev` on Node 24 reproduced 10 package findings before the update (one critical, six high, three moderate) and six afterwards (zero critical, four high, two moderate). These are package-level counts, including affected dependents, rather than six distinct vulnerabilities. Re-run the audit when dependencies change. Reachability statements below describe the inspected integration, not a proof that every possible attack is excluded; do not use `npm audit fix --force` without compatibility review.

## Fixed

| Package | From → to | Why |
| --- | --- | --- |
| `next`, `@next/env`, `eslint-config-next` | 16.3.5 → 16.3.8 | The critical [`next/og` ImageResponse advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) affects versions >=16.2.0 and <16.3.6; its first fix is 16.3.6, included in this update. The [16.3.8 release](https://github.com/vercel/next.js/releases/tag/v16.3.8) fixes additional SSRF, cache and information-disclosure advisories. This is a patch update, validated by the recorded unit/integration, build, trace and HTTP smoke checks, rather than a guarantee of unchanged APIs. No app call sites for `next/og`, `ImageResponse`, `use cache` or Draft Mode were identified; that limits the known exposure without establishing that all framework advisories were unreachable. |
| `sharp` (and its `@img/*` binaries) | 0.35.4 → 0.35.5 | [High advisory in bundled librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). Transitive through Next's image tooling; no app `next/image` call site was identified. |
| `source-map-js` | 1.2.1 → 1.2.2 | [High, event-loop denial of service through crafted indexed source maps](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). Transitive through source-map/CSS tooling, including non-dev PostCSS dependencies. No app endpoint accepting source maps was identified; the dependency is patched regardless of that assessment. |
| `fast-uri` | 3.1.7 → 3.1.8 | [Moderate, inconsistent host normalisation](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj). |
| `brace-expansion` | patch updates | Transitive development tooling. |

## Open, with reasoning

| Finding | Severity | Reachable? | Why it is not fixed now |
| --- | --- | --- | --- |
| `prisma` → `@prisma/config` → `deepmerge-ts` ([stack exhaustion on recursive objects](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)) | high | No request-time call site identified. `prisma` is a **development** dependency used for generation, migration and seed commands; its configuration is the repository's own `prisma.config.ts`. This does not assess arbitrary untrusted tooling configurations. | The October 12 audit suggested `prisma@6.19.3`, a **downgrade** from 7.10.0 that would require a separate Prisma/schema/adapter compatibility review. Do not apply it as an automatic audit fix. Recheck current compatible patched releases during the next dependency review. |
| `prisma` → `mysql2` ([auth-plugin downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), [unbounded zlib inflate](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3)) | high | No app MySQL connection path identified. This dependency belongs to Prisma tooling; the app uses PostgreSQL. | Same Prisma compatibility limitation as above. |
| `monaco-editor` → `dompurify` | moderate | Bundled in the browser. No matching vulnerable call pattern was identified in the inspected Monaco 0.56 integration; see the specific limits below. | The October 12 audit suggested `monaco-editor@0.57.0`, a pre-1.0 minor update. Verify the editor, workers and browser rendering in a separate dependency change. No Monaco or DOMPurify upgrade is included here. |

Monaco 0.56 bundles DOMPurify 3.4.8 and uses sanitization hooks for hover/markdown rendering. Its inspected `esm/vs/base/browser/domSanitize.js` wrapper passes HTML strings with per-call configuration, removes its hooks after each call, and does not enable `IN_PLACE` or call persistent `setConfig()`. This is narrower evidence than a claim that an attacker must control sanitizer configuration:

- [`ALLOWED_ATTR` pollution](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cmwh-pvxp-8882) requires application use of persistent `setConfig()` plus a hook that mutates the allowlist. Attacker-controlled HTML can exploit that application pattern without controlling the hook.
- [Hook-removal XSS](https://github.com/cure53/DOMPurify/security/advisories/GHSA-55q2-fjhq-7xh7) requires `IN_PLACE` and an element-removal hook. [Rawtext-root XSS](https://github.com/cure53/DOMPurify/security/advisories/GHSA-6688-9rhm-gjv2) requires `IN_PLACE` followed by serialization/reparsing; attacker control of configuration is not required.
- The audit also reports [Trusted Types policy retention](https://github.com/advisories/GHSA-vxr8-fq34-vvx9) and [custom-element hook handling](https://github.com/advisories/GHSA-c2j3-45gr-mqc4). All reported DOMPurify findings remain open. The wrapper inspection is not an exhaustive browser exploit test or a claim that untrusted editor content is harmless.

## Not available

October 12 read-only GitHub API checks reported Dependabot vulnerability alerts and secret scanning disabled. The code-scanning endpoint returned `404: no analysis found` with a permission/scope diagnostic; this establishes that no analysis was available to that check, not that code scanning was conclusively disabled. The dependency audit above was run manually and is not continuous monitoring. Enabling Dependabot alerts and secret scanning requires repository administration; no repository security setting was changed by this review.

## Related controls already in place

Row-level security is enabled on every `app` table and the browser roles hold no grants; Supabase's security advisors report only the accepted INFO notes and the Pro-plan-only leaked-password warning (see `docs/DEPLOYMENT.md`).

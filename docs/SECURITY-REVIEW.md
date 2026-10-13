# Dependency security review

Last reviewed: 2026-10-12, with `npm audit --omit=dev` on Node 24, against the lockfile after the Next.js patch update below. Re-run it and update this file when dependencies change. A bare audit count overstates risk and a blind `npm audit fix --force` can break the app, so each remaining finding is recorded with why it is or is not reachable.

## Fixed

| Package | From → to | Why |
| --- | --- | --- |
| `next`, `@next/env`, `eslint-config-next` | 16.3.5 → 16.3.8 | One **critical** advisory (remote code execution in `next/og` `ImageResponse`, affected 16.2.0 up to 16.3.5) and several moderate or high ones (cache poisoning, image-optimizer SSRF, metadata image disclosure) all fixed from 16.3.8. A patch release on the same minor line, so no API change. The app does not call `next/og`, `ImageResponse`, `use cache` or Draft Mode, so the critical issue was not exploitable here, but the framework serves production and the update is cheap. |
| `sharp` (and its `@img/*` binaries) | 0.35.4 → 0.35.5 | High advisory in a bundled librsvg. Transitive through Next's image tooling, which the app does not use. |
| `source-map-js` | 1.2.1 → 1.2.2 | High, event-loop denial of service through crafted source maps. Build-time only. |
| `fast-uri` | 3.1.7 → 3.1.8 | Moderate, inconsistent host normalisation. |
| `brace-expansion` | patch updates | Transitive development tooling. |

## Open, with reasoning

| Finding | Severity | Reachable? | Why it is not fixed now |
| --- | --- | --- | --- |
| `prisma` → `@prisma/config` → `deepmerge-ts` (stack exhaustion on recursive objects) | high | No. `prisma` is a **development** dependency, the CLI used by `prisma generate`, `migrate` and the seed. It never runs while the app serves requests. The merged configuration is the repository's own `prisma.config.ts`. | npm offers `prisma@6.19.3`, a **downgrade** from 7.10.0 that the schema and the `pg` adapter do not support. The newest `prisma` tag is an 8.0 release candidate. Revisit when a stable Prisma 7.x or 8.x ships a patched dependency. |
| `prisma` → `mysql2` (auth-plugin downgrade, unbounded zlib inflate) | high | No. `mysql2` is used by Prisma's local development tooling for MySQL. The app talks to PostgreSQL only, and nothing connects to a MySQL server. | Same as above. |
| `monaco-editor` → `dompurify` (`ALLOWED_ATTR` pollution through `setConfig()`, hook and `IN_PLACE` edge cases) | moderate | Marginal. It ships to the browser, but the advisories need an attacker to control DOMPurify's own configuration or hooks. Monaco uses DOMPurify internally for hover and markdown rendering and exposes neither to learner input. The editor displays the learner's own code. | The fix is `monaco-editor@0.57.0`, a pre-1.0 minor release whose editor and worker integration cannot be verified by a headless run. Treat it as its own change with a browser check. |

## Not available

GitHub's Dependabot alerts, secret scanning and code scanning are **disabled** for this repository (the REST API reports so), so this manual audit is currently the only automated signal. Enabling Dependabot alerts and secret scanning (Settings → Code security) is recommended; it needs repository admin access and was not changed here.

## Related controls already in place

Row-level security is enabled on every `app` table and the browser roles hold no grants; Supabase's security advisors report only the accepted INFO notes and the Pro-plan-only leaked-password warning (see `docs/DEPLOYMENT.md`).

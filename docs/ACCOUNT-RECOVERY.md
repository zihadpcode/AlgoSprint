# Password recovery and email confirmation

`/forgot-password` requests a password reset email. `/resend-confirmation` resends an existing signup confirmation. Both are linked from the account forms, validate email on the server, and return the same generic message for eligible addresses, ineligible addresses, provider errors, and rate limits. They never call an admin API or disclose recipient eligibility.

Requests use the existing Supabase publishable-key client and trusted `APP_URL` origin. The email redirect is exactly `${APP_URL}/auth/callback`, which must be allowed in Supabase **Authentication → URL Configuration** for each intended environment. Existing signup callback configuration is reused; no new database migration, secret, or recovery redirect is required. Keep Supabase's normal confirmation URL in signup and recovery email templates so the provider verifies the email link before returning its PKCE code. Public delivery requires a working production SMTP provider or Send Email hook.

Open the **newest link in the same browser** that requested it. Starting another signup, resend, or recovery flow can supersede the verifier used by an older link. The app supports the installed SDK's `sb_flow_id` callback parameter when present, but does not enable its experimental redirect-forwarding flag: that flag can invalidate an exact callback allowlist entry by adding query parameters.

Successful recovery code exchanges go to `/reset-password` using the SDK's verifier-bound recovery flow metadata. Password updates additionally require signature-verified claims containing a provider-issued `amr` entry with `method: "recovery"` and a timestamp within the previous hour, plus a live confirmed, nonanonymous user whose ID matches the claims subject. Ordinary login/signup sessions, editable user metadata, and callback query flags cannot authorize this action. Auth hooks must retain the documented recovery AMR for this flow. The new password must contain 12–128 characters and match its confirmation; spaces are preserved. Email requests do not sign out or overwrite an existing session. Completing an email code exchange establishes the provider-returned session as in ordinary signup confirmation.

Supabase provides the shared enforcement for `/recover` and `/resend`: provider-side IP and project email limits, plus applicable per-user email cooldowns. The form adds a 60-second retry countdown for feedback. Its timestamp is not a server limiter, and app instances do not maintain a process-local throttle. Project-specific quotas and SMTP behavior must be verified in the target environment; none were changed by this implementation. See [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits), [password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [confirmation resend](https://supabase.com/docs/reference/javascript/auth-resend), and [JWT recovery claims](https://supabase.com/docs/guides/auth/jwt-fields).

Local verification covers generic responses including 429/network errors, password validation, signature/session failures, missing/future/stale recovery claims, identity mismatches, ordinary-session rejection, callback safety, and a mocked transport against the installed SDK. The transport test verifies email PKCE cookie persistence, preservation of an existing session cookie, and returned provider throttling without contacting Supabase or sending mail. TypeScript, focused lint, and all 252 unit tests pass on Node 24.

Initial implementation used no production configuration or live email. The October 13 recovery result is recorded below; old-password rejection, signup-confirmation resend and live expired/reused-link/provider-limit checks remain separate acceptance items.

## October 13 live redirect correction

Production dashboard inspection found Site URL set to the older `algosprint-zihadpcode-7061.vercel.app` alias and four redirect patterns for that alias/preview hosts, with no match for the application's requested `https://algosprint-brown.vercel.app/auth/callback`. Supabase falls back to Site URL when the requested redirect is not allowed. This explains why an email could open the old homepage rather than the callback that exchanges the PKCE code and routes recovery to the reset form.

The Site URL was corrected to `https://algosprint-brown.vercel.app` and the exact `https://algosprint-brown.vercel.app/auth/callback` was added. Existing redirect entries were preserved. A dashboard reload confirmed both saved values. No password, account role, SMTP setting or email template was changed.

Separately, a failed callback's fixed error now remains visible on `/login?confirmation=failed` even when that browser already has a signed-in session. Normal signed-in visits to `/login` still redirect to the safe destination. Neither that query flag nor the displayed alert grants recovery access; the reset page and action retain provider-verified recovery claims.

An installed-SDK round-trip test now exercises the real request action, cookie storage, PKCE challenge, callback and reset-page rendering against a fully intercepted synthetic provider with signed ES256 claims. It covers successful recovery, signup-session denial, reused links, wrong-browser links and normal signed-in routing. The reused-link case failed before the fix because the existing session hid the alert.

After the configuration correction, the owner reported on October 13: a fresh password reset worked, and login succeeded with the new password. This is owner-verified live recovery, rather than an automated credential test. Codex did not read, enter or change the password. Old-password rejection and signup-confirmation resend were not reported as tested. Future checks should start from the canonical [forgot-password page](https://algosprint-brown.vercel.app/forgot-password) and open the newest email link in the requesting browser.

## October 27 authenticated acceptance (candidate 3f2d64a)

Scope: no disposable Supabase test account or signed-in session was available to this lane, and creating one would have meant sending real signup mail or writing to the production auth schema, so no live signed-in flow was run. Nothing below is production-authentication proof.

Run on Node 24.22.1 against a fresh local Postgres 17 database ending `_test` (owned container, random loopback port, migrations applied with `prisma migrate deploy`, removed afterwards):

- `tests/auth*`: 10 files, 71 tests passed (actions, callback, forwarding, proxy and proxy coverage, recovery, recovery round-trip and SDK transport, session, validation).
- `npm run test:integration`: 22 files, 183 tests passed. Ownership coverage includes owner-only notes, flags and saved lists with two users on the same problems (`saved`), owner-only progress and recent attempts (`progress`), interview reads, writes and reports denied to another user including an administrator (`interviews`), and database re-authorization that rejects a revoked administrator (`admin`).
- Full unit run: 992 passed, 6 failed under 22-way parallel load (Python editorial/starter, batch 7 sandbox, admin import size); the four affected files pass when rerun alone (82 tests), so these are timing flakes, not auth findings.

Read-only requests to the deployed site (no cookies, no mail): `/dashboard`, `/notes`, `/bookmarks`, `/progress`, `/admin`, `/review`, `/mock-interview` and `/interview-results/<id>` answer 307 to `/login?next=…` (the results ID is not echoed). `/auth/callback` with an invalid code, with no code, and with an off-site `next` all answer 303 to `/login?confirmation=failed`. Anonymous `/reset-password` renders 200 without granting a reset.

Still needing live access with disposable accounts: ordinary-user denial of `/admin`, cross-account note/bookmark/progress/interview ID probing, refresh and expired-session behavior, confirmation resend, expired and reused recovery links, and old-password rejection after a reset.

# AlgoSprint screenshots and interface checks

## 🟦 Capture status

Guest captures from the deployed `5efe69d` checkpoint are available in [screenshots/](screenshots/): the library at 1440×1000, Relay Window at 390×844, and a successful guest visible-test run at 1440×1000. They were captured on 2026-10-01 using Headless Chromium 154 and visually inspected. Whole-page scroll width matched the viewport for the library at 1440px and the problem page at 390px and 320px. These checks do not establish full keyboard, screen-reader, real-device or authenticated correctness. The historical cloud-browser localhost restriction belongs to the earlier working environment.

Use synthetic test accounts and original sample work. Hide addresses, tokens, private IDs and personal notes. Never fabricate populated screenshots or label a mockup as the running application. Record the commit, environment, browser, viewport and date with each capture.

## 🟩 Capture checklist

| File suggestion | Screen / state | What it demonstrates |
| --- | --- | --- |
| `01-home-desktop.png` | Landing at 1440px | Current features and working entry links |
| `02-library-desktop.png` | Search and filtered library | Readable original problem cards and filter state |
| `03-problem-desktop.png` | Published problem workspace | Statement, examples, editor and real runner status |
| `04-roadmap-desktop.png` | Roadmap details | Ordered practice steps and actual progress |
| `05-dashboard-desktop.png` | Test account dashboard | Real test-account data with accurately labeled metrics |
| `06-saved-desktop.png` | Notes/bookmarks/review | Owned saved practice workflow |
| `07-interview-desktop.png` | Active interview | Timer, prompt, explicit save and unsaved state |
| `08-report-desktop.png` | Completed interview | Answers, references and self-assessment wording |
| `09-admin-desktop.png` | Admin editing synthetic content | Structured validation and lifecycle controls |
| `10-home-mobile.png` | Landing at 390px | Stacked layout and legible primary actions |
| `11-problem-mobile.png` | Problem at 390px | Bounded editor, readable content and reachable controls |
| `12-interview-mobile.png` | Active interview at 390px | Timer, answer and save controls remain usable |
| `13-empty-error.png` | Genuine empty/error state in preview | Useful explanation and recovery route |

Only capture admin screens with the intended admin test account. Keep capture-only content out of the public curated library. Do not trigger destructive failure modes on production just to obtain an error screenshot.

## 🟨 Acceptance checks

- [ ] Check desktop 1440px, mobile 390px and narrow 320px widths. Long titles, constraints, validation messages and URLs wrap without whole-page horizontal overflow.
- [ ] Horizontal workspace navigation scrolls and each destination remains reachable. Code/editor regions may scroll inside their own container.
- [ ] Check 200% zoom, readable contrast and focus indicators. Sticky elements must not cover focused controls or errors.
- [ ] Navigate links, forms, editor entry/exit, save, finish and confirmation controls with the keyboard. No keyboard trap; focus order remains sensible.
- [ ] Verify labels and errors with a screen reader, including loading status and timer behavior. Countdown updates must not become continuous disruptive announcements.
- [ ] Check mobile input focus and the on-screen keyboard on an actual mobile browser. The 16px form text rule is a mitigation, not proof against every viewport issue.
- [ ] Check long-content layouts, empty data, slow loading, failed saves and retry. Use the preview environment for controlled failures.
- [ ] Verify reduced-motion preference and ensure feedback is understandable without animation.
- [ ] Ensure preview and production screenshots show the actual enabled runner behavior. An unavailable provider must not look like a successful submission.

## 🟪 Evidence log

Add one row per completed check or capture; leave failures visible until fixed and rechecked.

| Date | Commit | URL/environment | Browser / viewport | Check or filename | Result / issue |
| --- | --- | --- | --- | --- | --- |
| 2026-10-01 | `5efe69d` | Production `/problems` | Chromium 154 / 1440×1000 | [Library desktop](screenshots/2026-10-01-library-desktop.png) | Real 35-problem library; inspected; scroll width 1440px |
| 2026-10-01 | `5efe69d` | Production `/problems/relay-window` | Chromium 154 / 390×844 | [Problem mobile](screenshots/2026-10-01-problem-mobile.png) | Inspected; scroll width 390px; separate 320px viewport check also passed |
| 2026-10-01 | `5efe69d` | Production `/problems/relay-window` | Chromium 154 / 1440×1000 | [Guest visible run](screenshots/2026-10-01-problem-run-desktop.png) | Original synthetic solution passed 2/2 public examples; no submission or saved progress |
| 2026-10-12 | Content seeded from `2f95ec7`; UI capture during the October 12 release | Production `/problems/canopy-layers` | Chrome / 1433×881 | [New-library guest run](screenshots/2026-10-12-canopy-layers-guest-run.jpg) | Original solution entered in Monaco; 2/2 public examples passed in the browser; nothing saved. Roadmap page two also reached with keyboard activation. |
| Pending | Pending | Authenticated production / controlled preview | Pending | Other screens, full keyboard, real-device and accessibility checks | Not yet performed |

### October 13 editor dependency check

[Monaco 0.57 guest run](screenshots/2026-10-13-monaco057-local-run.jpg), captured in Chrome at 1521×881 against the local production build of editor dependency commit `703ee50`: an original Canopy Layers solution passed both public examples. Typing, undo/redo, JavaScript→Python→JavaScript draft retention, reset cancel/confirm and Tab exiting the editor passed. The browser asset inventory observed the same-origin bundled worker; no browser warnings/errors were captured. Python was a temporary starter in the dedicated local test database and was removed; this capture does not represent production Python execution or authenticated draft-recovery acceptance.

A follow-up on the canonical production `/problems/canopy-layers` page at merge `218e998` also passed 2/2 public examples with original sample code in Chrome at 1521×881 ([production capture](screenshots/2026-10-13-monaco057-production-run.jpg)). An existing signed-in session was present; device recovery stayed off, and no Submit, note, progress or bookmark action was used. Browser warnings/errors were empty and the temporary sample tab was closed. This verifies the public-example editor flow in that session, not account ownership or authenticated draft recovery.

After the October 13 path seed from `b680f58`, Chrome at 1521×881 rendered [Heaps and Streams in production](screenshots/2026-10-13-heaps-path-production.jpg) with Hard difficulty, four ordered steps and the 195-minute estimate. An existing signed-in session showed its real zero-progress state; no progress or account data was changed. Browser warnings/errors were empty. This is a render check, not proof of cross-account isolation or progress writes.

### October 13 video production check

[Dock Threshold video playback](screenshots/2026-10-13-video-production-playback.jpg), Chrome at 1710×929 on production merge `2028fbd`: the initially unloaded lesson was revealed with Enter, and a chapter button loaded the player at 58 seconds. The observed video was playing beyond that timestamp, with no captured warnings/errors. An existing signed-in session was present; no account data was changed. A separate JavaScript public-example run on the same release passed 2/2, saving nothing. This verifies representative playback and keyboard activation, not every video/browser or full accessibility.

### October 14 narrow video and editor check

At production `b7bf9a4`, desktop Chrome with temporary 390×844 and 320×844 viewport overrides rendered Dock Threshold without whole-page horizontal overflow: document scroll width equaled each viewport width. The expanded concept/bridge text wrapped, and the player stayed inside the card (264px and 194px wide respectively). Enter revealed the lesson and activated the 0:58 chapter; Tab moved to the next chapter button with a visible focus ring. [390px capture](screenshots/2026-10-14-video-narrow-390.jpg). Before activation no iframe was present; activation used the expected `youtube-nocookie.com` URL and `start=58`.

At 320px the Monaco editor was bounded at 228px wide and both execution buttons remained inside the viewport. Code regions retain their own horizontal scrolling. Device recovery stayed off; no code, note, progress, bookmark or submission was saved. The created tab was closed and the viewport override reset. These are desktop responsive-layout and representative keyboard checks, not actual mobile input, 200% zoom, screen-reader or complete authenticated acceptance.

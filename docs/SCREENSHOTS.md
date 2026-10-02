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
| Pending | Pending | Authenticated production / controlled preview | Pending | Other screens, full keyboard, real-device and accessibility checks | Not yet performed |

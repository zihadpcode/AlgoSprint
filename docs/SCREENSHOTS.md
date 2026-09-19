# AlgoSprint screenshots and interface checks

## 🟦 Capture status

No release screenshots are claimed yet. The working session's cloud browser could not reach the local server (`ERR_BLOCKED_BY_CLIENT`). Capture against the verified hosted preview when it exists. CSS changes and HTTP checks do not prove mobile, keyboard or visual correctness.

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
| Pending | Pending | Hosted preview pending | Pending | Live capture and accessibility checks | Not yet performed |

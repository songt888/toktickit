# Lab 4 Peer Review Record

Author: Kirakit Kingkaew ([songt888](https://github.com/songt888)).
Peer reviewer: Nattakit Prasertsak ([stickkersz](https://github.com/stickkersz)).

Every Lab 4 feature PR went into `lab4-staging` and was merged only after stickkersz's formal
GitHub **APPROVED** review. All reviewed commits, states and merge SHAs below were read from the
GitHub API on 2026-11-01; concerns are paraphrased from the posted reviews. A comment is never
counted as approval.

## Summary of PRs into `lab4-staging`

| PR | Issue | Rounds of changes requested | Approved at | Merge SHA |
|---|---|---|---|---|
| [#74](https://github.com/songt888/toktickit/pull/74) Engineering contract and test plan | [#65](https://github.com/songt888/toktickit/issues/65) | 2 | `7f793c2` | `6a36b0a` |
| [#75](https://github.com/songt888/toktickit/pull/75) Stop tracking Lab_3_Report.pdf | [#76](https://github.com/songt888/toktickit/issues/76) | 1 | `16a25f5` | `e9744b9` |
| [#77](https://github.com/songt888/toktickit/pull/77) Data foundation, migration and seed | [#66](https://github.com/songt888/toktickit/issues/66) | 3 | `5689123` | `29f5c9f` |
| [#78](https://github.com/songt888/toktickit/pull/78) Actions Taken API, authorization and lifecycle | [#67](https://github.com/songt888/toktickit/issues/67) | 2 (the second was posted twice) | `b2eec02` | `5bc23ad` |
| [#79](https://github.com/songt888/toktickit/pull/79) Ticket workflow and resolution gate | [#69](https://github.com/songt888/toktickit/issues/69) | 1 | `cae2076` | `0457a58` |
| [#80](https://github.com/songt888/toktickit/pull/80) Actions Taken UI and Requester read-only view | [#68](https://github.com/songt888/toktickit/issues/68) | 3 | `18d6a0e` | `79cf0ec` |
| [#81](https://github.com/songt888/toktickit/pull/81) Requester Dashboard API and UI | [#70](https://github.com/songt888/toktickit/issues/70) | 2 | `9422cfd` | `07bc662` |
| [#82](https://github.com/songt888/toktickit/pull/82) Staff and Administrator Dashboard | [#71](https://github.com/songt888/toktickit/issues/71) | 3 | `f507afe` | `0bc02e5` |
| [#83](https://github.com/songt888/toktickit/pull/83) Final regression, E2E, responsive, accessibility and performance | [#72](https://github.com/songt888/toktickit/issues/72) | 8 | `13dceb5` | `0512c04` |
| [#84](https://github.com/songt888/toktickit/pull/84) Documentation, evidence and review record | [#73](https://github.com/songt888/toktickit/issues/73) | 5 | `b10c7dc` | `a4db420` |

## Release into `main`

| PR | Issue | Rounds of changes requested | Approved at | Merge SHA |
|---|---|---|---|---|
| [#85](https://github.com/songt888/toktickit/pull/85) Release Lab 4: `lab4-staging` -> `main` | [#73](https://github.com/songt888/toktickit/issues/73) | 1 | `a4db420` | `991b254` |
| [#86](https://github.com/songt888/toktickit/pull/86) Final-main verification follow-up | [#73](https://github.com/songt888/toktickit/issues/73) | 1 | `d1e5933` | `4673a1a` |

## Author verification (Issue #65)

Executed on 2026-10-05 (Asia/Bangkok) in the isolated contract worktree:

- `python3 scripts/check-lab4-contract.py`: 24 ACs, 44 planned test IDs,
  69 bidirectional mappings and local links valid (exit 0).
- Prisma 5 validation of a temporary schema combining the existing schema,
  proposed models, inverse relations and Ticket fields/index: valid (exit 0).
  Validation used a dummy URL and did not connect to or migrate a database.
- `npm run build` in server: TypeScript build passed (exit 0).
- `npm run build` in client: TypeScript/Vite build passed (exit 0).
- `git diff --check`: passed (exit 0); repeat before each commit.
- Source comparison: all mandatory handout sections and Answer Parts 1-9 mapped
  in tests.md; API/UI/model/status/gate/metric naming reviewed against the current
  Lab 3 code. New runner/filter capabilities are explicitly marked as increments.

Original workspace hashes were verified unchanged (including separate
Playwright edits and the existing PDF deletion); the staged diff contained
only nine scoped contract/workflow/checker files. Initial contract commit:
`f67233e`. No Lab 4 feature tests, migration, SQL triggers or runtime
gate/metrics have been executed; their matrix stays Planned. Builds validate
the unchanged application baseline, not the proposed feature implementation.

This block is the Issue #65 record exactly as it stood at `0512c04` (2026-10-05); "Planned" and "proposed" describe
that date, and the results since then are in [tests.md](tests.md).

## Reviews received and responses

Each row is one formal review. "Response" is the change made before the next reviewed commit.

### #74 contract

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `36041aa` | The PDF/`.gitignore` change does not belong in a contract PR; `api-spec.md` limited paging to `page=1`; `reviewer.md` did not log my review of partner PR #81. | Reverted the PDF commit (untracking moved to #75); `page` became an integer >= 1; logged the #81 review. | CHANGES_REQUESTED |
| `5fd3b76` | Record #81's merge SHA and remove stale "no teammate review" lines. | Recorded `3c51c16` and updated the review status. | CHANGES_REQUESTED |
| `7f793c2` | SHA and review status correct. | | APPROVED |

### #75 PDF untracking

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `16a25f5` | PR targeted `main` instead of `lab4-staging`; no Issue linked. | Retargeted to `lab4-staging`; created and linked chore Issue #76. | CHANGES_REQUESTED |
| `16a25f5` | Retarget and Issue confirmed. | | APPROVED |

### #77 data foundation

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `7b8422c` | Fixed seed dates kept `recentlyResolved` at zero; an Action stamp predated its status event (BR-13); MIG ids not in `tests.md`; no populated Lab 3 upgrade/restore test (DB-02); an em dash in `schema.prisma`. | Seed made relative to now; Action stamps follow the status path; tests mapped to DB-01/02/03; populated upgrade and restore test added. | CHANGES_REQUESTED |
| `da6fdb0` | Seed dates went stale on a reused database; restore checked an untouched template and no file manifest; PR body and `tests.md` stale. | Seed key and rolling window check; restore verified against a real copy with a file manifest; docs updated. | CHANGES_REQUESTED |
| `d220554` | The file manifest read the shared `server/uploads`, which another test edits in parallel. | Attachment files written to a private temp directory and hashed with a size check. | CHANGES_REQUESTED |
| `5689123` | Fixed. | | APPROVED |

### #78 Actions Taken API

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `b9973c2` | `tests.md` marked rows Pass without coverage: API-10 replay of assignee/status, API-09 rollback, API-05/06 history DELETE/PATCH and page size 50; a CONC-02 race that could not fail. | Added the missing replay, rollback and history tests and a real deactivation race. | CHANGES_REQUESTED |
| `2cb41b6` | Nothing proved the stubbed create ran; the assign race never really raced; the start race was missing. | Stub became a spy asserted once; Action created before the race; start race added. | CHANGES_REQUESTED (posted twice) |
| `b2eec02` | API-09 and CONC-02 races good. | | APPROVED |

### #79 Ticket workflow and resolution gate

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `c9cf216` | A race accepted a 500 loser; CONC-01 lacked the barrier and priority/status races it claimed; UI-03 claimed a confirmation test; readiness summary missing; select stayed on a disabled RESOLVED after a gate 409. | Loser asserted as 409 STALE_STATE; barrier-controlled races added; confirmation test; readiness summary with counts; select reset after 409. | CHANGES_REQUESTED |
| `cae2076` | Approved, with non-blocking notes: hide "Ready to resolve." when RESOLVED is not a next move, add `role="group"`, update PR body counts. | No further commit: `cae2076` is the merged head, so the code notes were not applied in PR #79. The "Ready to resolve." note and `role="group"` are fixed in PR #84 (`StaffTicketDetail.tsx`). | APPROVED |

### #80 Actions Taken UI

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `5a0a008` | Edit after Load Latest reverted another user's change; a late refresh rolled `updatedAt` back; the stale-response test passed with the guard deleted; E2E-01 claimed Reassign/Edit it never ran; missing required markers. | Compare against the opened Action; refresh sequence; a guard test that fails without the guard; Reassign and Edit added to E2E; required markers. | CHANGES_REQUESTED |
| `40c903d` | Ticket save/comment/note did not bump the refresh sequence; PR body counts. | Bumped the sequence on those paths; counts updated. | CHANGES_REQUESTED |
| `c0ba040` | Dropping the refresh also dropped the new resolution gate; Internal Note bump untested. | Refresh restarted after the bump; Internal Note case added using `act()`. | CHANGES_REQUESTED |
| `18d6a0e` | Restart only when a refresh is in flight; all three paths tested. | | APPROVED |

### #81 Requester Dashboard

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `a16c2fc` | Back from a Dashboard drill-down went to My Tickets; a bound test could not fail at limit 5; AUTH-01 and UI-07 cited missing tests; E2E shared a seeded Requester across workers and skipped View all. | Back returns to the Dashboard; bound test uses fewer Tickets; AUTH-01 and UI-07 tests added; fresh Requester per E2E run with View all. | CHANGES_REQUESTED |
| `9422cfd` | PR body still described the old E2E. | PR body updated. | CHANGES_REQUESTED |
| `9422cfd` | Fixed. | | APPROVED |

### #82 Staff and Administrator Dashboard

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `49907e8` | My Pending Actions lost its page on Back, and Retry reloaded page 1; E2E-03 clicked 5 of 12 buckets; API-12 snapshot claim untested; flaky global-count retries. | Page lifted into the shell; every bucket drilled; snapshot-consistency test; waits instead of blind retries. | CHANGES_REQUESTED |
| `c5a0a34` | An empty page after finishing the last Action showed no pager; Staff SQL compare covered only 3 metrics. | Empty page > 1 reloads the last page (tested); all 12 buckets compared with SQL. | CHANGES_REQUESTED |
| `ca98843` | Administrator metrics compared with hard-coded values. | Administrator runs through the same SQL comparison. | CHANGES_REQUESTED |
| `f507afe` | Fixed. | | APPROVED |

### #83 final hardening

| Reviewed commit | Concern | Response (fix commit) | State |
|---|---|---|---|
| `a982ad5` | Ticket Status History area missing in the client; tests that could not fail; `aria-required` and blue focus; PERF in plain `npm test`; `tests.md` overclaims; missing screenshots and checklist. | Added `TicketStatusHistory`, tests that fail without their fix, Zen Green focus, opt-in `npm run test:perf`, corrected docs and screenshots (`c764d20`). | CHANGES_REQUESTED |
| `c764d20` | Status History Retry/paging/401 untested; theme focus and checkboxes still blue; PERF database and plans; stale docs. | Tests and 401 handling, theme fixes, per-run PERF database with EXPLAIN plans (`95f844a`). | CHANGES_REQUESTED |
| `95f844a` | README code fence; CREATEDB note; long-text wrapping spots; grey Dashboard badges; `tests.md` mapping. | Fixed each, with a rendered badge check (`7e5df01`). | CHANGES_REQUESTED |
| `7e5df01` | REG-01 counts; attachment name wrapping; status badges; Dashboard priority badge; PATCH `performedById`. | One badge per Ticket status and priority in `statusBadge.ts` (the Dashboard IT-priority badge now uses it), wrapping for attachment and author names, a PATCH `performedById` test, client counts 23/128 (`3f6c05f`). | CHANGES_REQUESTED |
| `3f6c05f` | Long names pushed Queue columns off-screen at 1280 px; RESP-01 measured before rows loaded; AUTH-02 `/assignee` case could not fail; CONC-02 had no timeout. | Wrapping and row waits; AUTH-02 with exact `fieldErrors`; 60 s timeout; root cause of server flakes found and fixed (Supertest bound to 127.0.0.1) (`280ee72`, then a self-check in `92d64ec`). | CHANGES_REQUESTED |
| `92d64ec` | Apply filters cleared the scope before the scoped screenshots; `ui-spec.md` wording; a wrong repeat count. | Scoped view measured before searching; Queue fits at 992 px; wording and count fixed (`aef48ff`). | CHANGES_REQUESTED |
| `aef48ff` | The WAITING row appeared by luck; My Tickets WAITING badge never measured; console-error checklist item open. | Own WAITING/IN_PROGRESS fixtures; shared badge wrap in My Tickets; `guardedTest.ts` console/page-error check (`005dd8e`). | CHANGES_REQUESTED |
| `005dd8e` | The priority raise ran too early, so a foreign row could sort first. | Raise moved to right before the drill-down click (`13dceb5`). | CHANGES_REQUESTED |
| `13dceb5` | Rows on top in all scoped screenshots; docs match. | | APPROVED |

### #84 this documentation PR

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `6909619` | `ai-use.md` My Reflection a placeholder and a local path; formal prompts adding wording never asked, count 8 vs 9; README seeds without a password first; `tests.md` checker note, lost `)`, "Planned" headings; stale text in `specification.md` and `issue-plan.md`; PR #79 "Ready to resolve." unfixed. | My Reflection written; prompts labelled as a summary; README seed carries the password; `tests.md` note, `)` and headings fixed; stale text fixed; "Ready to resolve." fixed in `741c12f` and `bb67a29`. | CHANGES_REQUESTED |
| `bb67a29` | `ai-use.md` merge wording, AC-12 timing, rerun claim, Codex prompts and unquoted prompts; README malee/kittipong cannot sign in and five requesters; `role="group"`, the "To resolve..." hint on CLOSED/CANCELLED and a client test; `reviewer.md` partner responses, #83 transaction finding, Author verification, #95 merged, round 1; stale text in several files; PR body. | `ai-use.md`: merge wording, AC-12 timing and counts fixed, the two Codex prompts added and the prompts quoted; README: five Requesters and the Lab 4 seed now gives the password to the two fixture users still on the placeholder (DB-03j); `StaffTicketDetail.tsx`: `role="group"`, no resolve hint on CLOSED/CANCELLED, client tests; this file: partner responses, the #83 transaction finding, Author verification, #95 merged, round 1 and the `7e5df01` row; stale text fixed in `issue-plan.md`, `specification.md`, `api-spec.md`, `tests.md`; `tests.md` 4.1 rerun on this branch. | CHANGES_REQUESTED |
| `847a465` | My Reflection AI-drafted and missing the spec agent; ai-use "exact" while #2/#8 were excerpt/description, missing outcomes for #1/#3/#6/#7, a local path; ai-use 4.1 SHA disagreed with tests.md; issue-plan future tense; a second DB-03c test id; the `7e5df01` row named author wrapping; the #65 Author verification block dropped. | `ai-use.md` rewritten in the Lab 3 format: prompts labelled as lightly normalized summaries of what was asked (no exact-quote claim, no local path), Codex covered in LLM Used, How I Used AI Critically and My Reflection; SHA `bfc9e87` in `tests.md`; issue-plan tense fixed; new test renamed DB-03j; row corrected; #65 block restored. | CHANGES_REQUESTED |
| `d5e2277` | `tests.md` said only two files change after `bfc9e87` and still named DB-03c; `specification.md` said 4.1 ran at `0512c04`; PR body out of date; the #65 Author verification restored from `f67233e` instead of the `0512c04` version; `role="group"` missing from the #79 row; `ai-use.md` did not say the Thai prompts were translated; a test title said "hides" but checked the shown case. | The `0512c04` block restored as it stood; the 4.1 scope sentence and DB-03j fixed; spec matched to `bfc9e87`; PR body rewritten; `role="group"` added to the #79 row; Thai prompts 2, 5, 6 and 10 marked translated; test title corrected. | CHANGES_REQUESTED |
| `25008b6` (the review says it checked `fa95675`; only docs changed in between) | The 4.1 scope sentence and PR body said one test name changed after `bfc9e87`, but two did (the DB-03j rename and a `TicketWorkflow.test.tsx` title); a missing period in `specification.md` before "AC-23/AC-24". Optional: return the partner section to its `6909619` form. | Both test titles listed with their commits in `tests.md` and the PR body; period added. The optional change was not taken: round 2 asked for the partner responses and verification notes in that section. | CHANGES_REQUESTED |
| `b10c7dc` | Both test titles listed, spec period fixed, docs match. | Merged by stickkersz as `a4db420`. | APPROVED |

GitHub shows the `847a465` review submitted before the `bb67a29` one (each review keeps the commit it was
started on); the rows are in the order of the rounds they answer.

### #85 release into `main`

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `a4db420` | The PR body's "Files outside the feature folders" missed about 35 files (README, the contract checker, Lab 1-3 client and E2E test edits, Prisma schema and seed, server test setup/harness/cleanup, Lab 2/3 server test edits); the 10 PRs, merge SHAs and tree `b10c7dc` checked out. | Body now lists all 42 files outside the Lab 4 folders and app source, with the PRs that changed each; a recheck then corrected four of the stated reasons. No code change. | CHANGES_REQUESTED |
| `a4db420` | Body lists all 42 files; 10 PRs and merge SHAs match; tree is `b10c7dc`. | Merged by stickkersz as `991b254`. | APPROVED |

## Reviews performed for partner

All on [stickkersz/toktickit](https://github.com/stickkersz/toktickit), posted from the songt888
account after I read and agreed with each comment. I read the code and the diff and checked every fix
commit against my own comment; in most reviews I say that I did not rerun the suites and relied on the
counts in the PR (see "How I verified partner fixes" below).

| PR | Reviewed commit | My finding | Partner response | My recheck and outcome |
|---|---|---|---|---|
| [#81](https://github.com/stickkersz/toktickit/pull/81) Contract | `07e50fc` | Idempotency-Key had no stored request fingerprint, so key reuse with a different body (BR-39, AC-40) could not be detected; no Cancel from `WAITING_FOR_REQUESTER`/`REOPENED`. | Fixed in `42424fe`: `requestHash` next to the key, both Cancel transitions with BR-15 auto-cancel, and my three non-blocking notes. | Rechecked `42424fe`; APPROVED (one typo noted); merged as `3c51c16`. |
| [#82](https://github.com/stickkersz/toktickit/pull/82) Migration and seed | `ac94060` | Approved: additive migration, down script compared against the whole schema, idempotent seed. Non-blocking: explicit timeout on the seed transactions; seeded Actions do not touch `updatedAt`; README still says Staff land on the Queue. | No comment posted. | APPROVED; merged as `2cdb754`. |
| [#83](https://github.com/stickkersz/toktickit/pull/83) Actions Taken API | `a1135dc` | Two blocking points: `responsibleStaffId` accepted ids above the 32-bit range (500 instead of 400); and on create the Responsible Staff check ran before the transaction, so a user deactivated in between was still recorded (BR-07; PATCH already checked inside the lock). Non-blocking: a lone `followUpNote` with follow-up off bumped the version. | Fixed in `e7e9619`: `isValidId` cap, the check moved inside the Ticket lock with the user row `FOR SHARE`, the lone note is a 400; the same cap swept over the Lab 2/3 ids. | Rechecked `e7e9619`; APPROVED, with a non-blocking request for a `page=2147483647` test; merged as `a6a1dd5`. |
| [#84](https://github.com/stickkersz/toktickit/pull/84) Actions Taken UI | `0ca1cdb` | Focus lost after a successful Complete or Cancel (the buttons are gone, so focus fell to the body); test needed. Non-blocking: the Lab 3 screenshots no longer match. | Fixed in `f311509`: focus goes to the Action row, plus the same gap on `ACTION_FINAL`, `TICKET_NOT_WORKABLE`, Keep editing and Use my changes, each with a test. | Rechecked `f311509`; APPROVED; merged as `2e86ba0`. |
| [#85](https://github.com/stickkersz/toktickit/pull/85) Workflow and gate | `6b46e3a` | The Resolve pre-check and Cancel confirmation used a stale resolution gate that Action writes never refreshed; E2E hid it with `page.reload()`. Non-blocking: "Status updated." claimed another person's move. | Fixed in `e77929f` (`fac29d8` is an empty commit because GitHub missed the first push): gate re-read after every Action write, reloads removed, neutral "already ..." wording. | Rechecked `fac29d8`; APPROVED; merged as `4a5f227`. |
| [#86](https://github.com/stickkersz/toktickit/pull/86) Dashboard APIs | `7208908` | Two Requester comments on one Ticket held `FOR SHARE` and both waited to update it, so PostgreSQL deadlocked and one comment was lost with a 500; asked for `FOR NO KEY UPDATE` plus a concurrency test. Non-blocking: Attachment delete and `updatedAt` not in one transaction. | Fixed in `3b2a2e9`: `FOR NO KEY UPDATE`, a two-at-once test, Attachment removal in one transaction, and the Staff comment touch in one transaction. | Rechecked `3b2a2e9`; APPROVED; merged as `62c258b`. |
| [#87](https://github.com/stickkersz/toktickit/pull/87) Dashboard screens | `f99a0e2` | Screens matched ui-spec sections 3 to 6. Nit: "Updated in the last 1 days". | No comment posted. | APPROVED; merged as `980d1e0`. |
| [#88](https://github.com/stickkersz/toktickit/pull/88) Final hardening | `a862ba8` | BR-34 comment block kept its old indentation after moving into `write`; removing the "files" clauses from BR-39/AC-40/api-spec/ADR 0003 was not recorded as a deliberate contract change. | Fixed in `8b60230`: re-indented, and the correction recorded in spec section 11. | Rechecked `8b60230`; APPROVED; merged as `83d202d`. |
| [#89](https://github.com/stickkersz/toktickit/pull/89) E2E/responsive/a11y/performance | `a620696` | "Go to Actions Taken" always called `preventDefault()`, so Ctrl/Cmd-click could not open a new tab; the E2E-09 row did not name `e2e/lab-04/console.ts`. | Fixed in `f7fb755`: only a plain left click is cancelled, tested with each modifier; the row names `console.ts`. | Rechecked `f7fb755`; APPROVED; merged as `7b8cfe9`. |
| [#90](https://github.com/stickkersz/toktickit/pull/90) Pre-release findings | `f948e49` | After a mid-session 403 on the Dashboard, the "Go to your home screen" link used the stale cached role and pointed back at the refusing page; two tidy-ups. | Fixed in `2594bbf`: the identity is re-read on a 403; no link when the role is unchanged; two tests; tidy-ups done. | Rechecked `2594bbf`; APPROVED; merged as `ae77728`. |
| [#91](https://github.com/stickkersz/toktickit/pull/91) reviewer.md and ai-use.md | `6b6bd7d` | My #83 row listed one round where there were two; the reflection counted one reopened decision where it recorded two. | Fixed in `9d009b7`: both rounds listed, count changed to two. | Rechecked `9d009b7`; APPROVED; merged as `874a224`. |
| [#92](https://github.com/stickkersz/toktickit/pull/92) Release to main | `874a224` | The PR body's Lab 1-3/Lab 4 server split (334 + 111) disagreed with `tests.md` REG-01 (333) by one. | Recounted from a real run; the Lab 2 Ticket Date test added in Issue 10 explains the one; fixed in `tests.md` through #93. | Rechecked `68d4a2a`; APPROVED; merged as `f40da3a`. |
| [#93](https://github.com/stickkersz/toktickit/pull/93) REG-01 count | `73912e7` | 333 to 334 after the added Lab 2 test is right. | No comment posted. | APPROVED; merged as `68d4a2a`. |
| [#94](https://github.com/stickkersz/toktickit/pull/94) Final main verification | `07f6b12` | SHAs and the 334 + 111 split checked. | No comment posted. | APPROVED; merged as `45d2a25`. |
| [#96](https://github.com/stickkersz/toktickit/pull/96) Final screen pass | `e72c227` | `ChangePassword.tsx` did not fully reset after success, leaving field errors under the success banner; the UI-20 row did not say what its test checks. | Fixed in `b2c17ba`: full reset, a test that fails without it, UI-20 row corrected. | Rechecked `b2c17ba`; APPROVED; merged as `4d2a481`. |
| [#95](https://github.com/stickkersz/toktickit/pull/95) Final audit | `4933bd0`, `5af3a6f`, `0d71f75` | Round 1: my #83 row out of date, #96 missing, client count 341 vs 345, comment placement. Round 2: the #83 fix-commit list counted `92d64ec`, a QA commit, as an answer. Round 3: #83 had merged, so the row was stale again. | Fixed in `5af3a6f`, `0d71f75` and `e7a3813`. | Rechecked `e7a3813`; APPROVED; merged as `7e8e56e` (2026-11-01). |

### How I verified partner fixes

- Every row above was checked against the GitHub review, comment and merge data for that PR (reviewed commit, state, merge SHA).
- For each fix I read the new commit against the comment I had made. Most of my reviews say "I did not rerun the suites" and rely on the counts the author reported in the PR; I did not rerun them.
- Where I recorded a deliberate decision rather than a defect (the "files" clause in #88, the status matrix in #81), I checked that the contract text and the PR body agree.

## Final-main follow-up for #73

- The full final-main run on `991b254` is in [tests.md](tests.md) section 4.2, with logs under
  `artifacts/lab-04/verification-2026-11-01/`. It was recorded through follow-up PR
  [#86](https://github.com/songt888/toktickit/pull/86) into `main`, approved by stickkersz at
  `d1e5933` and merged as `4673a1a`; only then was #73 closed and its card set to Done.

### #86 final-main follow-up

| Reviewed commit | Concern | Response | State |
|---|---|---|---|
| `057a891` | The 01 to 12 `.log` files were not in the PR: `.gitignore` `*.log` skipped them, only the README and `03-seed-counts.txt` were committed; `ai-use.md` should say the report PDF script came from a separate request, since #73 allows no PDF work otherwise. SHAs, rounds, counts and the `b10c7dc` tree checked out. | All 13 logs force-added as in Lab 3; `ai-use.md` says the PDF was a separate request outside #73. | CHANGES_REQUESTED |
| `d1e5933` | All 13 logs in the folder (SHA `991b254`, exit 0, counts match); ai-use PDF line fixed; reviewer.md and PR body updated. | Merged by stickkersz as `4673a1a`; #73 then closed and set to Done. | APPROVED |

## Review and release checklist

- [x] Every Lab 4 feature PR formally APPROVED by stickkersz before merge (#74, #75, #77 to #83).
- [x] Each Issue #65 to #72 closed and its card set to Done only after its PR merged.
- [x] Reviews performed for the partner recorded with real commits and outcomes.
- [x] #73 documentation PR #84 approved at `b10c7dc` and merged into `lab4-staging` as `a4db420`.
- [x] Release PR #85 into `main` separately reviewed (approved at `a4db420`) and merged as `991b254`.
- [x] Final-main verification follow-up PR #86 approved at `d1e5933` and merged as `4673a1a` before #73 was closed and set to Done.

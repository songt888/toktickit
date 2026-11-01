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
| [#78](https://github.com/songt888/toktickit/pull/78) Actions Taken API, authorization and lifecycle | [#67](https://github.com/songt888/toktickit/issues/67) | 2 | `b2eec02` | `5bc23ad` |
| [#79](https://github.com/songt888/toktickit/pull/79) Ticket workflow and resolution gate | [#69](https://github.com/songt888/toktickit/issues/69) | 1 | `cae2076` | `0457a58` |
| [#80](https://github.com/songt888/toktickit/pull/80) Actions Taken UI and Requester read-only view | [#68](https://github.com/songt888/toktickit/issues/68) | 3 | `18d6a0e` | `79cf0ec` |
| [#81](https://github.com/songt888/toktickit/pull/81) Requester Dashboard API and UI | [#70](https://github.com/songt888/toktickit/issues/70) | 2 | `9422cfd` | `07bc662` |
| [#82](https://github.com/songt888/toktickit/pull/82) Staff and Administrator Dashboard | [#71](https://github.com/songt888/toktickit/issues/71) | 3 | `f507afe` | `0bc02e5` |
| [#83](https://github.com/songt888/toktickit/pull/83) Final regression, E2E, responsive, accessibility and performance | [#72](https://github.com/songt888/toktickit/issues/72) | 8 | `13dceb5` | `0512c04` |

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
| `cae2076` | Approved, with non-blocking notes: hide "Ready to resolve." when RESOLVED is not a next move, add `role="group"`, update PR body counts. | No further commit: `cae2076` is the merged head, so the code notes were not applied in this PR. | APPROVED |

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
| `7e5df01` | REG-01 counts; attachment and author wrapping; status badges; Dashboard priority badge; PATCH `performedById`. | Shared `statusBadge.ts`, wrapping, PATCH test (`3f6c05f`). | CHANGES_REQUESTED |
| `3f6c05f` | Long names pushed Queue columns off-screen at 1280 px; RESP-01 measured before rows loaded; AUTH-02 `/assignee` case could not fail; CONC-02 had no timeout. | Wrapping and row waits; AUTH-02 with exact `fieldErrors`; 60 s timeout; root cause of server flakes found and fixed (Supertest bound to 127.0.0.1) (`280ee72`, then a self-check in `92d64ec`). | CHANGES_REQUESTED |
| `92d64ec` | Apply filters cleared the scope before the scoped screenshots; `ui-spec.md` wording; a wrong repeat count. | Scoped view measured before searching; Queue fits at 992 px; wording and count fixed (`aef48ff`). | CHANGES_REQUESTED |
| `aef48ff` | The WAITING row appeared by luck; My Tickets WAITING badge never measured; console-error checklist item open. | Own WAITING/IN_PROGRESS fixtures; shared badge wrap in My Tickets; `guardedTest.ts` console/page-error check (`005dd8e`). | CHANGES_REQUESTED |
| `005dd8e` | The priority raise ran too early, so a foreign row could sort first. | Raise moved to right before the drill-down click (`13dceb5`). | CHANGES_REQUESTED |
| `13dceb5` | Rows on top in all scoped screenshots; docs match. | | APPROVED |

## Reviews performed for partner

All on [stickkersz/toktickit](https://github.com/stickkersz/toktickit), posted from the songt888
account after I read and agreed with each comment.

| PR | Reviewed commit | Finding | Outcome |
|---|---|---|---|
| [#81](https://github.com/stickkersz/toktickit/pull/81) Contract | `07e50fc` | Idempotency-Key had no stored request fingerprint, so key reuse with a different body (BR-39, AC-40) could not be detected; no Cancel from `WAITING_FOR_REQUESTER`/`REOPENED`. | CHANGES_REQUESTED, then APPROVED at `42424fe`; merged as `3c51c16` |
| [#82](https://github.com/stickkersz/toktickit/pull/82) Migration and seed | `ac94060` | Additive migration, down script verified against the whole schema, idempotent seed. | APPROVED; merged as `2cdb754` |
| [#83](https://github.com/stickkersz/toktickit/pull/83) Actions Taken API | `a1135dc` | `responsibleStaffId` accepted ids above the 32-bit range (500 instead of 400). | CHANGES_REQUESTED, then APPROVED at `e7e9619`; merged as `a6a1dd5` |
| [#84](https://github.com/stickkersz/toktickit/pull/84) Actions Taken UI | `0ca1cdb` | Focus lost after a successful Complete or Cancel. | CHANGES_REQUESTED, then APPROVED at `f311509`; merged as `2e86ba0` |
| [#85](https://github.com/stickkersz/toktickit/pull/85) Workflow and gate | `6b46e3a` | Resolve pre-check and Cancel confirmation used a stale resolution gate. | CHANGES_REQUESTED, then APPROVED at `fac29d8`; merged as `4a5f227` |
| [#86](https://github.com/stickkersz/toktickit/pull/86) Dashboard APIs | `7208908` | Two Requester comments on one Ticket held `FOR SHARE` and both waited to update it, so PostgreSQL deadlocked and one comment was lost with a 500; asked for `FOR NO KEY UPDATE` plus a concurrency test. | CHANGES_REQUESTED, then APPROVED at `3b2a2e9`; merged as `62c258b` |
| [#87](https://github.com/stickkersz/toktickit/pull/87) Dashboard screens | `f99a0e2` | Screens matched ui-spec sections 3 to 6. | APPROVED; merged as `980d1e0` |
| [#88](https://github.com/stickkersz/toktickit/pull/88) Final hardening | `a862ba8` | BR-34 comment block kept its old indentation after moving into `write`; removing the "files" clauses from BR-39/AC-40/api-spec/ADR 0003 was not recorded as a deliberate contract change. | CHANGES_REQUESTED, then APPROVED at `8b60230`; merged as `83d202d` |
| [#89](https://github.com/stickkersz/toktickit/pull/89) E2E/responsive/a11y/performance | `a620696` | "Go to Actions Taken" always called `preventDefault()`, so Ctrl/Cmd-click could not open a new tab; the E2E-09 row did not name `e2e/lab-04/console.ts`. | CHANGES_REQUESTED, then APPROVED at `f7fb755`; merged as `7b8cfe9` |
| [#90](https://github.com/stickkersz/toktickit/pull/90) Pre-release findings | `f948e49` | After a mid-session 403 on the Dashboard, the "Go to your home screen" link used the stale cached role and pointed back at the refusing page; two tidy-ups. | CHANGES_REQUESTED, then APPROVED at `2594bbf`; merged as `ae77728` |
| [#91](https://github.com/stickkersz/toktickit/pull/91) reviewer.md and ai-use.md | `6b6bd7d` | One PR row missed a round and SHA; decision count wrong. | CHANGES_REQUESTED, then APPROVED at `9d009b7`; merged as `874a224` |
| [#92](https://github.com/stickkersz/toktickit/pull/92) Release to main | `874a224` | The PR body's Lab 1-3/Lab 4 server split (334 + 111) disagreed with `tests.md` REG-01 (333) by one. | CHANGES_REQUESTED, then APPROVED at `68d4a2a`; merged as `f40da3a` |
| [#93](https://github.com/stickkersz/toktickit/pull/93) REG-01 count | `73912e7` | 333 to 334 after the added Lab 2 test is right. | APPROVED; merged as `68d4a2a` |
| [#94](https://github.com/stickkersz/toktickit/pull/94) Final main verification | `07f6b12` | SHAs and the 334 + 111 split checked. | APPROVED; merged as `45d2a25` |
| [#96](https://github.com/stickkersz/toktickit/pull/96) Final screen pass | `e72c227` | `ChangePassword.tsx` did not fully reset after success. | CHANGES_REQUESTED, then APPROVED at `b2c17ba`; merged as `4d2a481` |
| [#95](https://github.com/stickkersz/toktickit/pull/95) Final audit | `4933bd0`, `5af3a6f`, `0d71f75` | Code fix accepted; `reviewer.md` rows for my #83 and #96 out of date, client count after #96, comment placement; then the #83 fix-commit list; then the #83 row after it merged. | CHANGES_REQUESTED three times; still open on 2026-11-01 |

## Pending for #73

- This documentation PR into `lab4-staging`: review pending.
- Release PR `lab4-staging` -> `main`: not yet opened.
- Final-main verification follow-up PR: not yet opened.

## Review and release checklist

- [x] Every Lab 4 feature PR formally APPROVED by stickkersz before merge (#74, #75, #77 to #83).
- [x] Each Issue #65 to #72 closed and its card set to Done only after its PR merged.
- [x] Reviews performed for the partner recorded with real commits and outcomes.
- [ ] This #73 documentation PR approved and merged into `lab4-staging`.
- [ ] Release PR into `main` separately reviewed and merged.
- [ ] Final-main verification follow-up reviewed and merged before #73 is Done.

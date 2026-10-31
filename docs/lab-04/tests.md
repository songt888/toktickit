# Lab 4 Test DD and Traceability Plan

Status: rows marked **Pass** ran green with `npm test` in `server` (DB rows in Issue #66, Action
rows in Issue #67, workflow rows in Issue #69; UI rows with `npm test` in `client`, Action UI rows in Issue #68, Requester Dashboard rows in Issue #70; E2E rows with `npm run test:e2e` at the root); **Partial** rows say what is still owed; every other row stays **Planned**.
Do not copy Lab 3 totals or claim unimplemented test paths already exist.
The specification's AC table and this matrix must agree in both directions.

## 1. Strategy and fixtures

Unit: independent Action/Ticket transition pairs, field/date/follow-up rules,
resolution truth table and time bounds. PostgreSQL integration: authorization,
FKs/checks/triggers, transactional writes, replay, parent locks, deactivation
races, populated migration and recovery. UI: role controls, field validation,
draft/confirmation/version/async handling and exact drill-down objects. E2E:
real authenticated Requester/Staff/Admin work, responsive/keyboard and prior
feature regression. Performance-smoke: independent queries and bounded DTOs.

Use separate disposable databases/schemas for migrations, seed, concurrent
writes and E2E; set DATABASE_URL explicitly and capture a sanitized environment
description. Never reset the user's database or share mutable seed identities
between parallel tests. Append-only rows cannot be deleted for test cleanup;
discard the entire isolated fixture database/schema after its test run.

Fixtures: at least two Requesters, two active Staff, an Admin and inactive Staff;
one Ticket per each of eight statuses; all priorities and ownership states;
zero/one/multiple Actions, differing performer/assignee, pending/completed/
cancelled work, completed follow-up; ties in timestamps; legacy unknown
resolution dates; distinct empty-user cases. Freeze clocks at the seven-day
lower bound, asOf and one millisecond on either side. Compare expected metrics
with independent SQL, not with the same helper used by the endpoint.

## 2. Planned test matrix

Paths below are real intended repository locations, created in their owning
implementation Issues. All IDs are local to Lab 4; none is an executed result.

| Test ID | Type | AC | What it tests / expected result | Automated test file | Final |
|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-02 | Length/date/offset/protected-field/follow-up boundaries; literal text accepted, invalid input rejected | `server/tests/lab-04/action-validation.test.ts` | Pass |
| UNIT-02 | Unit | AC-04 | Hard-coded Action transition pairs and terminal edit/cancel/completion rules | `server/tests/lab-04/action-status-transition.test.ts` | Pass |
| UNIT-03 | Unit | AC-08 | All 64 Ticket pairs against independent expected pairs and confirmations | `server/tests/lab-04/status-transition.test.ts` | Pass |
| UNIT-04 | Unit | AC-09 | Gate truth table: zero, all-cancelled, pending, follow-up, mixed completed/cancelled, advisory independence | `server/tests/lab-04/resolution-gate.test.ts` | Pass |
| UNIT-05 | Unit | AC-14 | Inclusive UTC rolling bounds, Bangkok display conversion, null legacy resolution time | `server/tests/lab-04/dashboard-dates.test.ts` | Pass (#72) |
| API-01 | API | AC-01 | Staff/Admin create: Ticket/session performer/default or chosen eligible assignee, PLANNED, owner unchanged, initial revision | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-02 | API | AC-02 | Full create/merged-patch field validation, no write on error, Unicode/literal text and date boundaries | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-03 | API | AC-03 | Default/valid/reassigned eligible users; inactive/Requester/null rejection; deactivated historical identity readable | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-04 | API | AC-04 | Start/complete/cancel, required result/reason/confirm, no-op and invalid pairs, resolved/closed/cancelled parent lock | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-05 | API | AC-05 | Descriptive/completed follow-up corrections append exactly one snapshot; no cancelled edits or history DELETE/PATCH | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-06 | API | AC-07 | Equal action/event dates, revisions, paging/counts and max page sizes have deterministic order | `server/tests/lab-04/action-history.api.test.ts` | Pass |
| API-07 | API | AC-08 | Direct status calls for allowed/forbidden pairs and confirmations; one event only on success | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-08 | API | AC-09, AC-12 | Direct backend gate, advisory isolation, legacy resolved/closed grandfathering and reopened zero-Action gate | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass |
| API-09 | API | AC-10 | Stale Action/Ticket versions, monotonic timestamps and injected failure rollback preserve projection/revision/event consistency | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| API-10 | API | AC-11 | Lost-response replay of create/edit/assignment/status; exact stored result; payload/route mismatch safe 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass |
| AUTH-01 | Authorization | AC-06, AC-21 | Missing/password-gated/inactive sessions; owning Requester reads all shared work, own write 403, cross-owner 404, no secret/private fields | `server/tests/lab-04/authorization.api.test.ts` | Pass |
| AUTH-02 | Authorization | AC-14, AC-15, AC-21 | Requester scope forgery rejected, Staff/Admin-only Dashboard/myActions; session-derived assignment and ownership | `server/tests/lab-04/authorization.api.test.ts` | Pass (#72): forged requesterId/userId/ownerId/assigneeId/performedById rejected or ignored; Staff endpoints 403 for Requesters |
| CONC-01 | Concurrency | AC-10 | Barrier-controlled Action-create/edit/follow-up vs Resolve and competing owner/priority/status/advisory writes; one valid serialized outcome, no partial commits | `server/tests/lab-04/concurrency.api.test.ts` | Pass |
| CONC-02 | Concurrency | AC-03 | User deactivate/demote races create/reassign/start/complete; locks/rechecks prevent invalid fresh assignment or authorization | `server/tests/lab-04/concurrency.api.test.ts` | Pass |
| CONC-03 | Concurrency | AC-11 | Concurrent same mutationId exactly once; cross-Ticket same actor/id reuse cannot commit two commands | `server/tests/lab-04/concurrency.api.test.ts` | Pass |
| DB-01 | Integration | AC-05 | FKs, checks, unique versions/mutation ids, identity guards, projection-without-matching-revision commit rejection and SQL UPDATE/DELETE history rejection | `server/tests/lab-04/data-foundation.test.ts` | Pass |
| DB-02 | Migration/recovery | AC-12 | Isolated populated Lab 3 upgrade, old row/file/hash/timestamp/sequence preservation, no invented backfill, backup restore and forward repair | `server/tests/lab-04/migration-preservation.test.ts` | Pass |
| DB-03 | Seed | AC-13 | Required status/priority/ownership/Action/empty fixtures, two reruns, unchanged real credentials/work/timestamps and no duplicate histories | `server/tests/lab-04/seed.test.ts` | Pass |
| API-11 | API | AC-14 | Independent owned counts and bounded recent list at every time boundary/null legacy date, zero snapshot | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-12 | API | AC-15 | Independent Staff/Admin counts, zero buckets, active priority scope, assignee-not-performer myActions, bounded/tied lists and snapshot consistency | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-13 | API | AC-16 | Status groups/all Requester statuses/date bounds/exact count-to-list equality and paginated myActions query | `server/tests/lab-04/dashboard-drilldown.api.test.ts` | Pass |
| UI-01 | UI | AC-02, AC-03, AC-04 | Action field/lifecycle validation, active picker/reference failure, completed corrections/ineligible assignee, conditional note and cancel confirmation | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-02 | UI | AC-06, AC-07 | Read-only Requester full Action/history view, no private fields/write controls, stable paging and focus | `client/tests/lab-04/RequesterActionsTaken.test.tsx` | Pass |
| UI-03 | UI | AC-08, AC-09, AC-18 | Permitted Ticket states, gate explanation, advisory independence, fresh status/confirmation and 409 review | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass |
| UI-04 | UI | AC-10, AC-11, AC-18 | Double-click/ambiguous retry UUIDs, replay refresh, updated versions, 400/409/network/500 retained drafts, safe refresh and stale response guards | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass |
| UI-05 | UI | AC-16, AC-17 | Requester cards, zero/loading/failure/forbidden, exact filter callbacks/date bounds, independent stale-response handling | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pass |
| UI-06 | UI | AC-16, AC-17 | Staff/Admin counts/captions/pending Actions and paging, exact Queue/Detail callbacks, zero/error/old snapshot states | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| UI-07 | UI | AC-17, AC-18 | Dashboard initial destination/nav/identity/password gate, prior screens, logout draft/data cleanup and stale cross-user response prevention | `client/tests/lab-04/ApplicationShell.test.tsx` | Pass: Dashboard first page, navigation and earlier screens for all three roles (#70, #71); logout clears a Create Ticket draft and a late response for the previous user is dropped (#72) |
| STYLE-01 | UI style | AC-19, AC-20 | Zen Green tokens, semantic form/metric labels, required/error/status cues, editable/read-only/private distinction | `client/tests/lab-04/ui-style.test.tsx` | Pass (#72): tokens in `client/src/theme.css`, text labels for status/priority/owner/metrics, `aria-required` on required Action fields |
| RESP-01 | Responsive | AC-19 | All Dashboard/Action list/create/edit/history/workflow/myActions views at 1280/820/390px; measure overflow and inspect clipping/overlap | `e2e/lab-04/responsive.spec.ts` | Pass (#72): 11 screens x 3 widths, page overflow and controls cut off at the edge both fail the run; screenshots in `artifacts/lab-04/screenshots/responsive/` |
| A11Y-01 | Accessibility | AC-20 | Keyboard activation, labels/focus/skip/active-nav/error announcements, cancel dialog trap/return focus | `e2e/lab-04/accessibility.spec.ts` | Pass (#72): keyboard-only path through Dashboard, Queue, Detail, Action form, cancel panel, history and My Pending Actions. The cancel panel is inline, not a modal: focus moves into it on open and returns to the same Action on Discard |
| E2E-01 | E2E | AC-01, AC-03, AC-04, AC-05, AC-06 | Different Staff Actions on one Ticket, assign/edit/start/complete/cancel/history and Requester visibility/isolation | `e2e/lab-04/actions-taken-flow.spec.ts` | Pass |
| E2E-02 | E2E | AC-07, AC-08, AC-09 | Record ordered work, failed gate, settled follow-up, resolve/close/reopen/cancel and shared history | `e2e/lab-04/ticket-resolution.spec.ts` | Pass (#72): plus a deactivated-assignee case (flagged, work disabled, server 400) |
| E2E-03 | E2E | AC-14, AC-15, AC-16, AC-17 | Three roles' owned/operational metrics, myActions, zero/failure states, every card/list drill-down and matching DB queries | `e2e/lab-04/dashboards.spec.ts` | Pass: all three roles' metrics vs database (Staff: all cards and all 12 buckets); every card, bucket and View all drill-down; Open Detail/Open Action and isolation (#70, #71); injected 500 shows the error with Retry and a failed refresh keeps older data for both Dashboards (#72) |
| REG-01 | Regression | AC-21 | Run all existing Lab 1-3 server/client checks plus preserved root E2E projects; independently assert critical security/business behavior | Existing `server/tests/lab-01/`, `server/tests/lab-02/`, `server/tests/lab-03/`, `client/tests/lab-01/`, `client/tests/lab-02/`, `client/tests/lab-03/`, `e2e/lab-02/`, `e2e/lab-03/` | Pass (#72): server 44 files/183 tests, client 22 files/118 tests (Lab 1 client test re-enabled), Playwright 26 tests in 14 files, each run twice plus once with `--workers=1` |
| E2E-04 | E2E regression | AC-21 | Auth/password/logout, tickets/attachments/comments, queue/owner/priority/notes and Admin safety all remain functional | `e2e/lab-04/regression.spec.ts` | Pass (#72) |
| PERF-01 | Performance-smoke | AC-22 | 10,000 Tickets/30,000 Actions, <=12 data SQL statements/request, no N+1, <=32KiB body, warm 5-run median<=1s and max<=2s | `server/tests/lab-04/dashboard-performance.test.ts` | Pass (#72): conditions and results in `artifacts/lab-04/performance/perf-01.md` |
| DOC-01 | Document/workflow | AC-23, AC-24 | Bidirectional traceability/local links, rubric/design/API/UI/schema decisions, honest prompts/reviews, actual approval/release state | `scripts/check-lab4-contract.py`; manual source/GitHub review | Planned |
| RELEASE-01 | Release | AC-24 | Reviewed staging/main integration and full final-main suites/builds/migration/seed/E2E with exact SHA/logs, no required skips | Commands/evidence in section 4 | Planned |

Performance conditions: local Node/PostgreSQL versions, machine resources,
connection configuration, dataset and query plans are recorded with sanitized
logs. One untimed warm-up then five sequential timed requests per role,
no artificial sleeps and no background load. Budget is a smoke check, not a
production SLA; investigate failures rather than silently raising thresholds.

## 3. Runner integration and implementation ownership

#66: DB-01/02/03; #67: unit/API/auth/concurrency Action tests; #68: Action UI;
#69: gate/workflow/history tests; #70: Requester metrics/list/UI;
#71: Staff/Admin metrics/myActions/list/UI; #72: complete integration/regression,
style/responsive/accessibility/performance; #73: reviewed release/evidence.
Complete dependencies in [issue-plan.md](issue-plan.md) before each issue.

Server Vitest currently includes `tests/**/*.test.ts`. Client Vite test include
currently names only Labs 2/3: in the first client implementation add Lab 4
and restore Lab 1 inclusion so REG-01 genuinely runs all suites. Root Playwright
projects currently match Labs 2/3 specifically: #72 adds lab4-desktop/tablet/
mobile coverage for new spec files, preserving existing projects and avoiding
duplicate desktop scenarios. Verify `--list` and logged per-file counts; do
not assume a passing command includes files it never selected. No runner
changes are made by the contract PR.

As built in #72: Lab 4 specs run once in `lab4-desktop` and set 1280/820/390 px
widths inside the spec (RESP-01, E2E-01), so no scenario runs three times.
The Lab 2/3 responsive projects now match only their own responsive specs.

## 4. Planned verification commands and evidence

For this documentation PR, run `python3 scripts/check-lab4-contract.py`,
`git diff --check`, validate a temporary schema assembled from the proposed
models/inverse relations and existing Prisma schema, and run existing server
and client production builds in the isolated checkout. These checks do not
execute or certify any Lab 4 feature test. Record actual results in reviewer.md.

For implementation/final release, using isolated explicit DATABASE_URL and
E2E ports, record the actual output of:

```text
server: npm exec -- prisma migrate deploy
server: npm exec -- prisma migrate status
server: npm run prisma:seed (twice, compare unchanged snapshots)
server: npm test -- --reporter=verbose
server: npm run build
client: npm test -- --reporter=verbose
client: npm run build
root: npm run test:e2e -- --list
root: npm run test:e2e -- --workers=1 --reporter=list
root: python3 scripts/check-lab4-contract.py
root: git diff --check
```

Run these from the actual reviewed release SHA in an isolated main checkout;
include populated migration/recovery and independent count queries separately.
Save sanitized logs with command, timestamp, branch/SHA, counts, exit codes and
scope. Screenshots under artifacts/lab-04/screenshots need role/viewport/state/
query captions. Archive final-main evidence under
`artifacts/lab-04/verification-YYYY-MM-DD/`; do not overwrite earlier lab evidence.
Final test status changes only after real execution; relevant approved contract
changes update the matrix and tests together. Required skips are release failures.

## 5. Answer Part 1-9 evidence plan

| Part | Planned evidence |
|---|---|
| Answer Part 1 | Feature -> lab4-staging -> main graph, all Issues Done at completion, real reviewer/PR records, README/.gitignore and repository tree |
| Answer Part 2 | specification/API/UI links and rendering, pre-implementation contract commit/approval, decisions and Product DoD |
| Answer Part 3 | This bidirectional matrix, actual files and final-main unit/API/UI/auth/workflow/regression/E2E output |
| Answer Part 4 | Named actual LLM, 6-10 real prompts, student's My Reflection |
| Answer Part 5 | Staff/Admin metrics/current-user Actions/recent/urgent/drill-down/state/viewport screenshots and matching SQL |
| Answer Part 6 | Action list/create/assign/edit/status/complete/cancel, validation/inactive rejection/role/failure/viewport evidence |
| Answer Part 7 | Ticket transitions/gate, stable Action/history order, immutable revision/event SQL evidence and role visibility |
| Answer Part 8 | Owned Requester metrics/attention/recent/drill-down/isolation and representative Labs 1-3 regression |
| Answer Part 9 | Rendered UI spec, all three widths, keyboard/focus/labels/overflow evidence and verified checklist |

Evidence is planned here; no PDF or fabricated passing screenshot/review is created.

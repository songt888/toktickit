# Lab 4 Test DD and Traceability Plan

Status: every feature row is **Passed**: it ran green in the Issue that owns it (#66 to #72, merged into
`lab4-staging` through PRs #77 to #83) and again before release on the #73 branch (section 4.1). DOC-01 and
RELEASE-01 stay **Pending** until the reviewed release to `main` and the final-main verification
follow-up are merged. Per-test notes are in section 2.1.
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

## 2. Test matrix and results

Paths below are the real repository locations created in the owning implementation Issues.
All IDs are local to Lab 4. Final is exactly Passed, Pending, Planned or Failed, so
`scripts/check-lab4-contract.py` can read it; what each result covers is in section 2.1.

| Test ID | Type | AC | What it tests / expected result | Automated test file | Final |
|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-02 | Length/date/offset/protected-field/follow-up boundaries; literal text accepted, invalid input rejected | `server/tests/lab-04/action-validation.test.ts` | Passed |
| UNIT-02 | Unit | AC-04 | Hard-coded Action transition pairs and terminal edit/cancel/completion rules | `server/tests/lab-04/action-status-transition.test.ts` | Passed |
| UNIT-03 | Unit | AC-08 | All 64 Ticket pairs against independent expected pairs and confirmations | `server/tests/lab-04/status-transition.test.ts` | Passed |
| UNIT-04 | Unit | AC-09 | Gate truth table: zero, all-cancelled, pending, follow-up, mixed completed/cancelled, advisory independence | `server/tests/lab-04/resolution-gate.test.ts` | Passed |
| UNIT-05 | Unit | AC-14 | Inclusive UTC rolling bounds, Bangkok display conversion, null legacy resolution time | `server/tests/lab-04/dashboard-dates.test.ts`, `client/tests/lab-04/dashboard-dates.test.tsx` | Passed |
| API-01 | API | AC-01 | Staff/Admin create: Ticket/session performer/default or chosen eligible assignee, PLANNED, owner unchanged, initial revision | `server/tests/lab-04/actions-taken.api.test.ts` | Passed |
| API-02 | API | AC-02 | Full create/merged-patch field validation, no write on error, Unicode/literal text and date boundaries | `server/tests/lab-04/actions-taken.api.test.ts` | Passed |
| API-03 | API | AC-03 | Default/valid/reassigned eligible users; inactive/Requester/null rejection; deactivated historical identity readable | `server/tests/lab-04/actions-taken.api.test.ts` | Passed |
| API-04 | API | AC-04 | Start/complete/cancel, required result/reason/confirm, no-op and invalid pairs, resolved/closed/cancelled parent lock | `server/tests/lab-04/actions-taken.api.test.ts` | Passed |
| API-05 | API | AC-05 | Descriptive/completed follow-up corrections append exactly one snapshot; no cancelled edits or history DELETE/PATCH | `server/tests/lab-04/actions-taken.api.test.ts` | Passed |
| API-06 | API | AC-07 | Equal action/event dates, revisions, paging/counts and max page sizes have deterministic order | `server/tests/lab-04/action-history.api.test.ts` | Passed |
| API-07 | API | AC-08 | Direct status calls for allowed/forbidden pairs and confirmations; one event only on success | `server/tests/lab-04/ticket-workflow.api.test.ts` | Passed |
| API-08 | API | AC-09, AC-12 | Direct backend gate, advisory isolation, legacy resolved/closed grandfathering and reopened zero-Action gate | `server/tests/lab-04/ticket-workflow.api.test.ts` | Passed |
| API-09 | API | AC-10 | Stale Action/Ticket versions, monotonic timestamps and injected failure rollback preserve projection/revision/event consistency | `server/tests/lab-04/actions-taken.api.test.ts` | Passed |
| API-10 | API | AC-11 | Lost-response replay of create/edit/assignment/status; exact stored result; payload/route mismatch safe 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Passed |
| AUTH-01 | Authorization | AC-06, AC-21 | Missing/password-gated/inactive sessions; owning Requester reads all shared work, own write 403, cross-owner 404, no secret/private fields | `server/tests/lab-04/authorization.api.test.ts` | Passed |
| AUTH-02 | Authorization | AC-14, AC-15, AC-21 | Requester scope forgery rejected, Staff/Admin-only Dashboard/myActions; session-derived assignment and ownership | `server/tests/lab-04/authorization.api.test.ts` | Passed |
| CONC-01 | Concurrency | AC-10 | Barrier-controlled Action-create/edit/follow-up vs Resolve and competing owner/priority/status/advisory writes; one valid serialized outcome, no partial commits | `server/tests/lab-04/concurrency.api.test.ts` | Passed |
| CONC-02 | Concurrency | AC-03 | User deactivate/demote races create/reassign/start/complete; locks/rechecks prevent invalid fresh assignment or authorization | `server/tests/lab-04/concurrency.api.test.ts` | Passed |
| CONC-03 | Concurrency | AC-11 | Concurrent same mutationId exactly once; cross-Ticket same actor/id reuse cannot commit two commands | `server/tests/lab-04/concurrency.api.test.ts` | Passed |
| DB-01 | Integration | AC-05 | FKs, checks, unique versions/mutation ids, identity guards, projection-without-matching-revision commit rejection and SQL UPDATE/DELETE history rejection | `server/tests/lab-04/data-foundation.test.ts` | Passed |
| DB-02 | Migration/recovery | AC-12 | Isolated populated Lab 3 upgrade, old row/file/hash/timestamp/sequence preservation, no invented backfill, backup restore and forward repair | `server/tests/lab-04/migration-preservation.test.ts` | Passed |
| DB-03 | Seed | AC-13 | Required status/priority/ownership/Action/empty fixtures, two reruns, unchanged real credentials/work/timestamps and no duplicate histories | `server/tests/lab-04/seed.test.ts` | Passed |
| API-11 | API | AC-14 | Independent owned counts and bounded recent list at every time boundary/null legacy date, zero snapshot | `server/tests/lab-04/requester-dashboard.api.test.ts` | Passed |
| API-12 | API | AC-15 | Independent Staff/Admin counts, zero buckets, active priority scope, assignee-not-performer myActions, bounded/tied lists and snapshot consistency | `server/tests/lab-04/staff-dashboard.api.test.ts` | Passed |
| API-13 | API | AC-16 | Status groups/all Requester statuses/date bounds/exact count-to-list equality and paginated myActions query | `server/tests/lab-04/dashboard-drilldown.api.test.ts` | Passed |
| UI-01 | UI | AC-02, AC-03, AC-04 | Action field/lifecycle validation, active picker/reference failure, completed corrections/ineligible assignee, conditional note and cancel confirmation | `client/tests/lab-04/ActionsTaken.test.tsx` | Passed |
| UI-02 | UI | AC-06, AC-07 | Read-only Requester full Action/history view, no private fields/write controls, stable paging and focus | `client/tests/lab-04/RequesterActionsTaken.test.tsx`, `client/tests/lab-04/TicketStatusHistory.test.tsx` | Passed |
| UI-03 | UI | AC-08, AC-09, AC-18 | Permitted Ticket states, gate explanation, advisory independence, fresh status/confirmation and 409 review | `client/tests/lab-04/TicketWorkflow.test.tsx` | Passed |
| UI-04 | UI | AC-10, AC-11, AC-18 | Double-click/ambiguous retry UUIDs, replay refresh, updated versions, 400/409/network/500 retained drafts, safe refresh and stale response guards | `client/tests/lab-04/ActionsTaken.test.tsx` | Passed |
| UI-05 | UI | AC-16, AC-17 | Requester cards, zero/loading/failure/forbidden, exact filter callbacks/date bounds, independent stale-response handling | `client/tests/lab-04/RequesterDashboard.test.tsx` | Passed |
| UI-06 | UI | AC-16, AC-17 | Staff/Admin counts/captions/pending Actions and paging, exact Queue/Detail callbacks, zero/error/old snapshot states | `client/tests/lab-04/StaffDashboard.test.tsx` | Passed |
| UI-07 | UI | AC-17, AC-18 | Dashboard initial destination/nav/identity/password gate, prior screens, logout draft/data cleanup and stale cross-user response prevention | `client/tests/lab-04/ApplicationShell.test.tsx` | Passed |
| STYLE-01 | UI style | AC-19, AC-20 | Zen Green tokens, semantic form/metric labels, required/error/status cues, editable/read-only/private distinction | `client/tests/lab-04/ui-style.test.tsx` | Passed |
| RESP-01 | Responsive | AC-19 | All Dashboard/Action list/create/edit/history/workflow/myActions views at 1280/820/390px; measure overflow and inspect clipping/overlap | `e2e/lab-04/responsive.spec.ts` | Passed |
| A11Y-01 | Accessibility | AC-20 | Keyboard activation, labels/focus/skip/active-nav/error announcements, cancel dialog trap/return focus | `e2e/lab-04/accessibility.spec.ts` | Passed |
| E2E-01 | E2E | AC-01, AC-03, AC-04, AC-05, AC-06 | Different Staff Actions on one Ticket, assign/edit/start/complete/cancel/history and Requester visibility/isolation | `e2e/lab-04/actions-taken-flow.spec.ts` | Passed |
| E2E-02 | E2E | AC-07, AC-08, AC-09 | Record ordered work, failed gate, settled follow-up, resolve/close/reopen/cancel and shared history | `e2e/lab-04/ticket-resolution.spec.ts` | Passed |
| E2E-03 | E2E | AC-14, AC-15, AC-16, AC-17 | Three roles' owned/operational metrics, myActions, zero/failure states, every card/list drill-down and matching DB queries | `e2e/lab-04/dashboards.spec.ts` | Passed |
| REG-01 | Regression | AC-21 | Run all existing Lab 1-3 server/client checks plus preserved root E2E projects; independently assert critical security/business behavior | Existing `server/tests/lab-01/`, `server/tests/lab-02/`, `server/tests/lab-03/`, `client/tests/lab-01/`, `client/tests/lab-02/`, `client/tests/lab-03/`, `e2e/lab-02/`, `e2e/lab-03/` | Passed |
| E2E-04 | E2E regression | AC-21 | Auth/password/logout, tickets/attachments/comments, queue/owner/priority/notes and Admin safety all remain functional | `e2e/lab-04/regression.spec.ts` | Passed |
| PERF-01 | Performance-smoke | AC-22 | 10,000 Tickets/30,000 Actions, <=12 data SQL statements/request, no N+1, <=32KiB body, warm 5-run median<=1s and max<=2s | `server/tests/lab-04/dashboard-performance.test.ts` | Passed |
| DOC-01 | Document/workflow | AC-23, AC-24 | Bidirectional traceability/local links, rubric/design/API/UI/schema decisions, honest prompts/reviews, actual approval/release state | `scripts/check-lab4-contract.py`; manual source/GitHub review | Pending |
| RELEASE-01 | Release | AC-24 | Reviewed staging/main integration and full final-main suites/builds/migration/seed/E2E with exact SHA/logs, no required skips | Commands/evidence in section 4 | Pending |

Performance conditions: local Node/PostgreSQL versions, machine resources,
connection configuration, dataset and query plans are recorded with sanitized
logs. One untimed warm-up then five sequential timed requests per role,
no artificial sleeps and no background load. Budget is a smoke check, not a
production SLA; investigate failures rather than silently raising thresholds.

### 2.1 Results by test ID

Rows not listed passed as written in the matrix, with no extra notes.

- **UNIT-05**: #72: server: exact bounds included and 1 ms either side excluded (compared in PostgreSQL), Bangkok-midnight case, offset-only ISO input, null legacy time never matches; client: UTC instants shown in Bangkok time across the date line
- **DB-03**: #73: DB-03j checks that a Lab 4 fixture user still on the migration placeholder hash gets the initial password when the seed runs with one, like the Lab 3 users; it fails without the `seedLab4.ts` change
- **UI-03**: #73: the readiness summary is a labelled group, and no resolve hint ("Ready to resolve." or "To resolve this Ticket ...") shows when RESOLVED is not a next move (CLOSED, CANCELLED, RESOLVED); the new tests fail without the `StaffTicketDetail.tsx` change
- **AUTH-02**: #72: a Requester's forged requesterId/userId/ownerId/assigneeId is rejected (400) or ignored; Staff and Administrator `?userId=`/`ownerId`/`assigneeId`/`requesterId` on the Dashboard and My Actions is 400; a forged performedById is refused on create and on every Action PATCH route (edit, assignee to a different eligible Staff user, status) with 400 and exactly `fieldErrors.performedById`, the row unchanged; the same body without it then succeeds (200) and keeps the session user as performer, and a body requesterId never changes the Ticket owner; Staff endpoints 403 for Requesters
- **CONC-02**: #72: 12 raced rounds, 60 s test timeout like CONC-01
- **UI-02**: Ticket Status History added in #72: ordered from/to events with actor, empty and legacy note, Retry, paging both ways, 401 sign-in message, and a late earlier response never replacing a newer one
- **UI-07**: Dashboard first page, navigation and earlier screens for all three roles (#70, #71); logout clears a Create Ticket draft; a late Dashboard response for the previous user is dropped by the request guard itself (same component instance, user id changes), and the test fails if the guard is removed (#72)
- **STYLE-01**: #72: tokens in `client/src/theme.css`, text labels for status/priority/owner/metrics, `aria-required` on every field marked `*` (Action form including Result when editing a completed Action and the cancel confirmation, Create Ticket), no Bootstrap blue `primary` class left in `client/src`; one shared badge mapping in `statusBadge.ts`: all 8 Ticket statuses and all 4 priorities have their own badge, used on every screen including both Dashboards (IT priority too); green focus glow and checked boxes in `theme.css`; the rendered badges on both Dashboards and Requester Detail carry each status's own class (CANCELLED is never the RESOLVED green)
- **RESP-01**: #72: 14 screens x 3 widths (including the Requester's My Tickets list and Administrator User Management); each screen is measured only after its loading status is gone. The Queue is measured twice: the Dashboard drill-down with its scope banner and its first page of rows (`queue-scoped`), then after searching for the fixture Ticket (`queue-search`), since Apply filters clears the scope. Both are also measured at 992 px, the narrowest width that shows the Queue table. Unassigned WAITING_FOR_REQUESTER and IN_PROGRESS Tickets are created through the Staff status API (and raised in IT priority right before the drill-down loads; that bumps their Last updated time, and the Queue sorts by Last updated, so they are on its first page), and the run asserts their badges in My Tickets and in the scoped Queue. Each screen also fails on a link with no target, a visible button or link with no name, or TODO/placeholder text. Page overflow, a table that scrolls sideways inside its own box, a short word (such as Unassigned) split across two lines in a table cell, controls cut off at the edge and text wider than its own box all fail the run. An unbroken 60-character word is in the summary, description, public comment, Internal Note and Action; the fresh Staff and Requester names are 100+ unbroken characters, and an attachment has a long unbroken name. It found and fixed overflows in the mobile Queue card, the desktop Queue table (a long requester name pushed Owner, Updated and Open Detail out of view at 1280 px; at 992 px a page of mixed rows was 1013 px wide, fixed by showing the extra Requester column from 1200 px, compact `table-sm` cells and letting status badges such as WAITING_FOR_REQUESTER wrap after an underscore, so the ten listed columns fit; Owner keeps Unassigned on one line), the desktop My Tickets table with a WAITING_FOR_REQUESTER row (732 px in 704 px; fixed with the same `table-sm` and status-badge wrapping), the desktop My Tickets table (View details pushed off-screen), the header user name, the My Tickets heading, the Staff attachment name and User Management at 820 px; a failure names the offending elements; screenshots in `artifacts/lab-04/screenshots/responsive/`
- **A11Y-01**: #72: keyboard-only path through Dashboard, Queue, Detail, Action form, cancel panel, history and My Pending Actions. The cancel panel is inline, not a modal: focus moves into it on open and returns to the same Action on Discard. Computed focus glow and checked-box colour are the Zen Green.
- **E2E-01**: #72: fresh users per run, no seeded accounts
- **E2E-02**: #72: fresh users per test; the shared Ticket Status History lists the same ordered transitions with actor for Staff and the Requester; plus a deactivated-assignee case (flagged, work disabled, server 400)
- **E2E-03**: all three roles' metrics vs database (Staff: all cards and all 12 buckets); every card, bucket and View all drill-down; Open Detail/Open Action and isolation (#70, #71); injected 500 shows the error with Retry, the zero state, a failed refresh keeping older data, and an injected 403 showing the forbidden state for both Dashboards (#72); each drill-down waits for the response carrying its own scope
- **REG-01**: #72: server 45 files, 185 tests (PERF-01 skipped, run separately; includes the harness test), client 23 files/128 tests (Lab 1 client test re-enabled; 132 and server 186 after #73, section 4.1), Playwright 26 tests in 14 files, each run at least twice
- **E2E-04**: #72: fresh users per test; covers Lab 1-3 sign-in, password change and logout, Tickets with attachments and comments, Queue owner and IT priority with a stale 409, Internal Notes and Administrator safety rules.
- **PERF-01**: #72: opt-in with `npm run test:perf` in `server/` (skipped by plain `npm test`), own database per run; conditions and results in `artifacts/lab-04/performance/perf-01.md`

## 3. Runner integration and implementation ownership

#66: DB-01/02/03; #67: unit/API/auth/concurrency Action tests; #68: Action UI;
#69: gate/workflow/history tests; #70: Requester metrics/list/UI;
#71: Staff/Admin metrics/myActions/list/UI; #72: complete integration/regression,
style/responsive/accessibility/performance; #73: reviewed release/evidence.
Complete dependencies in [issue-plan.md](issue-plan.md) before each issue.

Server Vitest includes `tests/**/*.test.ts`; the client Vite test include covers Labs 1 to 4 (the
Lab 1 client test was re-enabled in #72); Playwright has a `lab4-desktop` project beside the Lab 2/3
projects. Verify `--list` and logged per-file counts; do not assume a passing command includes
files it never selected.

As built in #72: Lab 4 specs run once in `lab4-desktop` and set 1280/820/390 px
widths inside the spec (RESP-01, E2E-01), so no scenario runs three times.
The Lab 2/3 responsive projects now match only their own responsive specs.

Every Lab 4 Playwright test uses `e2e/lab-04/guardedTest.ts` (labsheet 8.5): it fails on an uncaught page error or a browser `console.error`. A failed request a test causes on purpose is listed as `<status> <path>` (the wrong-password sign-in in E2E-04, the injected 500/403 Dashboard outages in E2E-03); the 401 from the session check on page load is always allowed. A throwaway spec confirmed it fails on a thrown error, a `console.error` and an unexpected 500.

Server API tests bind each Supertest app to 127.0.0.1 (`server/tests/setup.ts`; `server/tests/harness.test.ts` fails if the patch stops applying). Supertest's default listens on every interface and then calls 127.0.0.1, so on macOS a port already held by another local program on 127.0.0.1 answered instead of the app (random 401/404 and 5 s timeouts, about 1 run in 8). Fixture cleanup also skips an undefined id (Prisma would read `{ id: undefined }` as every Ticket) and removes notes and comments before their Tickets and users. Lab 4 E2E fixture text uses `uniqueTag()` (time plus a random part, `e2e/lab-04/freshUser.ts`), since `Date.now()` repeated across parallel workers, and the Action order check is polled while the list reloads; `--project=lab4-desktop --repeat-each 4` passes 44/44 (11 tests x 4).

## 4. Verification commands and evidence

The contract checker (`python3 scripts/check-lab4-contract.py`) validates references only; it does not
execute or certify any feature test. For each Issue and for the release, using isolated explicit
DATABASE_URL and E2E ports, record the actual output of:

```text
server: npm exec -- prisma migrate deploy
server: npm exec -- prisma migrate status
server: npm run prisma:seed (twice, compare unchanged snapshots)
server: npm test -- --reporter=verbose
server: npm run test:perf (PERF-01; skipped by npm test, so it is its own required step)
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
changes update the matrix and tests together. Required skips are release failures:
PERF-01 is skipped inside `npm test` by design, so a release that does not run
`npm run test:perf`, or where it fails, does not pass.

### 4.1 Pre-release run for #73 (2026-11-01)

Run on branch `feature/lab4-09-docs-release` at `bfc9e87` (the merge of PR #83 into `lab4-staging` as `0512c04`, plus the #73 docs, one client change, one seed change and their tests), local Docker PostgreSQL 16, Node v24.19.0. After this commit only documentation (`tests.md`, `reviewer.md`, `ai-use.md`, `issue-plan.md`, `specification.md`) and the name of one seed test (DB-03c to DB-03j) changed; no code behaviour changed.

| Command | Result |
|---|---|
| `server: npx prisma migrate status` | Database schema is up to date |
| `server: npm run prisma:seed` (twice) | Table counts unchanged by both reruns: Lab 4 fixture Tickets 11; whole-table Actions 947, revisions 1,978, status events 1,572, Users 2,277 |
| `server: npm test` | 44 files passed, 1 skipped (PERF-01); 186 tests passed, 1 skipped |
| `server: npm run test:perf` | 1 passed (PERF-01) |
| `server: npm run build` | Passed |
| `client: npm test` | 23 files, 132 tests passed |
| `client: npm run build` | Passed |
| `root: npx playwright test --list` | 26 tests in 14 files |
| `root: npx playwright test` | 26 passed |
| `root: python3 scripts/check-lab4-contract.py` | 24 ACs, 44 test IDs, 69 bidirectional mappings; local links valid |
| `root: git diff --check` | Clean |


The contract checker did not pass at `0512c04` itself, because its rows still said `Pass`; it passes on this branch. Compared with `0512c04` (server 185, client 128), this branch adds one server test (DB-03j) and four client tests (UI-03), and one E2E assertion (no "Ready to resolve." once RESOLVED); the Playwright count stays 26. These are the counts that REG-01 should read after #73.

This is the pre-release run. RELEASE-01 needs the same commands from the released `main` SHA, recorded in the follow-up PR.

## 5. Answer Part 1-9 evidence

| Part | Evidence |
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

No PDF is created, and nothing here is a fabricated passing screenshot or review.

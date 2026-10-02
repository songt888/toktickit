# Lab 3 Test DD and Traceability Plan

Status: Issues #39–#48 are approved, merged into `main`, and closed/Done.
Release PR #57 merged into `lab3-staging` as `9393a6e`, and release PR #58
merged into `main` as `5b234a4`. Final verification was rerun against
`main` at `ac8a3dd` after PR #60; the original release verification is retained
below.

Lab 3 tests live under `server/tests/lab-03/`, `client/tests/lab-03/`, and
`e2e/lab-03/`. Every acceptance criterion in [`specification.md`](specification.md)
maps to at least one test. The original release verification is retained below;
the post-PR #60 final-main recheck is recorded in its own section.

## 1. Test Strategy

- Unit tests cover password rules, safe hashing helpers, query parsing, and the
  status-transition matrix.
- API/integration tests use PostgreSQL and Prisma to verify authentication,
  migration, seed data, ownership, role authorization, workflow, comments,
  notes, and administrator safety rules.
- UI component tests use Vitest and Testing Library for screen states and user
  interactions.
- UI style tests check labels, ARIA roles, badges, editable/read-only styling,
  and Zen Green conventions.
- Regression tests run the completed Lab 2 requester and attachment suites
  after the identity migration.
- Playwright tests cover authentication, first-login password change, IT Staff
  operations, Administrator management, responsive behavior, and accessibility.
- Playwright captures visual evidence for all major role-specific screens at
  desktop, tablet, and mobile widths; responsive checks also measure overflow.

No required test should be skipped, disabled, or reconstructed after coding.

## 2. Planned Test Matrix

| Test ID | Type | AC | What it tests | Automated test file | Expected result | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-02, AC-03, AC-19 | Password rules, confirmation, and change-required state | `server/tests/lab-03/password-rules.test.ts` | Valid boundaries accepted; invalid values rejected | Passed |
| UNIT-02 | Unit | AC-01, AC-02 | Hash/verify behavior and no plaintext storage | `server/tests/lab-03/password-hash.test.ts` | Hash verifies; plaintext is not persisted | Passed |
| UNIT-03 | Unit | AC-09, AC-10 | Staff queue query parsing and stable pagination | `server/tests/lab-03/staff-queue.api.test.ts` | Valid options normalized; invalid values rejected | Passed |
| UNIT-04 | Unit | AC-12 | Status transition matrix and confirmation rules | `server/tests/lab-03/status-transition.test.ts` | Only approved transitions pass | Passed |
| UNIT-05 | Unit | AC-15 | Comment/note length and accepted markup-like text | `server/tests/lab-03/comment-validation.test.ts` | Empty/oversized content rejected; markup-like content remains eligible for literal client rendering | Passed |
| API-01 | API | AC-01 | Valid active-user login and safe response | `server/tests/lab-03/auth.api.test.ts` | `200`, session cookie, safe user data | Passed |
| API-02 | API | AC-02 | Invalid credentials and inactive-user login | `server/tests/lab-03/auth.api.test.ts` | Same safe `401` response | Passed |
| API-03 | API | AC-03 | First-login password-change gate | `server/tests/lab-03/auth.api.test.ts` | Normal endpoints blocked until change | Passed |
| API-04 | API | AC-04 | Current user and logout invalidation | `server/tests/lab-03/auth.api.test.ts` | `/me` works; revoked session fails | Passed |
| API-05 | API | AC-05, AC-10 | Missing session and role-based direct API authorization | `server/tests/lab-03/authorization.api.test.ts` | `401`/`403` without data leakage | Passed |
| API-06 | Integration | AC-21, AC-22 | Migration, schema, foreign keys, and repeatable seed | `server/tests/lab-03/data-foundation.test.ts`, `server/tests/lab-03/seed.test.ts` | Existing data preserved; seed is idempotent | Passed |
| API-07 | API | AC-06, AC-07 | Authenticated Requester create/list/detail regression | `server/tests/lab-03/requester-regression.api.test.ts` | Identity comes from session only | Passed |
| API-08 | API | AC-06, AC-07 | Requester attachment ownership after migration | `server/tests/lab-03/requester-regression.api.test.ts` | Own files work; cross-owner access is safe `404` | Passed |
| API-09 | API | AC-08 | Requester Public Comments and resolution indication | `server/tests/lab-03/requester-comments.api.test.ts` | Own Ticket only; no formal close/resolve | Passed |
| API-10 | API | AC-09, AC-10 | Staff queue search, filters, sort, and pagination | `server/tests/lab-03/staff-queue.api.test.ts` | Correct items and metadata | Passed |
| API-11 | API | AC-11, AC-12 | Staff detail, attachment metadata/download, ownership, priority, and status changes with last-seen `updatedAt` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Permitted reads and changes persist; invalid ones fail safely | Passed |
| API-12 | API | AC-12 | Inactive owner, stale `updatedAt`, and conflicting staff updates | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | No invalid mutation; documented `400`/`409` | Passed |
| API-13 | API | AC-13 | Public Comment visibility for all permitted roles | `server/tests/lab-03/comments-notes.api.test.ts` | Requester, Staff, Admin can read permitted content | Passed |
| API-14 | API | AC-14 | Internal Note visibility, requester `403` on own Tickets, and safe cross-owner `404` | `server/tests/lab-03/comments-notes.api.test.ts` | Staff/Admin only; no note content on `403`; cross-owner access is safe `404` | Passed |
| API-15 | API | AC-15 | Comment/note validation, append-only behavior, and safe plain-text rendering | `server/tests/lab-03/comments-notes.api.test.ts` | Empty/oversized rejected; markup-like content is stored as ordinary text | Passed |
| API-16 | API | AC-16 | Admin user listing, search, and role filter | `server/tests/lab-03/users-admin.api.test.ts` | Safe user list and query behavior | Passed |
| API-17 | API | AC-17, AC-18 | Admin create/edit and duplicate email handling | `server/tests/lab-03/users-admin.api.test.ts` | `201`/`200`; duplicate is `409` | Passed |
| API-18 | API | AC-19, AC-20 | Password reset, self-deactivation, last-admin deactivation, and last-admin role demotion | `server/tests/lab-03/users-admin.api.test.ts` | Safety rules enforced | Passed |
| API-19 | API | AC-11 | Active eligible assignee listing and role authorization | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Only active Staff/Admin safe fields are returned | Passed |
| UI-01 | UI | AC-01, AC-02, AC-23 | Login fields, validation, busy, and safe failure | `client/tests/lab-03/Login.test.tsx` | Correct login states render | Passed |
| UI-02 | UI | AC-03, AC-23 | Change Password gate and successful continuation | `client/tests/lab-03/ChangePassword.test.tsx` | App remains blocked until success | Passed |
| UI-03 | UI | AC-04, AC-05, AC-23 | Current-user shell, role navigation, and logout | `client/tests/lab-03/ApplicationShell.test.tsx` | Name/role and permitted nav are correct | Passed |
| UI-04 | UI | AC-06, AC-07, AC-08, AC-23 | Requester regression, comments, and resolution action | `client/tests/lab-03/RequesterRegression.test.tsx` | Lab 2 behavior uses authenticated identity; comments and resolution action work | Passed |
| UI-05 | UI | AC-09, AC-10, AC-23 | Queue controls, badges, and list states | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Search/filter/sort/page and feedback work | Passed |
| UI-06 | UI | AC-11, AC-12, AC-13, AC-14, AC-23 | Staff detail operations, comments, notes, attachments | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Role-specific actions and states work | Passed |
| UI-07 | UI | AC-16, AC-17, AC-18, AC-19, AC-20, AC-23 | User list, create/edit, reset, and safety errors | `client/tests/lab-03/UserManagement.test.tsx` | Admin workflow is usable and safe | Passed |
| UI-08 | UI | AC-11, AC-12, AC-23 | Ticket ownership, IT Priority, permitted status controls, confirmation, and stale-update feedback | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Staff operations reflect server responses and errors | Passed |
| STYLE-01 | UI style | AC-05, AC-24 | Labelled Bootstrap controls, required markers, and action hierarchy | `client/tests/lab-02/ui-style.test.tsx` | Style/accessibility conventions pass | Passed |
| REG-01 | Regression | AC-07 | All Lab 2 requester/attachment API tests after migration | Existing `server/tests/lab-02/` suite | No Lab 2 regression | Passed |
| REG-02 | Regression | AC-07 | All Lab 2 client tests after authentication migration | Existing `client/tests/lab-02/` suite | No Lab 2 regression | Passed |
| RESP-01 | Responsive | AC-24 | Desktop visual and overflow checks for all major screens | `e2e/lab-03/responsive.spec.ts`, `e2e/lab-03/authentication.spec.ts` | No clipping or horizontal overflow | Passed |
| RESP-02 | Responsive | AC-24 | Tablet visual and overflow checks for all major screens | `e2e/lab-03/responsive.spec.ts`, `e2e/lab-03/authentication.spec.ts` | No clipping or hidden controls | Passed |
| RESP-03 | Responsive | AC-24 | Mobile visual and overflow checks for all major screens | `e2e/lab-03/responsive.spec.ts`, `e2e/lab-03/authentication.spec.ts` | Touch/keyboard usable at 390px | Passed |
| A11Y-01 | Accessibility | AC-24 | Keyboard skip link, focus, labels, active navigation, and role states | `e2e/lab-03/accessibility.spec.ts` | Keyboard and accessible-name checks pass | Passed |
| E2E-01 | E2E | AC-01, AC-02, AC-03, AC-04, AC-05 | Login, first password change, shell, and logout/revocation | `e2e/lab-03/authentication.spec.ts` | Full auth flow passes at three viewports | Passed |
| E2E-02 | E2E | AC-06, AC-07, AC-08 | Requester regression, comments, resolution, and isolation | `e2e/lab-03/requester-flow.spec.ts` | Requester ownership flow passes | Passed |
| E2E-03 | E2E | AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15 | Staff queue/workflow, cross-role comments, notes, and attachments | `e2e/lab-03/staff-ticket-flow.spec.ts`, `e2e/lab-03/requester-flow.spec.ts` | Staff and collaboration flows pass | Passed |
| E2E-05 | E2E | AC-09, AC-10 | Issue #43 Staff queue/detail smoke flow and responsive checks | `e2e/lab-03/staff-ticket-flow.spec.ts` | Staff queue flow passes at desktop, tablet, and mobile widths | Passed |
| E2E-06 | E2E | AC-11, AC-12 | Issue #44 claim/reassign/unassign, priority, and permitted status workflow | `e2e/lab-03/staff-ticket-flow.spec.ts` | Staff mutations pass through the authenticated UI | Passed |
| E2E-04 | E2E | AC-16, AC-17, AC-18, AC-19, AC-20 | Admin list, create/edit, reset, and safety rules | `e2e/lab-03/user-administration.spec.ts` | Admin flow passes | Passed |
| RELEASE-01 | Release | AC-25 | Final migration, seed, tests, builds, E2E, and main verification | Final commands recorded here | All required checks pass with no skips | Passed |

## Issue #45 Verification

These results are from `feature/lab3-04-requester-authorization` before the pull request:

- Server: `npm test -- --reporter=dot` — 53 tests passed.
- Client: `npm test -- --reporter=dot` — 35 tests passed.
- Server and client TypeScript production builds passed.
- `git diff --check` passed.

The final Lab 3 release verification is recorded in `RELEASE-01` and the
Issue #40 Verification section below.

## Issue #47 Verification

These results are from `feature/lab3-05-requester-comments`:

- Server: `npm test -- --reporter=dot` — 57 tests passed.
- Client: `npm test -- --reporter=dot` — 40 tests passed.
- Server and client TypeScript production builds passed.
- API coverage includes requester ownership, comment validation, append-only comments,
  safe plain-text content, and `problemAppearsResolved` without changing ticket status.
- UI coverage includes public-comment submission, empty-comment validation, and the
  resolution-indication action while keeping the authenticated requester flow.

The API and UI results above were recorded before the later full E2E pass; the
current branch's E2E, responsive, and accessibility results are summarized in
Issue #40 Verification below. Final release verification from `main` remains
separate.

## Issue #43 Verification

These results are from `feature/lab3-06-staff-ticket-queue`:

- Server: `npm test -- --reporter=dot` — 63 tests passed across 22 files.
- Client: `npm test -- --reporter=dot` — 44 tests passed across 11 files.
- Server and client TypeScript production builds passed.
- Playwright: `npm run test:e2e` — 5 tests passed, including the authenticated
  Lab 2 requester regression and the Staff queue flow.
- Staff-focused Playwright flow: `npm run test:e2e -- --project=staff-desktop` — 1 test passed.
- The Staff Playwright flow covers login, queue data, search/sort, operational detail,
  back navigation, and overflow checks at 1280px, 820px, and 390px.
- `git diff --check` passed.
- Visual evidence is stored under `artifacts/lab-03/screenshots/`.

Screenshot evidence:

- [`staff-desktop-queue-desktop.png`](../../artifacts/lab-03/screenshots/staff-desktop-queue-desktop.png) — desktop queue with ticket fields, priorities, status, and owner.
- [`tablet-staff-queue.png`](../../artifacts/lab-03/screenshots/tablet-staff-queue.png) — tablet queue layout without horizontal overflow.
- [`mobile-staff-queue.png`](../../artifacts/lab-03/screenshots/mobile-staff-queue.png) — mobile queue cards and controls.
- [`mobile-staff-ticket-detail.png`](../../artifacts/lab-03/screenshots/mobile-staff-ticket-detail.png) — operational detail at mobile width.

The Lab 2 Playwright files were updated to use the current authenticated session flow;
they remain regression coverage and are included in the full Playwright result above.

## Issue #44 Verification

Results from `feature/lab3-07-staff-ticket-workflow`:

- Server: `npm test -- --reporter=dot` — 74 tests passed across 24 files.
- Client: `npm test -- --reporter=dot` — 48 tests passed across 12 files.
- Server and client production builds passed.
- Playwright: `npm run test:e2e` — all 6 tests passed, including Staff claim,
  reassign, unassign, IT Priority, status confirmation, and desktop/tablet/mobile
  no-overflow checks.
- `git diff --check` passed.
- The API tests cover eligible active assignees, Staff/Admin authorization,
  invalid/inactive owners, immutable Requested Priority, permitted transitions,
  confirmation, safe missing/stale responses, and concurrent stale updates.

Staff workflow screenshots:

- [`staff-ticket-workflow-desktop.png`](../../artifacts/lab-03/screenshots/staff-ticket-workflow-desktop.png) — completed assignment, priority, and status workflow at desktop width.
- [`tablet-staff-ticket-workflow.png`](../../artifacts/lab-03/screenshots/tablet-staff-ticket-workflow.png) — operational controls at tablet width with no horizontal overflow.
- [`mobile-staff-ticket-workflow.png`](../../artifacts/lab-03/screenshots/mobile-staff-ticket-workflow.png) — operational controls at mobile width with no horizontal overflow.

PR [#54](https://github.com/songt888/toktickit/pull/54) was approved and merged
into `lab3-staging` on 2026-09-24; Issue #44 is closed and Done. Final release
verification is recorded in the Issue #40 section below.

## Issue #41 Verification

Results from `feature/lab3-08-comments-notes`:

- Server: `npm test -- --reporter=dot` — 86 tests passed across 26 files.
- Client: `npm test -- --reporter=dot` — 50 tests passed across 12 files.
- Server and client production builds passed.
- API coverage verifies public-comment visibility for the owner, Staff, and
  Administrator; backend-controlled author/time; Internal Note role checks and
  safe `403`/`404` behavior; and blank/oversized validation.
- UI coverage verifies visibly separated Public Comments/Internal Notes,
  literal rendering of markup-like text, blank validation, retained drafts after
  failures, preservation of existing attachment metadata, and that Requester
  detail does not show Internal Notes.
- Markup-like content is intentionally accepted under AC-15 and rendered as
  text by React; it is not inserted as HTML.
- The current branch's E2E-03 run passed; the final release verification is
  recorded in the Issue #40 section below.
- PR [#55](https://github.com/songt888/toktickit/pull/55) was approved by
  `@stickkersz` and merged into `lab3-staging` on 2026-09-27 (merge commit
  `b75ef063520561de91d997b87c6e03acc820d290`); Issue #41 is Done.
- `git diff --check` passed.

## Issue #42 Verification

Results from `feature/lab3-09-admin-users`:

- Server: `npm test -- --reporter=dot` — 92 tests passed across 27 files.
- Client: `npm test -- --reporter=dot` — 55 tests passed across 13 files.
- Server and client production builds passed.
- Playwright: `npm run test:e2e -- --project=admin-desktop` — 1 test passed.
- API coverage includes Admin-only access, safe user fields, case-insensitive
  search/duplicate-email handling, validation, create/edit, password hashing,
  forced password change, self-deactivation, and the last-Admin decision rule.
- UI coverage includes search/filter, create/edit/reset, confirmation before
  access-impacting edits, and empty/no-results/forbidden/failure states.
- E2E covers login, list/search/filter, create, edit, initial-password reset,
  forced password change, and 1280px/820px/390px overflow checks.
- `git diff --check` passed.
- PR [#56](https://github.com/songt888/toktickit/pull/56) was approved and
  merged into `lab3-staging` on 2026-09-27 (merge commit
  `5a67740f892eeda8557115e25751d7d8ecea4664`); Issue #42 is closed and Done.

Administrator screenshots:

- [`admin-user-management-desktop.png`](../../artifacts/lab-03/screenshots/admin-user-management-desktop.png) — Admin list at 1280px.
- [`tablet-admin-user-management.png`](../../artifacts/lab-03/screenshots/tablet-admin-user-management.png) — Admin list at 820px.
- [`mobile-admin-user-management.png`](../../artifacts/lab-03/screenshots/mobile-admin-user-management.png) — filtered Admin list at 390px.

## Issue #40 Verification

Final results from `feature/lab3-final-verification`, based on `main` after
release PR [#58](https://github.com/songt888/toktickit/pull/58) merged as
`5b234a4`:

- PostgreSQL migration status: `npx prisma migrate status` reports the database
  schema is up to date. Playwright setup reran the idempotent seed successfully.
- Server: `npm test -- --reporter=dot` — 92 tests passed across 27 files.
- Client: `npm test -- --reporter=dot` — 55 tests passed across 13 files.
- Server and client production builds passed.
- Playwright: `npm run test:e2e` — 15 tests passed, including the Lab 2
  regression flows, full Lab 3 role flows, desktop/tablet/mobile checks, and
  keyboard/accessibility checks.
- `git diff --check` passed.
- Release PR [#57](https://github.com/songt888/toktickit/pull/57) merged into
  `lab3-staging` as `9393a6e`; release PR #58 merged into `main` as `5b234a4`.
- The accessibility test verifies the skip link, focus movement and indicator,
  labelled fields, current navigation, and role screens. Responsive E2E checks
  assert no horizontal overflow before capturing each major screen.

Screenshots are stored directly in `artifacts/lab-03/screenshots/`. The
`desktop-`, `tablet-`, and `mobile-` prefixes identify 1280px, 820px, and 390px
captures. For example:

- Login and first-password-change screenshots: [auth-desktop-login.png](../../artifacts/lab-03/screenshots/auth-desktop-login.png),
  [auth-tablet-change-password.png](../../artifacts/lab-03/screenshots/auth-tablet-change-password.png), and
  [auth-mobile-login.png](../../artifacts/lab-03/screenshots/auth-mobile-login.png).
- Requester screenshots: [desktop-requester-my-tickets.png](../../artifacts/lab-03/screenshots/desktop-requester-my-tickets.png),
  [tablet-requester-create-ticket.png](../../artifacts/lab-03/screenshots/tablet-requester-create-ticket.png), and
  [mobile-requester-ticket-detail.png](../../artifacts/lab-03/screenshots/mobile-requester-ticket-detail.png).
- Staff screenshots: [desktop-staff-ticket-queue.png](../../artifacts/lab-03/screenshots/desktop-staff-ticket-queue.png),
  [tablet-staff-ticket-detail.png](../../artifacts/lab-03/screenshots/tablet-staff-ticket-detail.png), and
  [mobile-staff-ticket-queue.png](../../artifacts/lab-03/screenshots/mobile-staff-ticket-queue.png).
- Administrator screenshots: [desktop-administrator-user-management.png](../../artifacts/lab-03/screenshots/desktop-administrator-user-management.png),
  [tablet-administrator-user-management.png](../../artifacts/lab-03/screenshots/tablet-administrator-user-management.png), and
  [mobile-administrator-user-management.png](../../artifacts/lab-03/screenshots/mobile-administrator-user-management.png).
- Keyboard focus evidence: [accessibility-keyboard-focus.png](../../artifacts/lab-03/screenshots/accessibility-keyboard-focus.png).

`RELEASE-01` is Passed because AC-25 was verified after merge into `main`.
The report PDF is maintained as a separate deliverable.

## Final-main verification — 2026-10-02

This is the fresh verification after PR #60 on commit `ac8a3dd`. Both the
checkout under test and `origin/main` resolved to `ac8a3dd`; no application
source was changed for this run. The E2E run used the repository test files
against an isolated PostgreSQL database and a temporary local API port so it
could not alter the user's working database.

- Prisma migration status: schema up to date (4 migrations); seed completed.
- Server: `npm test -- --reporter=dot --silent` — 27 files passed, 92 tests passed.
- Server build: `npm run build` — passed (`tsc`).
- Client: `npm test -- --reporter=dot --no-file-parallelism` — 13 files passed, 56 tests passed.
- Client build: `npm run build` — passed (Vite production build, 37 modules transformed).
- Playwright: the final-main evidence run recorded 15 tests passed using a port-patched copy. The repository now reads `E2E_API_URL` for direct request-context calls, Vite's API proxy, and the server webServer port; a fresh branch rerun remains pending because Chromium was blocked before test execution in this environment.

The terminal evidence in the report distinguishes these final-main results from
the retained historical release screenshots at `92c88aa`.

## 3. Acceptance-Criterion Traceability

| Acceptance Criteria | Planned tests |
|---|---|
| AC-01 | UNIT-02, API-01, UI-01, E2E-01 |
| AC-02 | UNIT-01, UNIT-02, API-02, UI-01, E2E-01 |
| AC-03 | UNIT-01, API-03, UI-02, E2E-01 |
| AC-04 | API-04, UI-03, E2E-01 |
| AC-05 | API-05, UI-03, STYLE-01, E2E-01 |
| AC-06 | API-07, API-08, UI-04, E2E-02 |
| AC-07 | API-07, API-08, UI-04, REG-01, REG-02, E2E-02 |
| AC-08 | API-09, UI-04, E2E-02 |
| AC-09 | UNIT-03, API-10, UI-05, E2E-03, E2E-05 |
| AC-10 | UNIT-03, API-05, API-10, UI-05, E2E-03, E2E-05 |
| AC-11 | API-11, API-19, UI-06, UI-08, E2E-03, E2E-06 |
| AC-12 | UNIT-04, API-11, API-12, UI-06, UI-08, E2E-03, E2E-06 |
| AC-13 | API-13, UI-06, E2E-03 |
| AC-14 | API-14, UI-06, E2E-03 |
| AC-15 | UNIT-05, API-15, E2E-03 |
| AC-16 | API-16, UI-07, E2E-04 |
| AC-17 | API-17, UI-07, E2E-04 |
| AC-18 | API-17, UI-07, E2E-04 |
| AC-19 | UNIT-01, API-18, UI-07, E2E-04 |
| AC-20 | API-18, UI-07, E2E-04 |
| AC-21 | API-06 |
| AC-22 | API-06 |
| AC-23 | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08 |
| AC-24 | STYLE-01, RESP-01, RESP-02, RESP-03, A11Y-01 |
| AC-25 | RELEASE-01 |

## 4. Required Repository Test Files

Server API/integration tests:

```text
server/tests/lab-03/
├── password-rules.test.ts
├── password-hash.test.ts
├── staff-queue.api.test.ts
├── status-transition.test.ts
├── comment-validation.test.ts
├── auth.api.test.ts
├── authorization.api.test.ts
├── data-foundation.test.ts
├── requester-regression.api.test.ts
├── requester-comments.api.test.ts
├── staff-ticket-detail.api.test.ts
├── comments-notes.api.test.ts
├── users-admin.api.test.ts
└── seed.test.ts
```

Client tests:

```text
client/tests/lab-03/
├── Login.test.tsx
├── ChangePassword.test.tsx
├── ApplicationShell.test.tsx
├── RequesterRegression.test.tsx
├── StaffTicketQueue.test.tsx
├── StaffTicketDetail.test.tsx
└── UserManagement.test.tsx
```

The shared UI style regression test remains at
`client/tests/lab-02/ui-style.test.tsx`.

End-to-end tests and evidence:

```text
e2e/lab-03/
├── authentication.spec.ts
├── requester-flow.spec.ts
├── staff-ticket-flow.spec.ts
├── user-administration.spec.ts
├── responsive.spec.ts
└── accessibility.spec.ts

artifacts/lab-03/screenshots/
├── auth-{desktop,tablet,mobile}-{login,change-password}.png
├── {desktop,tablet,mobile}-{login,requester-*,staff-*,administrator-*}.png
└── accessibility-keyboard-focus.png
```

## 5. Planned Commands

```bash
# From the repository root after Docker/PostgreSQL is running
cd server
npx prisma migrate deploy
npx prisma migrate status
npm run prisma:seed
npm test -- --reporter=dot
npm run build

cd ../client
npm test -- --reporter=dot
npm run build

cd ..
npm run test:e2e
```

The results above were rerun after the release PR merged into `main`; they
complete AC-25 and support the Passed status for RELEASE-01.

## 6. Automated and Screenshot Evidence Checklist

- [x] Valid/invalid login, inactive-account response, busy state, logout, and first-login password change.
- [x] Requester workflow, ticket ownership, comments, resolution indication, and attachment continuity.
- [x] IT Staff queue, search/filter/sort/page, assignment, priority, status, comments, notes, and attachment access.
- [x] Administrator list, search/filter, create/edit, activation, password reset, and last-admin safeguards.
- [x] Protected API access and cross-role ownership boundaries.
- [x] Desktop (1280px), tablet (820px), and mobile (390px) screenshots for login and major role screens.
- [x] Keyboard skip link/focus, labels, active navigation, and responsive no-overflow checks.

The checks above are automated by Vitest, API tests, and Playwright; visual
screenshots are retained as files in `artifacts/lab-03/screenshots/`.

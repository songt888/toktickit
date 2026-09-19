# Lab 3 Test DD and Traceability Plan

Status: Issue #45 authentication-migration checks recorded; remaining Lab 3 checks are planned.

All Lab 3 test files will live under `server/tests/lab-03/`,
`client/tests/lab-03/`, and `e2e/lab-03/`. Every acceptance criterion in
[`specification.md`](specification.md) maps to at least one planned test.
Final results will be recorded only after the tests are run from `main`.

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
- Manual screenshots provide visual evidence for all major role-specific screens
  at desktop, tablet, and mobile widths.

No required test should be skipped, disabled, or reconstructed after coding.

## 2. Planned Test Matrix

| Test ID | Type | AC | What it tests | Automated test file | Expected result | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-02, AC-03, AC-19 | Password rules, confirmation, and change-required state | `server/tests/lab-03/password-rules.test.ts` | Valid boundaries accepted; invalid values rejected | Planned |
| UNIT-02 | Unit | AC-01, AC-02 | Hash/verify behavior and no plaintext storage | `server/tests/lab-03/password-hash.test.ts` | Hash verifies; plaintext is not persisted | Planned |
| UNIT-03 | Unit | AC-09, AC-10 | Staff queue query parsing and stable pagination | `server/tests/lab-03/queue-options.test.ts` | Valid options normalized; invalid values rejected | Planned |
| UNIT-04 | Unit | AC-12 | Status transition matrix and confirmation rules | `server/tests/lab-03/status-transition.test.ts` | Only approved transitions pass | Planned |
| UNIT-05 | Unit | AC-15 | Comment/note length and safe text handling | `server/tests/lab-03/comment-validation.test.ts` | Empty/oversized content rejected; markup remains plain text | Planned |
| API-01 | API | AC-01 | Valid active-user login and safe response | `server/tests/lab-03/auth.api.test.ts` | `200`, session cookie, safe user data | Planned |
| API-02 | API | AC-02 | Invalid credentials and inactive-user login | `server/tests/lab-03/auth.api.test.ts` | Same safe `401` response | Planned |
| API-03 | API | AC-03 | First-login password-change gate | `server/tests/lab-03/auth.api.test.ts` | Normal endpoints blocked until change | Planned |
| API-04 | API | AC-04 | Current user and logout invalidation | `server/tests/lab-03/auth.api.test.ts` | `/me` works; revoked session fails | Planned |
| API-05 | API | AC-05, AC-10 | Missing session and role-based direct API authorization | `server/tests/lab-03/authorization.api.test.ts` | `401`/`403` without data leakage | Passed |
| API-06 | Integration | AC-21, AC-22 | Migration, schema, foreign keys, and repeatable seed | `server/tests/lab-03/data-foundation.test.ts` | Existing data preserved; seed is idempotent | Planned |
| API-07 | API | AC-06, AC-07 | Authenticated Requester create/list/detail regression | `server/tests/lab-03/requester-regression.api.test.ts` | Identity comes from session only | Passed |
| API-08 | API | AC-06, AC-07 | Requester attachment ownership after migration | `server/tests/lab-03/requester-regression.api.test.ts` | Own files work; cross-owner access is safe `404` | Passed |
| API-09 | API | AC-08 | Requester Public Comments and resolution indication | `server/tests/lab-03/requester-comments.api.test.ts` | Own Ticket only; no formal close/resolve | Planned |
| API-10 | API | AC-09, AC-10 | Staff queue search, filters, sort, and pagination | `server/tests/lab-03/staff-queue.api.test.ts` | Correct items and metadata | Planned |
| API-11 | API | AC-11, AC-12 | Staff detail, attachment metadata/download, ownership, priority, and status changes with last-seen `updatedAt` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Permitted reads and changes persist; invalid ones fail safely | Planned |
| API-12 | API | AC-12 | Inactive owner, stale `updatedAt`, and conflicting staff updates | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | No invalid mutation; documented `400`/`409` | Planned |
| API-13 | API | AC-13 | Public Comment visibility for all permitted roles | `server/tests/lab-03/comments-notes.api.test.ts` | Requester, Staff, Admin can read permitted content | Planned |
| API-14 | API | AC-14 | Internal Note visibility, requester `403` on own Tickets, and safe cross-owner `404` | `server/tests/lab-03/comments-notes.api.test.ts` | Staff/Admin only; no note content on `403`; cross-owner access is safe `404` | Planned |
| API-15 | API | AC-15 | Comment/note validation, append-only behavior, and safe plain-text rendering | `server/tests/lab-03/comments-notes.api.test.ts` | Empty/oversized rejected; markup is not executed | Planned |
| API-16 | API | AC-16 | Admin user listing, search, and role filter | `server/tests/lab-03/users-admin.api.test.ts` | Safe user list and query behavior | Planned |
| API-17 | API | AC-17, AC-18 | Admin create/edit and duplicate email handling | `server/tests/lab-03/users-admin.api.test.ts` | `201`/`200`; duplicate is `409` | Planned |
| API-18 | API | AC-19, AC-20 | Password reset, self-deactivation, last-admin deactivation, and last-admin role demotion | `server/tests/lab-03/users-admin.api.test.ts` | Safety rules enforced | Planned |
| UI-01 | UI | AC-01, AC-02 | Login fields, validation, busy, and safe failure | `client/tests/lab-03/Login.test.tsx` | Correct login states render | Planned |
| UI-02 | UI | AC-03 | Change Password gate and successful continuation | `client/tests/lab-03/ChangePassword.test.tsx` | App remains blocked until success | Planned |
| UI-03 | UI | AC-04, AC-05 | Current-user shell, role navigation, and logout | `client/tests/lab-03/ApplicationShell.test.tsx` | Name/role and permitted nav are correct | Planned |
| UI-04 | UI | AC-06, AC-07, AC-08 | Requester regression, comments, and resolution action | `client/tests/lab-03/RequesterRegression.test.tsx` | Lab 2 behavior uses authenticated identity | Passed |
| UI-05 | UI | AC-09, AC-10 | Queue controls, badges, and list states | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Search/filter/sort/page and feedback work | Planned |
| UI-06 | UI | AC-11, AC-12, AC-13, AC-14 | Staff detail operations, comments, notes, attachments | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Role-specific actions and states work | Planned |
| UI-07 | UI | AC-16, AC-17, AC-18, AC-19, AC-20 | User list, create/edit, reset, and safety errors | `client/tests/lab-03/UserManagement.test.tsx` | Admin workflow is usable and safe | Planned |
| STYLE-01 | UI style | AC-05, AC-23, AC-24 | Labels, ARIA, focus, badges, Zen Green, read-only fields | `client/tests/lab-03/ui-style.test.tsx` | Visual/accessibility conventions present | Planned |
| REG-01 | Regression | AC-07 | All Lab 2 requester/attachment API tests after migration | Existing `server/tests/lab-02/` suite | No Lab 2 regression | Passed |
| REG-02 | Regression | AC-07 | All Lab 2 client tests after authentication migration | Existing `client/tests/lab-02/` suite | No Lab 2 regression | Passed |
| RESP-01 | Responsive | AC-24 | Desktop visual and overflow checks for all major screens | `e2e/lab-03/responsive.spec.ts` | No clipping or horizontal overflow | Planned |
| RESP-02 | Responsive | AC-24 | Tablet visual and overflow checks for all major screens | `e2e/lab-03/responsive.spec.ts` | No clipping or hidden controls | Planned |
| RESP-03 | Responsive | AC-24 | Mobile visual and overflow checks for all major screens | `e2e/lab-03/responsive.spec.ts` | Touch/keyboard usable at 390px | Planned |
| A11Y-01 | Accessibility | AC-23, AC-24 | Keyboard order, focus, labels, roles, and announcements | `e2e/lab-03/accessibility.spec.ts` | No critical accessibility issues | Planned |
| E2E-01 | E2E | AC-01, AC-02, AC-03, AC-04, AC-05 | Login, first password change, shell, and logout | `e2e/lab-03/authentication.spec.ts` | Full auth flow passes | Planned |
| E2E-02 | E2E | AC-06, AC-07, AC-08 | Requester regression, comments, resolution, and isolation | `e2e/lab-03/requester-flow.spec.ts` | Requester flow passes | Planned |
| E2E-03 | E2E | AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15 | Staff queue, detail, assignment, workflow, comments, notes, and attachments | `e2e/lab-03/staff-ticket-flow.spec.ts` | Staff flow passes | Planned |
| E2E-04 | E2E | AC-16, AC-17, AC-18, AC-19, AC-20 | Admin list, create/edit, reset, and safety rules | `e2e/lab-03/user-administration.spec.ts` | Admin flow passes | Planned |
| RELEASE-01 | Release | AC-25 | Final migration, seed, tests, builds, E2E, and main verification | Final commands recorded here | All required checks pass with no skips | Planned |

## Issue #45 Verification

These results are from `feature/lab3-04-requester-authorization` before the pull request:

- Server: `npm test -- --reporter=dot` — 53 tests passed.
- Client: `npm test -- --reporter=dot` — 34 tests passed.
- Server and client TypeScript production builds passed.
- `git diff --check` passed.

The final Lab 3 release verification remains in `RELEASE-01` and will be recorded after the
release branch is merged and checked from `main`.

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
| AC-09 | UNIT-03, API-10, UI-05, E2E-03 |
| AC-10 | UNIT-03, API-05, API-10, UI-05, E2E-03 |
| AC-11 | API-11, UI-06, E2E-03 |
| AC-12 | UNIT-04, API-11, API-12, UI-06, E2E-03 |
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
| AC-23 | STYLE-01, A11Y-01 |
| AC-24 | STYLE-01, RESP-01, RESP-02, RESP-03, A11Y-01 |
| AC-25 | RELEASE-01 |

## 4. Required Repository Test Files

Server API/integration tests:

```text
server/tests/lab-03/
├── password-rules.test.ts
├── password-hash.test.ts
├── queue-options.test.ts
├── status-transition.test.ts
├── comment-validation.test.ts
├── auth.api.test.ts
├── authorization.api.test.ts
├── data-foundation.test.ts
├── requester-regression.api.test.ts
├── requester-comments.api.test.ts
├── staff-queue.api.test.ts
├── staff-ticket-detail.api.test.ts
├── comments-notes.api.test.ts
└── users-admin.api.test.ts
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
├── UserManagement.test.tsx
└── ui-style.test.tsx
```

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
├── authentication/
├── requester/
├── staff-queue/
├── staff-ticket-detail/
└── user-management/
```

## 5. Planned Commands

```bash
# From the repository root after PostgreSQL is running
cd server
npx prisma migrate deploy
npm run prisma:seed
npm test -- tests/lab-03 --reporter=dot
npm test -- tests/lab-02 --reporter=dot
npm run build

cd ../client
npm test -- --reporter=dot
npm run build

cd ..
npm run test:e2e
```

The final release check will run these commands from `main` after the release
PR is merged. Results, test counts, build output, migration status, seed
verification, and merge commit will be added to this file without leaving any
required test marked `Pending`.

## 6. Manual Evidence Checklist

- [ ] Valid login and invalid login.
- [ ] Inactive-account safe feedback.
- [ ] Busy login state and logout.
- [ ] Mandatory first-login password change.
- [ ] Requester regression without a requester selector.
- [ ] IT Staff queue with realistic data, filters, sorting, pagination, and badges.
- [ ] IT Staff claim/reassign, priority, status, comments, notes, and attachment continuity.
- [ ] Administrator user list, search, role filter, create, edit, activation, and password reset.
- [ ] Duplicate email, invalid role, self-deactivation, and last-admin safety feedback.
- [ ] Forbidden direct API access for each protected role boundary.
- [ ] Desktop, tablet, and mobile screenshots for all major screens.
- [ ] Visible keyboard focus, labels, ARIA states, no clipping, and no horizontal overflow.

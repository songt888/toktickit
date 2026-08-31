# Lab 2 Test Plan and Results

## 1. Test Strategy

Tests are planned from the engineering specification before implementation. Unit tests cover deterministic rules, API tests cover PostgreSQL and ownership contracts, UI tests cover component states and interaction, style tests cover required classes and accessible labels, responsive checks use Playwright viewports, and E2E tests cover the full requester workflow.

No required test may be skipped, disabled, or reconstructed after implementation. Each test below maps to at least one acceptance criterion.

## 2. Planned Tests

| Test ID | Level | Acceptance Criteria | What it tests | Test file | Expected result | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-03 | Ticket Number format and uniqueness input | `server/tests/lab-02/ticket-number.test.ts` | Valid unique format | Pass (2 tests) |
| UNIT-02 | Unit | AC-04, AC-12 | Ticket and attachment validation boundaries | `server/tests/lab-02/validation.test.ts` | Invalid input rejected | Pass (3 tests) |
| UNIT-03 | Unit | AC-08 | Query parsing, permitted sort, and pagination | `server/tests/lab-02/query-options.test.ts` | Stable safe options | Pass (4 tests) |
| API-01 | API | AC-01, AC-02 | Active requester retrieval | `server/tests/lab-02/requesters.api.test.ts` | Active users only | Pass (1 test) |
| API-02 | API | AC-03, AC-04 | Valid and invalid ticket creation | `server/tests/lab-02/create-ticket.api.test.ts` | 201 or documented 400 | Pass (2 tests) |
| API-03 | API | AC-03 | Ticket Number, status, and requesterId persistence | `server/tests/lab-02/create-ticket.api.test.ts` | Saved values correct | Pass (1 test) |
| API-04 | API | AC-06, AC-07, AC-08 | Owned list, search, filters, sort, pagination | `server/tests/lab-02/my-tickets.api.test.ts` | Correct items and metadata | Pass (4 tests) |
| API-05 | API | AC-09, AC-10 | Owned detail and cross-requester rejection | `server/tests/lab-02/ticket-detail.api.test.ts` | Owned 200, other 404 | Pass (3 tests) |
| API-06 | API | AC-11, AC-12, AC-13, AC-14 | Attachment lifecycle and ownership | `server/tests/lab-02/attachments.api.test.ts` | Rules enforced | Pass (5 tests) |
| API-07 | Integration | AC-02, AC-03, AC-04 | Migration-backed seed, active/inactive reference data, and idempotent rerun | `server/tests/lab-02/data-foundation.test.ts`; `server/tests/lab-02/seed.test.ts` | Schema, active-reference, and seed rules pass | Pass (3 tests) |
| API-08 | API | AC-17 | Missing, malformed, unknown, and inactive requester context | `server/tests/lab-02/ticket-detail.api.test.ts` | Safe 400/404 responses | Pass (1 test; 4 scenarios) |
| UI-01 | UI | AC-01, AC-02 | Requester selection loading, empty, failure, validation, persistence, and switching | `client/tests/lab-02/RequesterSelection.test.tsx` | Correct states | Pass (5 tests) |
| UI-02 | UI | AC-03, AC-04, AC-05, AC-12 | Create Ticket fields, validation, busy, success, failure | `client/tests/lab-02/CreateTicket.test.tsx` | Correct UI behavior | Pass (6 tests) |
| UI-03 | UI | AC-06, AC-07, AC-08 | My Tickets list controls and states | `client/tests/lab-02/MyTickets.test.tsx` | Correct list behavior | Pass (7 tests) |
| UI-04 | UI | AC-09, AC-10 | Read-only Ticket Detail and safe failure | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Correct access behavior | Pass (3 tests) |
| UI-05 | UI | AC-11, AC-13, AC-14 | Attachment states, reason, and blocked removed file | `client/tests/lab-02/AttachmentSection.test.tsx` | Correct attachment behavior | Pass (3 tests) |
| STYLE-01 | UI style | AC-04, AC-15 | Required classes, labels, errors, focus, buttons | `client/tests/lab-02/ui-style.test.tsx` | Contract styles present | Pending |
| RESP-01 | Responsive | AC-15 | Desktop viewport and screenshot | `e2e/lab-02/requester-ticket-flow.spec.ts` | No clipping/overflow | Pending |
| RESP-02 | Responsive | AC-15 | Tablet viewport and screenshot | `e2e/lab-02/requester-ticket-flow.spec.ts` | No clipping/overflow | Pending |
| RESP-03 | Responsive | AC-15 | Mobile viewport and screenshot | `e2e/lab-02/requester-ticket-flow.spec.ts` | No clipping/overflow | Pending |
| E2E-01 | E2E | AC-01, AC-03, AC-06, AC-09 | Select requester, create, list, and detail | `e2e/lab-02/requester-ticket-flow.spec.ts` | Complete flow passes | Pending |
| E2E-02 | E2E | AC-07, AC-10 | Switch requester and reject cross-owner access | `e2e/lab-02/requester-ticket-flow.spec.ts` | Data isolation passes | Pending |
| E2E-03 | E2E | AC-11, AC-13, AC-14 | Upload, download, soft-remove, blocked download | `e2e/lab-02/requester-ticket-flow.spec.ts` | Attachment flow passes | Pending |
| RELEASE-01 | Release | AC-16 | Run the final server, client, build, migration/seed, and Playwright verification suite from `main` with no skipped tests | `server/tests/lab-02/ticket-number.test.ts`; `server/tests/lab-02/validation.test.ts`; `server/tests/lab-02/query-options.test.ts`; `server/tests/lab-02/requesters.api.test.ts`; `server/tests/lab-02/create-ticket.api.test.ts`; `server/tests/lab-02/my-tickets.api.test.ts`; `server/tests/lab-02/ticket-detail.api.test.ts`; `server/tests/lab-02/attachments.api.test.ts`; `server/tests/lab-02/seed.test.ts`; `client/tests/lab-02/RequesterSelection.test.tsx`; `client/tests/lab-02/CreateTicket.test.tsx`; `client/tests/lab-02/MyTickets.test.tsx`; `client/tests/lab-02/RequesterTicketDetail.test.tsx`; `client/tests/lab-02/AttachmentSection.test.tsx`; `client/tests/lab-02/ui-style.test.tsx`; `e2e/lab-02/requester-ticket-flow.spec.ts` | All documented checks pass from `main` | Pending |

## 3. Acceptance-Criterion Traceability

| Acceptance Criteria | Planned tests |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-01, API-07, UI-01 |
| AC-03 | UNIT-01, API-02, API-03, UI-02, E2E-01 |
| AC-04 | UNIT-02, API-02, UI-02 |
| AC-05 | UI-02, E2E-01 |
| AC-06 | API-04, UI-03, E2E-01 |
| AC-07 | API-04, UI-03, E2E-02 |
| AC-08 | UNIT-03, API-04, UI-03 |
| AC-09 | API-05, UI-04, E2E-01 |
| AC-10 | API-05, UI-04, E2E-02 |
| AC-11 | API-06, UI-05, E2E-03 |
| AC-12 | UNIT-02, API-06, UI-02, UI-05 |
| AC-13 | API-06, UI-05, E2E-03 |
| AC-14 | API-06, UI-05, E2E-03 |
| AC-15 | STYLE-01, RESP-01, RESP-02, RESP-03 |
| AC-16 | RELEASE-01 |
| AC-17 | API-08 |

## 4. Responsive and Visual Checklist

- [ ] Desktop is tested at 992px or wider.
- [ ] Tablet is tested from 768px to 991px.
- [ ] Mobile is tested below 768px.
- [ ] No clipped labels, overlapping messages, hidden buttons, or horizontal page scrolling.
- [ ] Read-only fields are visually distinct and readable.
- [ ] Required markers and validation messages are near their fields.
- [ ] Primary, secondary, destructive, disabled, and busy buttons are distinguishable.
- [ ] Attachment names remain readable.
- [ ] Focus indicators and non-color error/success indicators are visible.
- [ ] Desktop ticket table and mobile ticket cards/responsive table are usable.

## 5. Test Commands

```bash
cd server
npm test
npm run build
npx prisma migrate deploy
npm run prisma:seed

cd ../client
npm test
npm run build

cd ..
npx playwright test
```

## 6. Final Results

Final results will be filled from the final `main` branch only. Passing terminal output and readable screenshots will be placed below each relevant section before submission.

| Level | Command/result | Final status |
|---|---|---|
| Unit | Server unit tests | Pending implementation |
| API/integration | Server API and seed tests | Pending implementation |
| UI | Client Vitest tests | Pending implementation |
| Responsive/visual | Playwright screenshots and checklist | Pending implementation |
| E2E | Requester ticket flow | Pending implementation |

### Issue 18 verification on the feature branch

The following checks passed after starting the PostgreSQL container configured for `server/.env`:

```text
npx prisma migrate deploy
2 migrations found; both migrations applied successfully.

npm run prisma:seed
Seeded 5 categories, 7 related systems, and 5 requesters.

npm run prisma:seed
Seeded 5 categories, 7 related systems, and 5 requesters.

npm test -- tests/lab-02
Test Files  2 passed (2)
Tests       3 passed (3)

npm test
Test Files  5 passed (5)
Tests       7 passed (7)

npm run build
TypeScript build completed successfully.
```

This is feature-branch evidence for Issue 18. The final-results table remains pending until the complete Lab 2 suite is verified from `main`.

### Issue 20 verification on the feature branch

The Create Ticket API and UI checks passed after the Issue #20 implementation:

```text
server: npm run build
TypeScript build completed successfully.

server: npm test
Test Files  9 passed (9)
Tests       17 passed (17)

client: npm run build
Vite production build completed successfully.

client: npm test
Test Files  3 passed (3)
Tests       14 passed (14)
```

The API evidence covers active Related System retrieval, requester-context validation, active reference validation, sequence-formatted Ticket Numbers, persisted requester/category/system values, and `NEW` status. The UI evidence covers API-loaded fields, field-level validation, duplicate-submit prevention, generated-number success, preserved values after failure, and invalid attachment type/size/count messages.

### Issue 21 verification on the feature branch

The My Tickets API and UI checks passed after the Issue #21 implementation. The API tests use PostgreSQL-backed tickets for two requesters and verify ownership isolation, response shape, search, filters, sorting, pagination, and invalid requester/query handling. The UI tests verify API-backed rendering, controls, empty/no-results/error states, retry behavior, pagination, Create Ticket navigation, and requester switching.

```text
server: npm run prisma:seed
Seeded 5 categories, 7 related systems, and 5 requesters.

server: npm run build
TypeScript build completed successfully.

server: npm test -- --reporter=dot
Test Files  11 passed (11)
Tests       25 passed (25)

client: npm run build
Vite production build completed successfully.

client: npm test -- --reporter=dot
Test Files  4 passed (4)
Tests       20 passed (20)
```

The branch-level evidence is complete for Issue #21. The UI regression coverage includes request sequencing and value-specific priority/status badge classes. Final release verification remains pending until the approved pull request is merged and the complete Lab 2 suite is run from `main`.

### Issue 22 verification on the feature branch

The Ticket Detail API and UI checks cover owner-only access, safe cross-requester and not-found responses, requester-context validation, read-only ticket fields, attachment metadata including removed records, loading, failure, retry, and back navigation to My Tickets.

```text
server: npm run build
TypeScript build completed successfully.

server: npm test -- --reporter=dot
Test Files  12 passed (12)
Tests       28 passed (28)

client: npm run build
Vite production build completed successfully.

client: npm test -- --reporter=dot
Test Files  5 passed (5)
Tests       24 passed (24)
```

The branch-level evidence is complete for Issue #22. Final release verification remains pending until the approved pull request is merged and the complete Lab 2 suite is run from `main`.

### Issue 23 verification on the feature branch

The Attachment lifecycle API and UI checks cover permitted uploads, generated storage names,
metadata retrieval, active-file download, five-active-file enforcement, upload failure handling,
owner isolation, soft removal with a required reason, retained removed metadata, and blocked
removed-file download. Uploads are written under the ignored `server/uploads/` directory.

```text
server: npm run build
TypeScript build completed successfully.

server: npm test -- --reporter=dot
Test Files  13 passed (13)
Tests       33 passed (33)

client: npm run build
Vite production build completed successfully.

client: npm test -- --reporter=dot
Test Files  6 passed (6)
Tests       28 passed (28)
```

The branch-level evidence is complete for Issue #23. Final release verification remains pending until the approved pull request is merged and the complete Lab 2 suite is run from `main`.

## 7. Known Limitations or Deferred Tests

- Real authentication and role-based authorization are deferred to Lab 3.
- IT Staff workflow and collaboration features are outside Lab 2.
- Local attachment storage is a Lab 2 demonstration choice and must not be treated as production storage.

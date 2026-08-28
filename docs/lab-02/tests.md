# Lab 2 Test Plan and Results

## 1. Test Strategy

Tests are planned from the engineering specification before implementation. Unit tests cover deterministic rules, API tests cover PostgreSQL and ownership contracts, UI tests cover component states and interaction, style tests cover required classes and accessible labels, responsive checks use Playwright viewports, and E2E tests cover the full requester workflow.

No required test may be skipped, disabled, or reconstructed after implementation. Each test below maps to at least one acceptance criterion.

## 2. Planned Tests

| Test ID | Level | Acceptance Criteria | What it tests | Test file | Expected result | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-03 | Ticket Number format and uniqueness input | `server/tests/lab-02/ticket-number.test.ts` | Valid unique format | Pending |
| UNIT-02 | Unit | AC-04, AC-12 | Ticket and attachment validation boundaries | `server/tests/lab-02/validation.test.ts` | Invalid input rejected | Pending |
| UNIT-03 | Unit | AC-08 | Query parsing, permitted sort, and pagination | `server/tests/lab-02/query-options.test.ts` | Stable safe options | Pending |
| API-01 | API | AC-01, AC-02 | Active requester retrieval | `server/tests/lab-02/requesters.api.test.ts` | Active users only | Pass (1 test) |
| API-02 | API | AC-03, AC-04 | Valid and invalid ticket creation | `server/tests/lab-02/create-ticket.api.test.ts` | 201 or documented 400 | Pending |
| API-03 | API | AC-03 | Ticket Number, status, and requesterId persistence | `server/tests/lab-02/create-ticket.api.test.ts` | Saved values correct | Pending |
| API-04 | API | AC-06, AC-07, AC-08 | Owned list, search, filters, sort, pagination | `server/tests/lab-02/my-tickets.api.test.ts` | Correct items and metadata | Pending |
| API-05 | API | AC-09, AC-10 | Owned detail and cross-requester rejection | `server/tests/lab-02/ticket-detail.api.test.ts` | Owned 200, other 404 | Pending |
| API-06 | API | AC-11, AC-12, AC-13, AC-14 | Attachment lifecycle and ownership | `server/tests/lab-02/attachments.api.test.ts` | Rules enforced | Pending |
| API-07 | Integration | AC-02, AC-03, AC-04 | Migration-backed seed, active/inactive reference data, and idempotent rerun | `server/tests/lab-02/data-foundation.test.ts`; `server/tests/lab-02/seed.test.ts` | Schema, active-reference, and seed rules pass | Pass (3 tests) |
| API-08 | API | AC-17 | Missing, malformed, unknown, and inactive requester context | `server/tests/lab-02/requester-context.api.test.ts` | Safe 400/404 responses | Pending |
| UI-01 | UI | AC-01, AC-02 | Requester selection loading, empty, failure, validation, persistence, and switching | `client/tests/lab-02/RequesterSelection.test.tsx` | Correct states | Pass (5 tests) |
| UI-02 | UI | AC-03, AC-04, AC-05, AC-12 | Create Ticket fields, validation, busy, success, failure | `client/tests/lab-02/CreateTicket.test.tsx` | Correct UI behavior | Pending |
| UI-03 | UI | AC-06, AC-07, AC-08 | My Tickets list controls and states | `client/tests/lab-02/MyTickets.test.tsx` | Correct list behavior | Pending |
| UI-04 | UI | AC-09, AC-10 | Read-only Ticket Detail and safe failure | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Correct access behavior | Pending |
| UI-05 | UI | AC-11, AC-13, AC-14 | Attachment states, reason, and blocked removed file | `client/tests/lab-02/AttachmentSection.test.tsx` | Correct attachment behavior | Pending |
| STYLE-01 | UI style | AC-04, AC-15 | Required classes, labels, errors, focus, buttons | `client/tests/lab-02/ui-style.test.tsx` | Contract styles present | Pending |
| RESP-01 | Responsive | AC-15 | Desktop viewport and screenshot | `e2e/lab-02/requester-ticket-flow.spec.ts` | No clipping/overflow | Pending |
| RESP-02 | Responsive | AC-15 | Tablet viewport and screenshot | `e2e/lab-02/requester-ticket-flow.spec.ts` | No clipping/overflow | Pending |
| RESP-03 | Responsive | AC-15 | Mobile viewport and screenshot | `e2e/lab-02/requester-ticket-flow.spec.ts` | No clipping/overflow | Pending |
| E2E-01 | E2E | AC-01, AC-03, AC-06, AC-09 | Select requester, create, list, and detail | `e2e/lab-02/requester-ticket-flow.spec.ts` | Complete flow passes | Pending |
| E2E-02 | E2E | AC-07, AC-10 | Switch requester and reject cross-owner access | `e2e/lab-02/requester-ticket-flow.spec.ts` | Data isolation passes | Pending |
| E2E-03 | E2E | AC-11, AC-13, AC-14 | Upload, download, soft-remove, blocked download | `e2e/lab-02/requester-ticket-flow.spec.ts` | Attachment flow passes | Pending |
| RELEASE-01 | Release | AC-16 | Run the final server, client, build, migration/seed, and Playwright verification suite from `main` with no skipped tests | `server/tests/lab-02/ticket-number.test.ts`; `server/tests/lab-02/validation.test.ts`; `server/tests/lab-02/query-options.test.ts`; `server/tests/lab-02/requesters.api.test.ts`; `server/tests/lab-02/create-ticket.api.test.ts`; `server/tests/lab-02/my-tickets.api.test.ts`; `server/tests/lab-02/ticket-detail.api.test.ts`; `server/tests/lab-02/attachments.api.test.ts`; `server/tests/lab-02/seed.test.ts`; `server/tests/lab-02/requester-context.api.test.ts`; `client/tests/lab-02/RequesterSelection.test.tsx`; `client/tests/lab-02/CreateTicket.test.tsx`; `client/tests/lab-02/MyTickets.test.tsx`; `client/tests/lab-02/RequesterTicketDetail.test.tsx`; `client/tests/lab-02/AttachmentSection.test.tsx`; `client/tests/lab-02/ui-style.test.tsx`; `e2e/lab-02/requester-ticket-flow.spec.ts` | All documented checks pass from `main` | Pending |

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

## 7. Known Limitations or Deferred Tests

- Real authentication and role-based authorization are deferred to Lab 3.
- IT Staff workflow and collaboration features are outside Lab 2.
- Local attachment storage is a Lab 2 demonstration choice and must not be treated as production storage.

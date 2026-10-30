# Lab 4 Engineering Specification

Status: Proposed contract for [Issue #65](https://github.com/songt888/toktickit/issues/65),
awaiting formal peer approval. Date: 2026-10-05 (Asia/Bangkok).
Baseline: released `main` at `9313209d224592c9265bb8595aa7cc0f1336b9db`.
No Lab 4 feature or migration is implemented by this PR.

Source: CPE334 Lab 4 handout, sections 1-13 and Answer Parts 1-9, supplied as
`SE+Lab+4.pdf`. This contract extends [Lab 3](../lab-03/specification.md).
FR/BR/AC identifiers below are local to Lab 4. Implementation begins only
after this contract is approved and merged into `lab4-staging`.

## 1. Sprint goal and stakeholder interpretation

Complete the service-desk workflow with traceable Actions Taken, a backend
resolution gate, and concise dashboards linked to the existing detailed
screens. A Ticket Owner coordinates the Ticket; multiple operational users
can record work and receive individual Action assignments. Requesters see
shared work and their own metrics while retaining their existing workflows.

## 2. Scope

Included: Action list/create/assign/edit/status/complete/cancel, immutable
revision and Ticket-status history, all eight Ticket statuses, Requester and
Staff dashboards (Administrator reuses Staff), data-preserving migrations,
repeatable seed, authorization, concurrency, retry safety, responsive Zen Green
UI, regression, accessibility, performance-smoke and release evidence.

Excluded: SLA clocks, escalation, on-call scheduling/breach notifications,
email/SMS/LINE/push services, inventory/spare parts/purchasing/cost accounting,
timesheet billing/payroll/labor costing, multi-level approvals/e-signatures,
advanced BI/report builders/export warehouses, multitenancy/production cloud
operations and unapproved features. Action Attachment Notes are plain text;
there is no new Action file-upload system. No submission PDF is authorized.

## 3. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Operational users list, create and view Actions under a Ticket, independently of primary Ticket ownership. |
| FR-02 | Record action date/time, description, result, automatic performer, assignee, status, follow-up flag/note and attachment notes. |
| FR-03 | Assign/reassign, edit, start, complete and cancel Actions under the specified lifecycle. |
| FR-04 | Preserve every committed Action revision and Ticket-status event with actor and stable ordering. |
| FR-05 | Owning Requesters read all Actions and shared history; only operational users write. |
| FR-06 | Enforce Ticket transitions and the resolution gate on the backend; Requester resolution remains advisory. |
| FR-07 | Requester Dashboard shows own attention-required/recent work and precise metrics/drill-downs. |
| FR-08 | Staff/Admin Dashboard shows authoritative operational metrics, current-user Actions and bounded recent/urgent work. |
| FR-09 | Preserve populated Lab 1-3 data, migrate safely and seed realistic zero/non-zero cases repeatedly. |
| FR-10 | Protect stale/concurrent writes and repeated submissions; preserve drafts on recoverable failures. |
| FR-11 | Extend the shell and Zen Green UI with complete feedback, responsive layouts and keyboard access. |
| FR-12 | Verify Labs 1-4 regression and release from main, with real review, test, AI-use and submission evidence. |

## 4. Business rules

| ID | Binding rule |
|---|---|
| BR-01 | An Action belongs to exactly one existing Ticket. Neither its Ticket nor its original performer can change. |
| BR-02 | Ticket Owner and Action assignee are separate. Any active Staff/Admin can record work, regardless of owner; `performedById` is the authenticated creator, not a client-selected user or necessarily the assignee. Later revision actors are recorded separately. |
| BR-03 | Action assignee is required and must be an active `IT_STAFF` or `ADMINISTRATOR`. Create defaults to the current user. Reassignment does not reassign the Ticket. No Action unassign operation is provided. |
| BR-04 | Description: trimmed 1-4000 characters. Result: trimmed 0-4000 while pending, 1-4000 when completed. Follow-up/attachment notes: trimmed 0-2000. Cancel reason: trimmed 5-500. Text is literal, never HTML. Unknown/write-protected input fields are rejected with 400. |
| BR-05 | `actionAt` is a valid offset-qualified ISO timestamp, normalized to UTC, between Ticket `ticketDate` and server now inclusive. `createdAt`/`updatedAt` are backend-controlled UTC timestamps. No future work schedule is added. |
| BR-06 | `followUpRequired=true` requires a trimmed non-empty follow-up note. False stores `followUpNote=null`; a supplied non-empty note with false is 400. A completed Action may retain follow-up; staff subsequently clear it through an audited edit after addressing it. |
| BR-07 | New Action status is `PLANNED`. Permitted moves: PLANNED -> IN_PROGRESS/COMPLETED/CANCELLED; IN_PROGRESS -> COMPLETED/CANCELLED. COMPLETED and CANCELLED have no next statuses. Same-status requests are rejected (409). |
| BR-08 | PLANNED/IN_PROGRESS descriptive fields and assignee are editable. COMPLETED permits descriptive/follow-up and assignee corrections, but no status changes; result stays non-empty. CANCELLED is read-only. Completion requires a result; cancellation requires `confirm=true` and a reason. |
| BR-09 | Reject writes with an inactive/ineligible assignee (400), including start/complete and descriptive edits. Staff may reassign to an eligible user; cancellation is permitted without reactivating the old assignee. Existing assignments/history remain readable after user deactivation or role change. |
| BR-10 | Action writes are allowed only while parent status is NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER/REOPENED. On RESOLVED/CLOSED/CANCELLED, return 409 until an operational user reopens the Ticket. Ticket cancellation does not silently alter Action history. |
| BR-11 | Action current projection is editable only with an appended full revision in the same transaction. Revisions and Ticket-status events, Public Comments and Internal Notes cannot be edited/deleted; Actions/Tickets have no delete API. Attachment soft removal remains the existing exception. |
| BR-12 | Only the Ticket matrix below is permitted. Staff/Admin alone perform formal transitions. CLOSED/CANCELLED require confirmation. Requested Priority is unchanged by IT Priority or workflow changes. |
| BR-13 | Entering RESOLVED requires at least one COMPLETED Action, every Action COMPLETED or CANCELLED, and no COMPLETED Action with `followUpRequired=true`. Zero Actions or only cancelled Actions fail. Requester advisory resolution is neither necessary nor sufficient. |
| BR-14 | Existing legacy RESOLVED/CLOSED Tickets retain their state and may follow the matrix without fabricated Actions. Any future transition into RESOLVED, including a reopened legacy Ticket, must pass BR-13. No automatic status change during migration. |
| BR-15 | Every Action write requires latest Action version (updates) and Ticket `updatedAt`. All Action/workflow/owner/priority mutations lock the parent Ticket first, verify last-seen values and commit atomically. All writes touching Ticket updatedAt, including Action mutations and Requester advisory writes, advance it strictly by at least 1ms. |
| BR-16 | Lock order is Ticket, then involved Users in ascending id (actor/assignee or target of Admin role/activation write), then Action. Admin activation/role changes participate in the User lock so eligibility cannot race assignment. Gate check, Action write and Ticket transition cannot commit inconsistent work. |
| BR-17 | Action writes carry a UUID `mutationId`, unique per authenticated actor. Same authorized command/payload/id replays the committed result without another Action/revision; a different command/payload using that id returns 409. Lost-response retries reuse the id; edited submissions use a new id. |
| BR-18 | Authentication/session/password gates and same-origin checks remain from Lab 3. Requester identity is session-derived; own Action write is 403, cross-owner Action/history reads/writes are indistinguishable safe 404. No hash/token/internal note appears in shared Action data. |
| BR-19 | Lists have stable ordering: Actions `actionAt ASC, id ASC`; revisions `version ASC`; Ticket events `createdAt ASC, id ASC`; recent Tickets `updatedAt DESC, id DESC`; current-user Actions `updatedAt DESC, id DESC`. Paginated Action/history lists accept `page` >= 1 (default 1) and pageSize 10/25/50. |
| BR-20 | Metrics and lists use one backend REPEATABLE READ snapshot and one captured UTC `asOf`. Counts are computed in PostgreSQL, never from a displayed page. Recent window is the trailing 7*24 hours, inclusive lower bound and inclusive `asOf`; display timezone is Asia/Bangkok. |
| BR-21 | Active Ticket set is NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER/REOPENED. Dashboard formulas/drill-down predicates in section 7 are authoritative and always combined with role/ownership scope. Every status/priority bucket is returned, including zero. |
| BR-22 | Recent/urgent Ticket lists and current-user Action list each contain at most five items. Empty counts are 0 and empty lists `[]`. No full collection is returned by a dashboard. |
| BR-23 | Additive migration preserves existing ids, FKs, content, timestamps, hashes, sessions, files and sequence state. Legacy `lastResolvedAt` is null (unknown), never guessed from `updatedAt`. Seed never rewinds sequences or overwrites real passwords/work. |
| BR-24 | Loading/saving/validation/success/empty/no-results/401/403/404/409/safe-500 states are distinct. A 400/409/500/network failure retains the non-secret form draft; refresh never silently overwrites it. Logout/identity change clears prior user's draft/data. |
| BR-25 | Prevent double-clicks while saving, ignore obsolete responses, use returned versions for subsequent writes, refresh dashboard on entry/explicit Refresh and after successful relevant writes. A 409 clears previous confirmation and requires review before retry. |
| BR-26 | At 1280/820/390px every major screen retains labels, visible focus, meaningful status text and reachable actions without unintended page overflow. Required tests remain Planned until executed; peer approval and reviewed main release are completion gates. |

### Ticket transition matrix (BR-12)

| Current | Permitted next status |
|---|---|
| NEW | OPEN, IN_PROGRESS, CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED (BR-13), CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, REOPENED, CANCELLED |
| RESOLVED | CLOSED, REOPENED |
| CLOSED | REOPENED |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED |
| CANCELLED | REOPENED |

This retains Lab 3's permitted pairs and adds the resolution predicate. Reopening
does not erase completed work or rewrite Requester advisory history. Same-state
requests and every other pair return 409 without a status event.

## 5. Authorization matrix

All protected reads/writes require an active session with password change completed.

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| List/view Actions, revisions, Ticket-status history | Owned Ticket only | All operational Tickets | Same as Staff |
| Create/edit/reassign/complete/cancel Action | No | Yes, BR-03 to BR-10 | Same as Staff |
| Formal Ticket workflow, owner and IT Priority | No | Yes | Same as Staff |
| Requester advisory resolution | Owned Ticket only | No | No |
| Requester Dashboard/list drill-down | Own data only | No | No |
| Staff Dashboard/current-user Actions | No | Operational data; own assignments | Same; current Admin's assignments |
| Internal Notes | No | Yes | Yes |
| User administration | No | No | Yes (existing Admin safety rules) |

Action descriptions/results/notes and revision history are shared with the
owning Requester. Staff must use Internal Notes for private information; there
is no hidden/private Action subtype. Existing upload/removal remains
Requester-owner only; permitted operational downloads remain available.

## 6. Data contract and preservation

Proposed Prisma increment for Issue #66, not a change to the current schema:

```prisma
enum ActionStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum ActionOperation {
  CREATE
  EDIT
  ASSIGN
  STATUS
}

model ActionTaken {
  id                 Int                   @id @default(autoincrement())
  ticketId           Int
  performedById      Int
  assigneeId         Int
  actionAt           DateTime
  description        String                @db.VarChar(4000)
  result             String                @default("") @db.VarChar(4000)
  followUpRequired   Boolean               @default(false)
  followUpNote       String?               @db.VarChar(2000)
  attachmentNotes    String?               @db.VarChar(2000)
  status             ActionStatus          @default(PLANNED)
  cancellationReason String?               @db.VarChar(500)
  version            Int                   @default(1)
  createdAt          DateTime              @default(now())
  updatedAt          DateTime              @updatedAt
  ticket             Ticket                @relation(fields: [ticketId], references: [id], onDelete: Restrict)
  performedBy        User                  @relation("ActionPerformer", fields: [performedById], references: [id], onDelete: Restrict)
  assignee           User                  @relation("ActionAssignee", fields: [assigneeId], references: [id], onDelete: Restrict)
  revisions          ActionTakenRevision[]

  @@index([ticketId, actionAt, id])
  @@index([ticketId, status])
  @@index([assigneeId, status, updatedAt, id])
}

model ActionTakenRevision {
  id              Int             @id @default(autoincrement())
  actionId        Int
  version         Int
  actorId         Int
  operation       ActionOperation
  mutationId      String          @db.Uuid
  requestHash     String          @db.Char(64)
  snapshot        Json
  ticketUpdatedAt DateTime
  createdAt       DateTime        @default(now())
  action          ActionTaken     @relation(fields: [actionId], references: [id], onDelete: Restrict)
  actor           User            @relation("ActionRevisionActor", fields: [actorId], references: [id], onDelete: Restrict)

  @@unique([actionId, version])
  @@unique([actorId, mutationId])
}

model TicketStatusEvent {
  id         Int          @id @default(autoincrement())
  ticketId   Int
  actorId    Int
  fromStatus TicketStatus?
  toStatus   TicketStatus
  createdAt  DateTime     @default(now())
  ticket     Ticket       @relation(fields: [ticketId], references: [id], onDelete: Restrict)
  actor      User         @relation("TicketStatusActor", fields: [actorId], references: [id], onDelete: Restrict)

  @@index([ticketId, createdAt, id])
}
```

Add `Ticket.actionsTaken ActionTaken[]`, `Ticket.statusEvents TicketStatusEvent[]`,
`Ticket.lastResolvedAt DateTime?`, and index `[lastResolvedAt, id]`.
Add User inverse relations `performedActions` (ActionPerformer),
`assignedActions` (ActionAssignee), `actionRevisions` (ActionRevisionActor) and
`ticketStatusEvents` (TicketStatusActor). Existing models/enums/relations remain.
`lastResolvedAt` is server set on each successful entry into RESOLVED and
retained through closure/reopening; recent-resolution metrics additionally
filter current status. New Ticket creation appends null -> NEW with its
Requester actor; legacy Tickets receive no invented historical events.

Revision `snapshot` contains every Action scalar field listed above, timestamps
as UTC ISO strings, and the historical safe performer/assignee DTOs from the
API (`{id,name}` / `{id,name,role,isActive}`). It
excludes User secrets, email, Ticket/Internal Note content and storage paths.
`actorId`/operation/version/createdAt identify who changed it; retain safe actor
name at revision time in `snapshot.actorName`. Request hash is SHA-256 of the
normalized method/path/command/body (including last-seen values), not a secret.
Replay uses this snapshot and `ticketUpdatedAt`, never recomputes old results.

Database checks: `version>=1`, non-blank description, result length, non-blank
follow-up note when required, null follow-up note when false, non-blank result
when COMPLETED, cancellation reason only/required for CANCELLED. A trigger
rejects UPDATE/DELETE on ActionTakenRevision and TicketStatusEvent, including
direct SQL. Another Action trigger prevents changing id/ticketId/performer/
createdAt and enforces version increments. A deferred constraint trigger checks
at commit that the current Action's version has a matching full scalar snapshot
revision (including creation), so projection-only writes cannot commit.
Datetime relative to Ticket and assignee eligibility are checked
inside the locking transaction, since cross-row CHECK constraints are unsuitable.

### Design decisions and migration/seed

1. **Separate current projection and append-only revisions:** assignment/editing
   in Answer Part 6 remains usable while committed evidence in Part 7 cannot
   be overwritten. A JSON full snapshot keeps one revision row per mutation
   without duplicating another wide relational model. This is a proposed
   reconciliation requiring peer approval, not a claim the handout fixed it.
2. **Separate Ticket ownership, performer and assignee FKs:** one coordinator
   never prevents multiple people recording/receiving work. Restrict deletes
   preserves the historical identities; current role changes do not rewrite FKs.
3. **Reuse Ticket timestamp and lock the parent:** serializing writes per Ticket
   makes the cross-row gate atomic without replacing existing Lab 3 PATCH
   shapes; Action version integers prevent lost child updates.
4. **Nullable lastResolvedAt:** distinguishes unknown legacy dates from genuine
   resolution time and supports exact recent-resolution counts; unrelated edits
   must not turn an old resolution into a recent one.

Issue #66 uses an additive transactional migration: enums/tables/FKs/indexes,
nullable Ticket field and checks/triggers; no drops, identity remapping,
password resets or sequence rewinds. First test against an isolated populated
Lab 3 database and compare all existing rows/FKs/hashes/timestamps plus file
manifest. Deploy with `prisma migrate deploy`, regenerate Prisma client and
verify schema/migration drift. No legacy Action or transition backfill.

Recovery: retain a verified database backup and upload manifest before deploy;
failed transactional DDL rolls back, fix and redeploy. After new data is written,
prefer a reviewed forward repair and compatible application rollback retaining
new tables; never drop work to undo a deployment. Test snapshot restore and
forward repair on a disposable database, verify content/FKs/sequence advancement.
Do not reset/restore the user's live database to manufacture evidence.

Seed new fixtures with stable Ticket numbers and actor+mutation UUID keys,
create-if-missing semantics, one initial revision per Action and authentic
fixture status events. Cover eight statuses, four priorities, assigned/unassigned
Tickets, zero/one/multiple Actions, different performers/assignees, follow-up,
cancelled/completed/pending Actions, and independent empty Requester/Staff data.
Rerun twice and compare counts, timestamps, hashes, revisions and sequences;
existing fixture work is not reset. Preserve real passwords and role/activation
changes; initial demo passwords come only from environment. Update existing
seed helpers as needed in #66 rather than layering an unsafe reset over them.

## 7. Dashboard calculations and drill-downs

Let A be BR-21's active status set; T all Tickets visible to the operational
user; R = T filtered by `requesterId=session.user.id`; M be the current user's
PLANNED/IN_PROGRESS Actions whose Ticket is in A. Capture `asOf=server now`,
`recentFrom=asOf-7*24h`. Lower and upper bounds are both inclusive; future
timestamps are excluded. The window is rolling UTC, not Bangkok midnight.

| Dashboard metric/list | Authoritative predicate and order | Drill-down |
|---|---|---|
| Requester `openTickets` | count R with currentStatus in A | My Tickets: statusGroup=active |
| Requester `waitingForRequester` | count R with WAITING_FOR_REQUESTER | My Tickets: currentStatus=WAITING_FOR_REQUESTER |
| Requester `recentlyResolved` | count R with status RESOLVED/CLOSED and lastResolvedAt in [recentFrom,asOf] | My Tickets: statusGroup=resolved&resolvedFrom=recentFrom&resolvedTo=asOf |
| Requester `recentTickets` | R with updatedAt in [recentFrom,asOf], updatedAt DESC,id DESC, limit 5 | Each Ticket Detail; View all: updatedFrom=recentFrom&updatedTo=asOf |
| Staff/Admin `unassignedTickets` | count T in A with ownerId=null | Queue: statusGroup=active&ownerId=unassigned |
| Staff/Admin `myTickets` | count T in A with ownerId=session.user.id | Queue: statusGroup=active&ownerId=currentUserId |
| Staff/Admin `byStatus` | count T grouped over all eight currentStatus values | Queue: currentStatus=selectedStatus |
| Staff/Admin `byItPriority` | count T in A grouped over LOW/MEDIUM/HIGH/URGENT | Queue: statusGroup=active&itPriority=selectedPriority |
| Staff/Admin `myActions` | count M (assignment, not performer); list M by updatedAt DESC,id DESC, limit 5 | GET /api/staff/actions-taken?assigneeId=me&statusGroup=pending&ticketStatusGroup=active; each item opens its Ticket's Actions area |
| Staff/Admin `recentTickets` | T with updatedAt in [recentFrom,asOf], updatedAt DESC,id DESC, limit 5 | Queue: updatedFrom=recentFrom&updatedTo=asOf; each Ticket Detail |
| Staff/Admin `urgentTickets` | T in A with itPriority=URGENT, updatedAt DESC,id DESC, limit 5 | Queue: statusGroup=active&itPriority=URGENT; each Ticket Detail |

Zero Action legacy Tickets still contribute to Ticket counts. Unknown legacy
resolution timestamps are excluded from `recentlyResolved`, but not `byStatus`.
Action writes advance Ticket updatedAt; existing Lab 3 comment/attachment
behavior is retained and is not relabeled as a Ticket edit if it does not touch
that timestamp. No stored dashboard counters or client-side count inference.
Admin reuses these formulas; optional account counts are deliberately excluded.

The App currently navigates through state/callbacks, not a URL router. Implement
dashboard links with accessible buttons/callbacks carrying the exact API query
objects above into My Tickets/Queue/Detail; no new routing dependency required.
If shareable URLs are later adopted, their query predicates must remain identical.
Add statusGroup/date filtering and all eight Requester status filters as explicit
Lab 4 increments; those capabilities are not all implemented in the Lab 3 parser.

## 8. API and UI summary

[api-spec.md](api-spec.md) defines Action/revision/history routes, dashboard
DTOs, list extensions, status codes, replay and transaction behavior.
[ui-spec.md](ui-spec.md) defines Dashboard navigation, lists/forms and state
handling. Reuse existing forms, session guards, queue/detail views, download
rules and token styles. No coding or production UI change occurs in Issue #65.

## 9. Acceptance criteria and test mapping

The test identifiers are defined in [tests.md](tests.md); all feature checks
are Planned. This table and the test matrix are checked in both directions.

| AC | Observable acceptance criterion | FR / BR | Tests |
|---|---|---|---|
| AC-01 | Valid Staff/Admin creation saves the correct Ticket, session performer, eligible assignee and initial revision, without changing Ticket owner. | FR-01, FR-02; BR-01, BR-02, BR-03 | API-01, E2E-01 |
| AC-02 | Invalid/blank/oversized text, future/pre-Ticket dates, invalid timestamps, missing follow-up note and forged protected fields return 400 with no write; valid boundaries and literal text work. | FR-02; BR-04, BR-05, BR-06 | UNIT-01, API-02, UI-01 |
| AC-03 | Assignment/reassignment accepts active Staff/Admin only, preserves performer/owner and rejects inactive/Requester targets, including concurrent deactivation. | FR-03; BR-03, BR-09, BR-16 | API-03, CONC-02, UI-01, E2E-01 |
| AC-04 | Action lifecycle accepts exactly the specified pairs; completed result/cancel reason/confirmation are enforced; terminal restrictions and post-resolution write lock hold. | FR-03; BR-07, BR-08, BR-10 | UNIT-02, API-04, UI-01, E2E-01 |
| AC-05 | Each permitted edit appends one full revision; cancelled Action is read-only; direct SQL cannot alter/delete history or immutable Action identity. | FR-04; BR-01, BR-08, BR-11 | API-05, DB-01, E2E-01 |
| AC-06 | Owning Requester reads every Action and shared history; own writes are 403 and cross-owner requests 404; shared DTOs never contain Internal Notes/secrets. | FR-05; BR-18 | AUTH-01, UI-02, E2E-01 |
| AC-07 | Equal dates have deterministic ordering and correct pagination for Actions, revisions and Ticket events. | FR-04; BR-19 | API-06, UI-02, E2E-02 |
| AC-08 | Every one of the 64 Ticket status pairs is checked independently; only the matrix succeeds, confirmed terminal transitions are required, failed writes append no event. | FR-06; BR-12 | UNIT-03, API-07, UI-03, E2E-02 |
| AC-09 | Direct API resolution rejects zero/all-cancelled/pending/unsettled-follow-up Actions and accepts completed settled work; advisory flag never resolves/closes a Ticket. | FR-06; BR-13, BR-14 | UNIT-04, API-08, UI-03, E2E-02 |
| AC-10 | Stale version/timestamp or Action-versus-resolution race returns safe conflict; failed transaction leaves no partial Action/revision/event; successful writes advance versions. | FR-10; BR-15, BR-16 | CONC-01, API-09, UI-04 |
| AC-11 | Sequential/concurrent same-id retries create one Action/revision and replay the original result; changed payload/id misuse conflicts; lost-response retry and double-click are safe. | FR-10; BR-17, BR-25 | API-10, CONC-03, UI-04 |
| AC-12 | Populated migration preserves old content/identity/FKs/files/timestamps/hashes/sequence; legacy zero-Action and unknown resolution dates follow documented rules; recovery is demonstrated on isolated data. | FR-09; BR-14, BR-23 | DB-02, API-08 |
| AC-13 | Seed covers all required workflow/priority/ownership/Action/zero-metric cases; two reruns do not reset passwords/work or duplicate revisions/rewind sequences. | FR-09; BR-23 | DB-03 |
| AC-14 | Requester counts/recent lists match independent owned-data queries; cross-owner identity input cannot change scope; zero values and recent-resolution bounds are exact. | FR-07; BR-20, BR-21, BR-22 | API-11, AUTH-02, UNIT-05, E2E-03 |
| AC-15 | Staff/Admin counts, all buckets, recent/urgent lists and pending current-assignee Actions match independent queries with fixed limits and stable ordering. | FR-08; BR-19, BR-20, BR-21, BR-22 | API-12, AUTH-02, E2E-03 |
| AC-16 | Dashboard drills apply exactly their count predicates to existing detailed views, preserve scope/date bounds, and open the correct Ticket/Action. | FR-07, FR-08; BR-21 | API-13, UI-05, UI-06, E2E-03 |
| AC-17 | Role Dashboard navigation/identity/active state and existing destinations remain accessible; views distinguish loading, zero, forbidden and safe failure, and stale responses cannot replace new data. | FR-11; BR-24, BR-25 | UI-05, UI-06, UI-07, E2E-03 |
| AC-18 | Validation/conflict/network/500 states retain drafts; refresh does not overwrite them; versions update on success, logout clears user data, prior confirmation clears on conflict. | FR-10, FR-11; BR-24, BR-25 | UI-04, UI-03, UI-07 |
| AC-19 | Every major Lab 4 screen at 1280/820/390px has no clipping/overlap/page overflow and preserves meaningful badges, editable/read-only fields and action visibility. | FR-11; BR-26 | STYLE-01, RESP-01 |
| AC-20 | Keyboard/focus/labels/error announcements/dialog focus and actionable metric labels work; UI never uses color as the sole state cue. | FR-11; BR-26 | STYLE-01, A11Y-01 |
| AC-21 | Authentication, password/session/origin protection, Requester tickets/attachments/comments, operational queue/notes/priority/owner and Admin safety rules retain permitted behavior. | FR-12; BR-12, BR-18 | REG-01, AUTH-01, AUTH-02, E2E-04 |
| AC-22 | Dashboard responses stay bounded and queries avoid N+1/per-Ticket reads; a documented realistic fixture meets the agreed performance-smoke budget. | FR-08, FR-12; BR-20, BR-22 | PERF-01 |
| AC-23 | Six documents, numbered traceability, two DB justifications, exclusions, handout Parts 1-9 and real AI/reviewer evidence agree; formal contract approval precedes implementation. | FR-12; BR-26 | DOC-01 |
| AC-24 | Reviewed staging/main release and final-main suites/builds/migration/seed/E2E have actual SHA/logs with no required skips, and Kanban reaches Done only after review/merge. | FR-12; BR-26 | RELEASE-01, DOC-01 |

## 10. Product Definition of Done

- [ ] Contract approved and merged before dependent implementation.
- [ ] AC-01 through AC-24 implemented and verified against the approved contract.
- [ ] PostgreSQL/Prisma migration, preservation, recovery and repeatable seed tested.
- [ ] Resolution predicate and cross-row concurrency verified by direct API/race tests.
- [ ] All required unit/API/UI/style/auth/workflow/migration/regression/performance/E2E checks pass without required skips.
- [ ] Zen Green checklist verified at all three widths, with captioned screenshots for Parts 5-9.
- [ ] README setup/run/migration/seed/test/demo/recovery is current; no unfinished controls, broken links or unintended console errors.
- [ ] Reviewer records contain real comments/responses/approval and merge SHAs; AI-use contains 6-10 real prompts and a personal My Reflection.
- [ ] No credentials, session secrets, real uploads or generated runtime output committed.
- [ ] Each feature PR approved/merged into lab4-staging before its Issue is closed/Done.
- [ ] Reviewed lab4-staging -> main release followed by full verification on the actual released SHA.
- [ ] Final verification evidence corrected through a reviewed follow-up PR; #73 closes only after that follow-up merges.

## 11. Assumptions and decisions requiring review

The handout leaves lifecycle states, precise gate, editable-versus-append-only
scope and metrics open. BR-03/BR-07 to BR-17 and section 7 are concrete proposed
choices. In particular: mandatory Action assignment; shared Action revisions;
audited completed-field corrections; at least one completed, no pending or
unsettled-follow-up Action for resolution; 7-day rolling UTC windows; assignment
defines current-user pending Actions; Admin reuses Staff Dashboard. The peer
review must accept or amend these before #66 starts. Contract changes update
schema/API/UI/test mappings together, never silently diverge during coding.

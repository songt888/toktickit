# Lab 4 REST API Contract

Status: Proposed, awaiting Issue #65 peer approval. [Specification](specification.md)
is authoritative for business predicates; these endpoints are planned.
Existing [Lab 3 APIs](../lab-03/api-spec.md) remain, with the increments below.

## 1. Common conventions and safe failures

JSON, same-origin session cookie (`credentials: include`), offset-qualified
ISO dates normalized to UTC, positive int32 identifiers. Existing login,
password-change, active-user/session and Origin protections remain. Each
transaction rechecks the locked actor's active state and operational role;
middleware identity alone must not survive a concurrent role/activation change.
Dashboard/list requests cannot override session ownership with requesterId,
userId or role. New endpoints reject unknown input/query fields with 400.

| Code | Meaning |
|---|---|
| 200 | Read/update or idempotent replay |
| 201 | First successful Action creation |
| 400 | Invalid id/body/query/date/assignee, missing required value or confirmation |
| 401 | No valid session, including inactive/revoked/expired identity |
| 403 | Wrong role or password change required |
| 404 | Resource missing, mismatched Ticket/Action, or protected cross-owner resource |
| 409 | Stale state, forbidden lifecycle/gate, locked Ticket, retry-id misuse or race |
| 500 | Unexpected failure with safe message |

Keep `{ "error": "Safe message" }` compatibility. New endpoints may add safe
`code` and `fieldErrors`. Never return SQL/stack/path/hash/token/foreign Ticket
data or Internal Notes. Validate the session first; on Action/history endpoints,
resolve Ticket visibility before deciding Requester's write-role failure, so
own writes are 403 and cross-owner writes 404. For generic Staff endpoints and
Dashboard routes, wrong role is 403 before returning any operational data.

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "fieldErrors": { "followUpNote": "Describe the required follow-up." }
}
```

Conflict codes: `STALE_STATE`, `INVALID_TRANSITION`, `TICKET_LOCKED`,
`RESOLUTION_GATE_FAILED`, `MUTATION_ID_REUSED`. No partial writes on failure.
Existing endpoints can add these codes without removing their `error` field.

## 2. Action representations and reads

Safe current Action shape (all fields returned):

```json
{
  "id": 81,
  "ticketId": 21,
  "actionAt": "2026-10-05T01:00:00.000Z",
  "description": "Check the wireless adapter",
  "result": "",
  "performedBy": { "id": 7, "name": "Support A" },
  "assignee": { "id": 8, "name": "Support B", "role": "IT_STAFF", "isActive": true },
  "status": "PLANNED",
  "followUpRequired": true,
  "followUpNote": "Confirm connection with the Requester",
  "attachmentNotes": "See the existing connection-test.png attachment",
  "cancellationReason": null,
  "version": 1,
  "createdAt": "2026-10-05T01:05:00.000Z",
  "updatedAt": "2026-10-05T01:05:00.000Z"
}
```

Public action text is shared with the owning Requester. IDs used for edits are
`performedBy.id`/`assignee.id`; there is no client-authored performer field.

### GET `/api/tickets/:ticketId/actions-taken`

Owner Requester or Staff/Admin. Query: `page` (integer >= 1, default 1), `pageSize=10|25|50` (default 10).
Returns 200 `{ items: Action[], pagination: { page, pageSize, totalItems,
totalPages }, ticketUpdatedAt: UTC_ISO }`. Order `actionAt ASC,id ASC`.
No extra status filtering hides cancelled/completed work from the Requester.
Empty has `items:[]`, totalItems/totalPages 0. Invalid query 400; inaccessible
Ticket 404. Counts/page/parent timestamp use one repeatable-read snapshot.

### GET `/api/tickets/:ticketId/actions-taken/:actionId`

Same visibility; returns 200 `{ action: Action, ticketUpdatedAt: UTC_ISO }`.
Action must belong to the path Ticket or 404. Useful for view/edit refresh.

### GET `/api/tickets/:ticketId/actions-taken/:actionId/revisions`

Same visibility/page rules. Version ASC. Returns 200 `{ items: Revision[],
pagination }`; Revision = `{ version, operation, actor: {id,name}, createdAt,
snapshot }`. Actor name is the stored historical `snapshot.actorName`.
Snapshot is the scalar/historical-name schema in specification section 6.
Do not expose mutationId/requestHash or unrelated internal data in read DTOs.
Every successful write, including CREATE, has one revision; no DELETE/PATCH
revision route exists.

### GET `/api/tickets/:ticketId/status-history`

Same visibility/page rules. Order `createdAt ASC,id ASC`. Returns 200
`{ items: [{id,fromStatus,toStatus,actor:{id,name},createdAt}], pagination }`.
Legacy records can have an empty history; UI states history begins with Lab 4.
Current actor name is safe display data; actor id is immutable. No history
update/delete endpoint. Internal Notes never appear in this timeline.

## 3. Action writes

All routes below are Staff/Admin only; fresh writes reject a non-active parent
(BR-10). Authorized matching replay performs no write and may return an older result.
Common required fields: UUID `mutationId`, exact last-seen UTC
`ticketUpdatedAt`; updates additionally require integer `version>=1`.
On success return `{ action: Action, ticketUpdatedAt: UTC_ISO, replayed: false }`.
Use new Action version and Ticket timestamp for the next write.

### POST `/api/tickets/:ticketId/actions-taken`

```json
{
  "mutationId": "872894a2-a557-4e1d-93f3-015a25746d37",
  "ticketUpdatedAt": "2026-10-05T00:59:00.000Z",
  "actionAt": "2026-10-05T01:00:00.000Z",
  "description": "Check the wireless adapter",
  "result": "",
  "assigneeId": 8,
  "followUpRequired": true,
  "followUpNote": "Confirm connection with the Requester",
  "attachmentNotes": "connection-test.png"
}
```

Description/actionAt/followUpRequired are required. Omitted assigneeId defaults
to the session user; omitted result becomes empty; optional notes become null.
Follow-up note is required if true. The server supplies PLANNED, performer,
id/version/timestamps and revision. Passing those protected fields is 400.
First create is 201. BR-04/05/06 validation and inactive/ineligible assignment
are 400, stale timestamp 409, visible missing Ticket 404.

### PATCH `/api/tickets/:ticketId/actions-taken/:actionId`

Common required fields plus at least one of actionAt, description, result,
followUpRequired, followUpNote, attachmentNotes. Validate the resulting merged
Action, not only the patch. Unknown/assignee/status/performer/Ticket fields are
400. Completed descriptive/follow-up corrections are allowed with non-empty
result; cancelled edits conflict. On success increment version and append EDIT.
An unchanged normalized patch is 400 (no revision). A true -> false follow-up
edit canonicalizes note to null; supplying non-empty note with false is 400.

### PATCH `/api/tickets/:ticketId/actions-taken/:actionId/assignee`

Common fields plus `{ "assigneeId": 9 }`. New target must be active Staff/Admin;
null/Requester/inactive is 400. Same eligible assignee is an unchanged patch
(400); cancelled reassignment conflicts (409); completed assignee corrections
are allowed and audited. Append ASSIGN on
success; performer and Ticket owner do not change.

### PATCH `/api/tickets/:ticketId/actions-taken/:actionId/status`

Common fields plus `status=IN_PROGRESS|COMPLETED|CANCELLED`. Optionally result,
followUpRequired/followUpNote, attachmentNotes to record work atomically.
Other editable fields go through the descriptive edit endpoint.
COMPLETED requires non-empty resulting result. CANCELLED additionally requires
`confirm:true` and cancellationReason 5-500; cancel reason/confirmation on
other statuses is 400. Cancel uses the existing text/follow-up values and does
not accept result/note edits in the same command. Append STATUS. Invalid
enum/data/confirmation is 400; unpermitted/same-state move is 409. Cancellation
may proceed when the existing assignee has become ineligible (BR-09).

### Atomicity, replay and conflicts

Within a Prisma interactive transaction, acquire `SELECT ... FOR UPDATE` on
the Ticket, then involved User rows in ascending id, then the Action. Confirm
visibility/actor eligibility, then look up the actor+mutationId revision.
For a matching authorized normalized method/path/payload, return its saved
snapshot/result with 200 and `replayed:true`, even if the state subsequently
advanced. A reused id for another payload/route is safe 409. Replay does not
execute a write or require still-current versions/assignee eligibility.
The client refreshes after a replay because the saved versions may now be old.

For a fresh command, verify parent timestamp/child version, active Ticket,
assignee eligibility and merged validation/lifecycle. Commit Action projection,
one revision, and a strictly increased parent timestamp together. Revision
snapshot includes safe historical names plus `ticketUpdatedAt` in its row.
The unique actor+mutationId constraint catches simultaneous/cross-Ticket reuse;
on a uniqueness race, roll back and inspect the committed revision before
returning matching replay or id-reuse conflict. All failed changes leave both
tables and parent untouched. A lock/transaction conflict returns safe 409;
unexpected infrastructure failure is safe 500. No silent last-writer-wins retry.

## 4. Ticket workflow increments

Keep existing PATCH `/api/staff/tickets/:id/status` body:
`{status,updatedAt,confirm?}`. Confirm true is required for CLOSED/CANCELLED.
Apply the specification matrix; on IN_PROGRESS -> RESOLVED, while parent is
locked, check at least one completed Action, no pending Action and no completed
unsettled follow-up. Gate failure is 409:

```json
{
  "error": "Complete the recorded work and settle required follow-up before resolving.",
  "code": "RESOLUTION_GATE_FAILED",
  "resolutionGate": {
    "canResolve": false,
    "completedActions": 0,
    "pendingActions": 1,
    "unsettledFollowUpActions": 0
  }
}
```

`resolutionGate` appears only after operational authorization, never cross-owner
error. Staff detail GET adds this object (`canResolve` uses the predicate only;
the matrix separately controls whether RESOLVED is offered) and nullable
`lastResolvedAt`. Requester detail GET adds lastResolvedAt only, no operational
gate controls. Successful status write atomically appends event, sets
lastResolvedAt on entering RESOLVED and returns existing mutation DTO plus
lastResolvedAt. Requester's `/api/tickets/:id/problem-resolution` continues to
update its advisory flag, never formal status.

Adapt shared owner/priority/status mutation and Action handlers to the same
parent-first locking protocol; writes touching Ticket timestamps, including
Requester advisory indication, advance timestamps monotonically. All successful
new Ticket creations append the initial null -> NEW event in the same
transaction. Existing status PATCH retry carries the old updatedAt, therefore
409 with no duplicate event; UI refreshes to check success before resubmitting.
Do not add required fields to legacy callers except the already-required timestamp.

## 5. Dashboard responses

GET `/api/dashboard/requester`: Requester only; no query parameters.

```json
{
  "asOf": "2026-10-05T02:00:00.000Z",
  "recentFrom": "2026-09-28T02:00:00.000Z",
  "displayTimeZone": "Asia/Bangkok",
  "metrics": { "openTickets": 3, "waitingForRequester": 1, "recentlyResolved": 0 },
  "recentTickets": []
}
```

GET `/api/dashboard/staff`: Staff/Admin only; no query parameters.

```json
{
  "asOf": "2026-10-05T02:00:00.000Z",
  "recentFrom": "2026-09-28T02:00:00.000Z",
  "displayTimeZone": "Asia/Bangkok",
  "metrics": {
    "unassignedTickets": 0,
    "myTickets": 0,
    "myActions": 0,
    "byStatus": { "NEW": 0, "OPEN": 0, "IN_PROGRESS": 0, "WAITING_FOR_REQUESTER": 0, "RESOLVED": 0, "CLOSED": 0, "REOPENED": 0, "CANCELLED": 0 },
    "byItPriority": { "LOW": 0, "MEDIUM": 0, "HIGH": 0, "URGENT": 0 }
  },
  "myActions": [],
  "recentTickets": [],
  "urgentTickets": []
}
```

Examples illustrate shape, not production counts. Ticket summaries contain
only id,ticketNumber,summary (max 240 chars),currentStatus,itPriority,owner
(`{id,name}` or null),updatedAt,lastResolvedAt. Action summaries contain
id,ticketId,ticketNumber,description (first 160 chars),status,updatedAt.
Full content remains on Detail. Each array <=5; metrics.myActions is full
pending count and can exceed displayed list length. No user-account counts.
Use the predicates/order/time rules in specification section 7 in one
REPEATABLE READ transaction. No dashboard cache/counter table.

## 6. Detailed-list extensions for exact drill-down

GET `/api/tickets` (own Requester) and GET `/api/staff/tickets` retain current
search/filter/sort/page behavior and add:

| Query | Validation and predicate |
|---|---|
| currentStatus | One of all eight Ticket enums (Requester currently only accepts NEW; expand in Lab 4) |
| statusGroup | active (BR-21) or resolved (RESOLVED/CLOSED); cannot combine with currentStatus |
| updatedFrom / updatedTo | UTC ISO lower/upper inclusive bound on updatedAt; either optional; lower<=upper |
| resolvedFrom / resolvedTo | Same bounds on lastResolvedAt; unknown/null dates do not match |

Single-status and group conflict is 400; invalid date/group/reversed bounds
400. Other filters AND together. Default updatedAt DESC,id DESC and pageSize
10/25/50 remain. Use Dashboard's returned recentFrom/asOf, never calculate new
dates in the browser. Existing queries without new parameters work unchanged.

GET `/api/staff/actions-taken`: Staff/Admin only. Accept only
`assigneeId=me`, `statusGroup=pending`, `ticketStatusGroup=active`,
`page` (integer >= 1, default 1) and `pageSize` 10/25/50; omitted scope fields default to these same values.
Reject alternate user ids/unknown groups with 400. Return paginated Action
summaries ordered updatedAt DESC,id DESC; filter assignment from the session,
PLANNED/IN_PROGRESS, parent active status. This is the exact myActions
drill-down list, not a new arbitrary Action search system.

GET `/api/staff/assignees` is reused unchanged for active Staff/Admin choices.
Public Comments, Internal Notes, attachments, user management, authentication
and health checks keep their existing paths and role rules. New endpoints
do not expose a DELETE or mutable-history operation.

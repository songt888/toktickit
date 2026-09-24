# Lab 3 REST API Specification

Status: Draft for Issue 1 peer review

## 1. Conventions

- Base URL in local development: `http://localhost:3000`.
- JSON requests use `Content-Type: application/json` unless an endpoint says
  otherwise.
- Browser requests use `credentials: include` so the session cookie is sent.
- Dates are ISO 8601 strings in UTC.
- IDs are positive integers.
- The backend is the authorization boundary. Client-supplied user, requester,
  owner, or role values do not establish identity or permission.

## 2. Authentication and Session

### Session mechanism

Successful login creates a random 32-byte opaque token. The server stores only a
SHA-256 hash of the token in `AuthSession` and sends the token in the
`toktickit_session` cookie. The cookie is `HttpOnly`, `SameSite=Lax`,
`Path=/`, and `Secure` in production. Sessions expire after eight hours.

State-changing requests validate the same-origin `Origin` header when it is
present. The API does not enable credentialed requests from arbitrary origins.

### Common errors

```json
{ "error": "Safe human-readable message" }
```

The API never returns stack traces, SQL, database URLs, filesystem paths,
password hashes, session tokens, or internal exception messages. Validation may
include safe field errors:

```json
{
  "error": "Validation failed",
  "fieldErrors": {
    "email": "Enter a valid email address."
  }
}
```

Status meaning:

| Status | Meaning |
|---|---|
| 200 | Successful retrieval or update |
| 201 | Resource created |
| 204 | Successful response with no body |
| 400 | Invalid input or malformed request |
| 401 | Missing, expired, revoked, or invalid session |
| 403 | Authenticated but forbidden, or password change required |
| 404 | Missing or protected resource, using a safe message |
| 409 | Duplicate, invalid transition, or state conflict |
| 413 | Attachment is too large |
| 415 | Attachment type is unsupported |
| 500 | Unexpected failure with a safe message |

## 3. Authentication Endpoints

### POST `/api/auth/login`

Request:

```json
{
  "email": "ariya@example.test",
  "password": "LocalPassword123"
}
```

For a valid active user, the response is `200` and sets the session cookie:

```json
{
  "user": {
    "id": 1,
    "name": "Ariya Example",
    "email": "ariya@example.test",
    "role": "REQUESTER",
    "isActive": true,
    "mustChangePassword": true
  },
  "requiresPasswordChange": true
}
```

Invalid credentials and inactive users both return `401`:

```json
{ "error": "Invalid email or password" }
```

The endpoint returns `400` for malformed input and `500` for an unexpected
failure. It never reveals whether an email exists or whether an account is
inactive.

### GET `/api/auth/me`

Requires a valid session. Returns `200` with the safe current-user object and
`requiresPasswordChange`. Returns `401` for no valid session or an inactive
account; the server revokes a session for an inactive account. The endpoint
never returns `passwordHash`.

### POST `/api/auth/logout`

This endpoint is idempotent and does not require a valid session. If a valid
session exists, it revokes the current `AuthSession` and clears the cookie. It
always returns `204`, including when the cookie is missing, expired, or already
revoked.

### POST `/api/auth/change-password`

Requires a valid session. It is allowed when `mustChangePassword=true` and for a
normal authenticated user changing their own password.

Request:

```json
{
  "currentPassword": "LocalPassword123",
  "newPassword": "NewSecurePassword456",
  "confirmPassword": "NewSecurePassword456"
}
```

The server validates the current password, password rules, confirmation, and
new-password difference. A successful response is `200` with the safe current
user and `requiresPasswordChange: false`. Invalid input is `400`; a wrong
current password is `400`; unexpected failure is `500`. A wrong current
password does not invalidate the authenticated session.

## 4. Authenticated Reference Data

The Lab 2 reference endpoints continue to return active records, but now
require an authenticated Requester, IT Staff, or Administrator session as
specified by the authorization matrix:

### GET `/api/categories`

Returns `200` with active categories ordered by `id ASC`:

```json
[{ "id": 1, "name": "Account and Access" }]
```

### GET `/api/related-systems`

Returns `200` with active related systems ordered by `id ASC`.

## 5. Requester Ticket and Attachment APIs

All Lab 2 requester endpoints use the authenticated session identity. The
temporary `X-Requester-Id` header and any body/query `requesterId` are ignored
or rejected; they never select ownership.

### POST `/api/tickets`

Requester-only. Request:

```json
{
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Laptop battery drains quickly",
  "description": "The battery falls below 20 percent after a short session.",
  "requestedPriority": "MEDIUM"
}
```

The authenticated user must have role `REQUESTER`. Successful creation returns
`201` with the saved Ticket, `currentStatus: "NEW"`,
`itPriority` equal to `requestedPriority`, and a backend-generated unique
`ticketNumber`. Validation is `400`; inactive reference data is `404`;
forbidden role is `403`; unexpected failure is `500`.

### GET `/api/tickets`

Requester-only. Returns only Tickets where `requesterId` is the authenticated
user. Supported query parameters:

```text
search=<ticket number, summary, or description text>
categoryId=<positive integer>
relatedSystemId=<positive integer>
requestedPriority=LOW|MEDIUM|HIGH|URGENT
currentStatus=NEW|OPEN|IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED|CLOSED|REOPENED|CANCELLED
sort=ticketNumber|ticketDate|updatedAt|requestedPriority
order=asc|desc
page=1
pageSize=10|25|50
```

Default ordering is `updatedAt DESC, id DESC`. Invalid query values return
`400`. Response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

### GET `/api/tickets/:id`

Requester-only and owner-only. Returns the Ticket, safe requester/category/
related-system data, and attachment metadata. It does not expose `storedName`.
Cross-owner and unknown Ticket IDs both return `404 { "error": "Resource not found" }`.

### POST `/api/tickets/:id/attachments`

Requester-only and owner-only. Multipart field: `file`. Accepted types are
JPG/JPEG, PNG, WEBP, and PDF. Each file is at most 5 MB and each Ticket has at
most five active attachments. Successful upload returns `201` with safe
metadata. Invalid form data is `400`, missing/not-owned Ticket is `404`, six or
more active files is `409`, oversized files are `413`, unsupported types are
`415`, and unexpected failure is `500`.

### GET `/api/tickets/:id/attachments`

The owning Requester, IT Staff, and Administrators with operational access may
retrieve attachment metadata. Requesters must own the Ticket; Staff and
Administrators must have access to the operational Ticket. The response does
not include `storedName`. Cross-owner or inaccessible Requester access returns
`404`.

### GET `/api/attachments/:id/download`

The owning Requester, IT Staff, and Administrators with operational access may
download an active attachment. The file must belong to an owned or operationally
accessible Ticket and have `removedAt` null. Removed, missing, and cross-owner
Requester attachments return `404`.

### PATCH `/api/attachments/:id/remove`

Requester-only and owner-authorized. Request:

```json
{ "reason": "No longer needed" }
```

The trimmed reason must be 5-500 characters. Success returns `200` with safe
metadata and sets `removedAt` without deleting the row or file metadata.
Invalid reason is `400`, missing/not-owned attachment is `404`, already removed
is `409`, and unexpected failure is `500`.

### POST `/api/tickets/:id/problem-resolution`

Requester-only and owner-authorized. Request:

```json
{ "appearsResolved": true }
```

This updates the requester indication only; it does not change
`currentStatus` to `RESOLVED` or `CLOSED`. It returns `200` with the updated
indication. A Requester cannot call staff status endpoints.

## 6. Public Comments and Internal Notes

Both resources are append-only. Content is trimmed, 1-4000 characters, and
rendered as text. The backend assigns `authorId` and `createdAt`.

### GET `/api/tickets/:id/comments`

Available to the owning Requester, IT Staff, and Administrator. Returns public
comments ordered `createdAt ASC, id ASC`.

### POST `/api/tickets/:id/comments`

Available to the owning Requester, IT Staff, and Administrator.

```json
{ "content": "I can reproduce this after reconnecting to Wi-Fi." }
```

Success returns `201`. Invalid content is `400`; inaccessible Ticket is `404`;
forbidden role is `403`.

### GET `/api/tickets/:id/internal-notes`

Available only to IT Staff and Administrators. Returns `200` with note content,
author, and timestamp. A Requester viewing their own Ticket receives `403`
without note content. A Requester attempting a note lookup through another
user's Ticket receives the safe `404` response.

### POST `/api/tickets/:id/internal-notes`

Available only to IT Staff and Administrators.

```json
{ "content": "Checked device inventory; replacement is available." }
```

Success returns `201`. Invalid content is `400`; a Requester adding a note to
their own Ticket receives `403` and no note is created; a Requester attempting
the same action on another user's Ticket receives the safe `404` response;
other inaccessible Tickets also return `404`.

## 7. IT Staff Ticket Queue

### GET `/api/staff/assignees`

Available to IT Staff and Administrators. Returns only active IT Staff and
Administrators, ordered by `name ASC, id ASC`, as safe `{ id, name, email,
role }` objects. Requesters receive `403`; a missing or invalid session receives
`401`. Password and session fields are never returned.

### GET `/api/staff/tickets`

Available to IT Staff and Administrators. Supported query parameters:

```text
search=<ticket number, summary, description, requester name>
categoryId=<positive integer>
relatedSystemId=<positive integer>
requestedPriority=LOW|MEDIUM|HIGH|URGENT
itPriority=LOW|MEDIUM|HIGH|URGENT
currentStatus=NEW|OPEN|IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED|CLOSED|REOPENED|CANCELLED
ownerId=<positive integer>|unassigned
sort=ticketNumber|ticketDate|updatedAt|requestedPriority|itPriority|currentStatus
order=asc|desc
page=1
pageSize=10|25|50
```

Default order is `updatedAt DESC, id DESC`. Results include Ticket Number, date,
summary, category, Requested Priority, IT Priority, status, owner, and last
updated timestamp. Invalid values return `400`; other roles receive `403`.

### GET `/api/staff/tickets/:id`

Returns operational Ticket Detail, safe requester data, owner, both priorities,
`ownerId`, status, `problemAppearsResolved`, `updatedAt`, comments, notes, and
attachment metadata. IT Staff and Administrators may access it. Requester
access to this route returns `403`. Attachment metadata is safe to display and
active files can be downloaded through the operational attachment permission.

### PATCH `/api/staff/tickets/:id/owner`

IT Staff and Administrators only. The owner must be an active IT Staff or
Administrator returned by `GET /api/staff/assignees`.

Request:

```json
{
  "ownerId": 7,
  "updatedAt": "2026-09-19T10:00:00.000Z"
}
```

`ownerId: null` unassigns the Ticket. The client must send the last-seen
`updatedAt`; a value that no longer matches the database row is stale. Returns
`200`; invalid/inactive owner or timestamp is `400`; missing Ticket is `404`;
stale or conflicting update is `409`.

### PATCH `/api/staff/tickets/:id/it-priority`

IT Staff and Administrators only.

Request:

```json
{
  "itPriority": "HIGH",
  "updatedAt": "2026-09-19T10:00:00.000Z"
}
```

Requested Priority is unchanged. Returns `200`, `400` for invalid priority or
timestamp, `404` for missing Ticket, and `409` for a stale update.

### PATCH `/api/staff/tickets/:id/status`

IT Staff and Administrators only.

Request:

```json
{
  "status": "CLOSED",
  "confirm": true,
  "updatedAt": "2026-09-19T10:00:00.000Z"
}
```

`confirm: true` is required for `CLOSED` and `CANCELLED`. Invalid transitions
or stale timestamps return `409`; invalid input is `400`; missing Ticket is
`404`. The `updatedAt` value is required for all staff mutations so the server
can perform optimistic concurrency checking.

Every successful staff `PATCH` returns `200` with the updated Ticket fields,
including `id`, `ownerId`, safe `owner`, `itPriority`, `currentStatus`,
`problemAppearsResolved`, and the new `updatedAt`. Clients must use that
returned `updatedAt` as the last-seen value for the next mutation. A missing or
invalid session returns `401`; a Requester role returns `403`.

## 8. Status Transition Matrix

Only IT Staff and Administrators may perform these transitions:

| Current | Permitted next status |
|---|---|
| NEW | OPEN, IN_PROGRESS, CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, REOPENED, CANCELLED |
| RESOLVED | CLOSED, REOPENED |
| CLOSED | REOPENED |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED |
| CANCELLED | REOPENED |

A Requester's Problem Appears Resolved indication is not a status transition.

## 9. Administrator User Management

All routes require `ADMINISTRATOR`. Non-Administrators receive `403` without
user-management data.

### GET `/api/admin/users`

Query parameters:

```text
search=<name or email>
role=REQUESTER|IT_STAFF|ADMINISTRATOR
```

Search is a case-insensitive substring match. The optional role filter may be
used with search. The response is `200`:

```json
[
  {
    "id": 1,
    "name": "Ariya Example",
    "email": "ariya@example.test",
    "role": "REQUESTER",
    "isActive": true
  }
]
```

No password, hash, or session data is returned.

### POST `/api/admin/users`

Request:

```json
{
  "name": "Niran Staff",
  "email": "niran@example.test",
  "role": "IT_STAFF",
  "isActive": true,
  "initialPassword": "LocalPassword123"
}
```

Success returns `201` with safe user data and
`mustChangePassword: true`. Duplicate email returns `409`; invalid input or
role is `400`.

### PATCH `/api/admin/users/:id`

Request may include `name`, `email`, `role`, and `isActive`:

```json
{
  "name": "Niran Updated",
  "email": "niran.updated@example.test",
  "role": "IT_STAFF",
  "isActive": true
}
```

Success returns `200`. Duplicate email is `409`; invalid input is `400`; a
missing user is `404`. The backend rejects deactivating the current Admin and
deactivating or demoting the last active Administrator with `409`.

### POST `/api/admin/users/:id/initial-password`

Request:

```json
{ "initialPassword": "NewLocalPassword123" }
```

The server hashes the new password, sets `mustChangePassword=true`, and returns
safe user data with `200`. The password is never returned. Invalid input is
`400`; missing user is `404`.

## 10. Security and Failure Rules

- Missing/expired/revoked sessions on protected endpoints return `401`; the
  idempotent logout endpoint is the exception and always returns `204`.
- Authenticated users without the required role return `403`.
- Users with a required password change receive `403` on normal application
  endpoints until the change succeeds.
- Cross-owner Ticket, Attachment, and Internal Note lookups never reveal
  whether another user's protected record exists; use the documented safe `404`
  behavior. A Requester requesting Internal Notes on their own Ticket receives
  `403` with no note content because the role is forbidden.
- All identifiers and query values are validated before database access.
- All output is selected explicitly so hashes, tokens, stored filenames, and
  internal paths never reach clients.
- Unexpected database or storage failures return a safe `500` response.

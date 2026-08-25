# Lab 2 REST API Specification

## 1. Requester Context

Requester-owned endpoints require the temporary testing header:

```http
X-Requester-Id: <active requester id>
```

This header is not authentication. The frontend stores the selected id in the documented temporary context and sends it for requester-owned calls. The backend validates that the requester exists and is active.

## 2. Common Responses

```json
{ "error": "Safe human-readable message" }
```

The server must not expose stack traces, database URLs, filesystem paths, or internal exception messages.

## 3. Reference Data

### GET /api/requesters?active=true

Returns active Development Requesters:

```json
[{ "id": 1, "name": "Ariya Example", "email": "ariya@example.test" }]
```

### GET /api/categories

Returns active Categories in predictable id order:

```json
[{ "id": 1, "name": "Account and Access" }]
```

### GET /api/related-systems

Returns active Related Systems in predictable id order:

```json
[{ "id": 1, "name": "Campus Wi-Fi" }]
```

Reference retrieval returns 200. Database failure returns a safe 500 response.

## 4. Create Ticket

### POST /api/tickets

Required header: `X-Requester-Id`.

Request:

```json
{
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Laptop battery drains quickly",
  "description": "The battery falls below 20 percent after a short session.",
  "requestedPriority": "MEDIUM"
}
```

The requester id comes from the validated header, not an arbitrary body value. Successful creation returns 201:

```json
{
  "id": 1,
  "ticketNumber": "TKT-20260825-000001",
  "ticketDate": "2026-08-25T00:00:00.000Z",
  "requesterId": 1,
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Laptop battery drains quickly",
  "description": "The battery falls below 20 percent after a short session.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW"
}
```

Statuses: 201 created, 400 validation failure, 404 inactive/missing reference, 409 conflict, and 500 safe unexpected failure.

## 5. My Tickets

### GET /api/tickets

Required header: `X-Requester-Id`.

Supported query parameters:

```text
search=<text>
categoryId=<id>
relatedSystemId=<id>
requestedPriority=LOW|MEDIUM|HIGH|URGENT
currentStatus=NEW
sort=ticketNumber|ticketDate|updatedAt|requestedPriority
order=asc|desc
page=1
pageSize=10|25|50
```

Response:

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

Only Tickets owned by the selected requester are returned. Invalid query values return 400. The default order is `updatedAt desc`, then `id desc`.

## 6. Ticket Detail

### GET /api/tickets/:id

Required header: `X-Requester-Id`. Returns the owned Ticket, related reference names, and attachment metadata. Returns 200 for an owned Ticket, 404 for missing or not-owned data, and 500 for a safe unexpected failure.

## 7. Attachments

### POST /api/tickets/:id/attachments

Multipart form field: `file`. The API accepts JPG/JPEG, PNG, WEBP, and PDF, with a maximum of 5 MB per file and five active attachments per Ticket. Returns 201 with metadata. Returns 400 for invalid form data, 404 for missing/not-owned Ticket, 413 for an oversized file, 415 for an unsupported type, and 500 for safe upload failure.

### GET /api/tickets/:id/attachments

Returns metadata for active and removed attachments belonging to the owned Ticket. Removed records remain visible as metadata.

### GET /api/attachments/:id/download

Returns the file only when it belongs to the selected requester and is active. Removed, missing, or unauthorized attachments return 404.

### PATCH /api/attachments/:id/remove

Request:

```json
{ "reason": "No longer needed" }
```

The reason must be 5-500 trimmed characters. The API sets `removedAt` and `removalReason` without deleting the metadata. Returns 200 for success, 400 for invalid reason, 404 for missing/not-owned attachment, and 409 if already removed.

## 8. Ownership and Failure Rules

- Every requester-owned endpoint validates `X-Requester-Id`.
- Cross-requester resources return 404 and do not reveal another user's data.
- Unexpected errors return only the common safe error shape.
- Frontend forms preserve values after a failed request.
- Ticket creation remains saved if a later attachment upload fails; the UI reports the attachment failure and allows retry.

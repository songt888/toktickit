# Lab 3 Sprint Engineering Specification

Status: Draft for Issue 1 peer review

## 1. Sprint Goal

Replace the temporary Development Requester selector with secure user
authentication and server-enforced role authorization. Preserve the Lab 2
Requester ticket and attachment workflow while adding practical IT Staff
ticket operations and a focused Administrator user-management screen.

## 2. Stakeholder Request Interpretation

TokTickIT now needs real users instead of a development-only requester switcher.
Users sign in with an email and password, change an initial password before
using the application, and see only the actions allowed for their role.
Requesters continue to manage their own tickets. IT Staff work from a shared
queue and update tickets. Administrators manage user accounts. The backend is
the security boundary; hiding a frontend button is never treated as
authorization.

## 3. Scope

### Included

- Login, logout, current-user retrieval, and authenticated sessions.
- Secure password hashing and mandatory first-login password change.
- One role per user: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- Migration of Lab 2 Development Requesters and Ticket ownership.
- Requester ticket and attachment regression using authenticated identity.
- Requester Public Comments and the Problem Appears Resolved action.
- IT Staff Ticket Queue, Ticket Detail, assignment, IT Priority, and status
  workflow.
- Public Comments and private Internal Notes.
- Minimalist Administrator user listing, search, optional role filter, create,
  edit, activation, role assignment, and initial-password reset.
- Zen Green responsive and accessible screens, automated tests, E2E tests, and
  traceable evidence.

### Excluded

- Email invitations, password-reset email, multi-factor authentication,
  social login, single sign-on, or self-registration.
- Actions Taken, SLA calculation, escalation, notifications, dashboards, and
  KPI analytics.
- Multiple roles, departments, organizations, profile photos, role history,
  account audit history, bulk operations, import/export, and user deletion.
- Production deployment or cloud infrastructure changes.

## 4. Functional Requirements

- FR-01: The system shall authenticate an active user using an email address and
  password.
- FR-02: The system shall create an authenticated session without exposing a
  password, session secret, or password hash to client code.
- FR-03: The system shall provide login, logout, and current-user operations.
- FR-04: A user with an initial password shall be required to change it before
  normal application screens become available.
- FR-05: Password validation shall enforce the documented length and content
  rules and shall require confirmation.
- FR-06: Every user shall have exactly one permitted role.
- FR-07: Protected API operations shall authorize from the authenticated user,
  never from a requester or role value supplied by the client.
- FR-08: Requesters shall create, view, and manage only their own Tickets and
  permitted Attachments.
- FR-09: Existing Lab 2 requester functionality shall continue to work without
  a Development Requester selector or Change Requester action.
- FR-10: Requesters shall post Public Comments and indicate that a problem
  appears resolved.
- FR-11: IT Staff shall access a Ticket Queue with search, filters, sorting, and
  pagination.
- FR-12: Permitted staff operations shall include opening Ticket Detail,
  claiming or reassigning ownership, setting IT Priority, and changing Ticket
  status through the approved transition matrix.
- FR-13: The system shall preserve Requested Priority and initialize IT
  Priority from it.
- FR-14: The system shall support append-only Public Comments and Internal
  Notes with backend author and creation timestamps.
- FR-15: Internal Notes shall be visible only to permitted operational roles.
- FR-16: Administrators shall list users with Name, Email, Role, Status, and an
  Edit action.
- FR-17: Administrators shall search users by name or email and optionally
  filter by role.
- FR-18: Administrators shall create and edit a user's name, email, role, and
  activation state.
- FR-19: Administrators shall set a new initial password that is changed at the
  user's next login.
- FR-20: The system shall preserve existing Lab 2 data during migration and
  provide repeatable seed data for every role and important workflow state.
- FR-21: Each screen shall provide meaningful loading, saving, validation,
  success, empty, no-results, forbidden, not-found, conflict, and safe-failure
  feedback where applicable.
- FR-22: Required screens shall remain usable on desktop, tablet, and mobile
  widths and support keyboard navigation.

## 5. Business Rules

### Authentication and passwords

- BR-01: Only an active User with valid credentials may authenticate.
- BR-02: Invalid credentials and inactive accounts return the same safe login
  message and do not reveal account state.
- BR-03: Passwords are stored only as a one-way `scrypt` hash with a unique
  random salt; plaintext passwords are never persisted or returned.
- BR-04: A password is 12-128 characters, contains at least one uppercase
  letter, one lowercase letter, and one number, and is not whitespace-only.
- BR-05: A User with `mustChangePassword=true` may use only authentication,
  current-user, logout, and change-password operations until a valid new
  password is saved.
- BR-06: Sessions use a random opaque token in an HttpOnly cookie. The database
  stores only a hash of that token. Sessions expire after eight hours and
  logout revokes the current session.
- BR-07: In production the session cookie is `Secure`, `SameSite=Lax`, and
  `Path=/`. State-changing requests validate same-origin `Origin` when the
  header is present.
- BR-08: An inactive User's existing sessions are rejected and revoked when the
  session is next checked.

### Roles and ownership

- BR-09: Each User has exactly one role from `REQUESTER`, `IT_STAFF`, or
  `ADMINISTRATOR`.
- BR-10: The authenticated User identity determines Requester ownership. A
  client cannot select another requester by sending an id in a body, query, or
  header.
- BR-11: A Requester receives only their own Ticket and Attachment data. A
  cross-owner resource lookup returns the safe not-found response.
- BR-12: Every protected operation is authorized in the backend even when the
  corresponding frontend control is hidden or disabled.
- BR-13: IT Staff and Administrators may view attachment metadata and download
  active files for Tickets they can access operationally. Upload and removal
  remain Requester-owner operations.
- BR-14: The approved matrix gives IT Staff and Administrators the operational
  Ticket permissions listed below. Their responsibilities remain conceptually
  separate: IT Staff work the queue, while Administrators primarily manage
  accounts and use operational access for support oversight.

### Ticket workflow

- BR-15: A Ticket may have zero or one primary owner. An owner must be active and
  have role `IT_STAFF` or `ADMINISTRATOR`.
- BR-16: Requested Priority is submitted by the Requester and cannot be
  changed by staff operations. IT Priority initially copies Requested Priority
  and can be changed only by IT Staff or Administrator.
- BR-17: The supported statuses are `NEW`, `OPEN`, `IN_PROGRESS`,
  `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- BR-18: Status changes must follow the transition matrix in `api-spec.md`.
  Transitions to `CLOSED` or `CANCELLED` require an explicit confirmation
  value from the UI and API request.
- BR-19: A Requester may set the Problem Appears Resolved indication but may not
  formally set a Ticket to `RESOLVED` or `CLOSED`.

### Comments and notes

- BR-20: Public Comments are visible to the Requester who owns the Ticket, IT
  Staff, and Administrators.
- BR-21: Internal Notes are visible only to IT Staff and Administrators and are
  never included in a Requester's response.
- BR-22: Comments and notes are append-only. Empty or whitespace-only content is
  rejected and content is limited to 4000 characters. Markup-like content is
  accepted as text and rendered as text rather than trusted HTML.
- BR-23: Comment and note author and creation time are assigned by the backend.

### Administrator safety

- BR-24: Email addresses are unique case-insensitively after trimming.
- BR-25: An Administrator cannot deactivate their own account.
- BR-26: The system cannot deactivate or change the role of the last active
  Administrator. Users are deactivated rather than deleted.
- BR-27: A reset initial password marks `mustChangePassword=true` and never
  returns the password in an API response.

## 6. Authorization Matrix

| Operation | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Login, logout, current user | Own account | Own account | Own account |
| Change own required password | Yes | Yes | Yes |
| Create and list own Tickets | Yes | No | No |
| Upload/remove own Attachments | Yes | No | No |
| View/download operational Attachments | No | Yes | Yes |
| View operational Ticket Queue | No | Yes | Yes |
| View operational Ticket Detail | No | Yes | Yes |
| Claim/reassign, IT Priority, status | No | Yes | Yes |
| Read/write Public Comments | Own Tickets | Queue Tickets | Permitted Tickets |
| Read/write Internal Notes | No | Yes | Yes |
| List/search users | No | No | Yes |
| Create/edit/deactivate users | No | No | Yes |
| Set another user's initial password | No | No | Yes |

The backend applies this matrix to every endpoint. A `401` means no valid
session exists. A `403` means the session is valid but the role or password
state does not permit the operation.

## 7. UI Specification Summary

The UI reuses the Lab 2 Zen Green tokens, form conventions, badges, cards,
focus treatment, and responsive rules. The authenticated shell shows the
current user's name and role, a Logout action, and only role-permitted
navigation.

- Requester screens: My Tickets, Create Ticket, read-only Ticket Detail with
  Public Comments and Problem Appears Resolved.
- IT Staff screens: Ticket Queue and operational Ticket Detail with ownership,
  IT Priority, status, comments, notes, and attachments.
- Administrator screens: User Management with list, search, role filter,
  create, edit, activation, and initial-password actions.
- Login and Change Password screens show labels, validation, busy states, safe
  failures, and accessible announcements.
- Editable fields, read-only fields, Public Comments, and Internal Notes use
  distinct visual treatments.

Detailed layout, modes, responsive rules, and accessibility requirements are
defined in [`ui-spec.md`](ui-spec.md).

## 8. Data Changes and Migration

The Lab 3 target model evolves the Lab 2 schema without discarding existing
Ticket or Attachment rows:

```prisma
enum UserRole {
  REQUESTER
  IT_STAFF
  ADMINISTRATOR
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketStatus {
  NEW
  OPEN
  IN_PROGRESS
  WAITING_FOR_REQUESTER
  RESOLVED
  CLOSED
  REOPENED
  CANCELLED
}

model User {
  id                    Int             @id @default(autoincrement())
  name                  String
  email                 String          @unique
  passwordHash          String
  role                  UserRole
  isActive              Boolean         @default(true)
  mustChangePassword    Boolean         @default(true)
  passwordChangedAt     DateTime?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  requesterTickets      Ticket[]        @relation("RequesterTickets")
  ownedTickets          Ticket[]        @relation("TicketOwners")
  publicComments        PublicComment[]
  internalNotes         InternalNote[]
  sessions              AuthSession[]

  @@index([isActive, role, name])
}

model Ticket {
  id                       Int            @id @default(autoincrement())
  ticketNumber             String         @unique
  ticketDate               DateTime       @default(now())
  requesterId              Int
  ownerId                  Int?
  categoryId               Int
  relatedSystemId          Int
  summary                  String
  description              String
  requestedPriority        TicketPriority
  itPriority               TicketPriority
  currentStatus            TicketStatus   @default(NEW)
  problemAppearsResolved  Boolean        @default(false)
  problemAppearsResolvedAt DateTime?
  createdAt                DateTime       @default(now())
  updatedAt                DateTime       @updatedAt
  requester                User           @relation("RequesterTickets", fields: [requesterId], references: [id])
  owner                    User?          @relation("TicketOwners", fields: [ownerId], references: [id])
  category                 Category       @relation(fields: [categoryId], references: [id])
  relatedSystem            RelatedSystem  @relation(fields: [relatedSystemId], references: [id])
  publicComments           PublicComment[]
  internalNotes            InternalNote[]
  attachments              Attachment[]

  @@index([requesterId, updatedAt, id])
  @@index([ownerId, currentStatus, updatedAt])
  @@index([currentStatus, itPriority, updatedAt])
}

model Category {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tickets   Ticket[]

  @@index([isActive, name])
}

model RelatedSystem {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tickets   Ticket[]

  @@index([isActive, name])
}

model Attachment {
  id            Int       @id @default(autoincrement())
  ticketId      Int
  originalName  String    @db.VarChar(255)
  storedName    String    @unique
  mimeType      String
  sizeBytes     Int
  createdAt     DateTime  @default(now())
  removedAt     DateTime?
  removalReason String?   @db.VarChar(500)
  ticket        Ticket    @relation(fields: [ticketId], references: [id])

  @@index([ticketId, removedAt])
}

model PublicComment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  authorId  Int
  content   String   @db.VarChar(4000)
  createdAt DateTime @default(now())
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  author    User     @relation(fields: [authorId], references: [id])

  @@index([ticketId, createdAt, id])
}

model InternalNote {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  authorId  Int
  content   String   @db.VarChar(4000)
  createdAt DateTime @default(now())
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  author    User     @relation(fields: [authorId], references: [id])

  @@index([ticketId, createdAt, id])
}

model AuthSession {
  id        Int      @id @default(autoincrement())
  userId    Int
  tokenHash String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@index([userId, expiresAt])
}
```

Migration decisions:

1. Rename the Lab 2 `RequesterUser` table to `User` while preserving primary
   keys, names, emails, and foreign-key values. Existing `Ticket.requesterId`
   values therefore continue to identify the same people. Trim and lowercase
   emails during migration before applying the unique constraint; a duplicate
   normalized email must stop the migration for manual resolution.
2. Add role, password state, activation state, and timestamps. Existing
   Requesters receive a local-development initial password through an environment
   variable used only by the seed; no password is committed to the repository.
3. Add `ownerId`, `itPriority`, status values, and the requester-resolution
   fields to `Ticket`. Existing tickets keep their requester, Requested Priority,
   and `NEW` status; `itPriority` is backfilled from Requested Priority.
4. Add `PublicComment`, `InternalNote`, and `AuthSession` tables with foreign
   keys and indexes. Existing Categories, Related Systems, Tickets, and
   Attachments remain valid.
5. Because `passwordHash` is required, the migration fills existing Users with
   a deterministic unusable placeholder hash and sets `mustChangePassword=true`.
   The seed may replace that hash only when the stored value is still the exact
   placeholder. For any User with a real hash, seed updates never overwrite
   `passwordHash`, `mustChangePassword`, or `passwordChangedAt`.
6. Use a repeatable seed with at least four active and one inactive Requester,
   three active and one inactive IT Staff, one active Administrator, realistic
   tickets, and safe example comments/notes. Seed upserts are keyed by stable
   emails or names and never store real credentials.

## 9. API Contract Summary

The exact request/response shapes, cookie behavior, status codes, query
parameters, safe errors, and transition matrix are defined in
[`api-spec.md`](api-spec.md). The major endpoint groups are:

- `/api/auth/*` for login, logout, current user, and password change.
- Existing `/api/tickets/*` and `/api/attachments/*` paths continued under the
  authenticated identity for Requesters.
- `/api/staff/tickets/*` for queue and operational Ticket actions.
- `/api/tickets/:id/comments` and `/api/tickets/:id/internal-notes` for
  role-controlled collaboration.
- `/api/admin/users/*` for Administrator user management.

All protected endpoints distinguish unauthenticated access, forbidden roles,
invalid input, missing resources, conflicts, and unexpected failures without
leaking protected data.

## 10. Acceptance Criteria

- AC-01: An active user with valid credentials receives an authenticated session
  and safe current-user data.
- AC-02: Invalid credentials and inactive accounts receive the same safe login
  failure and no session.
- AC-03: A user with an initial password cannot enter normal application screens
  until a valid new password is saved.
- AC-04: Logout revokes the current session and direct protected access after
  logout is rejected.
- AC-05: The authenticated identity and role are displayed in the shell and
  protected navigation is role-specific.
- AC-06: A Requester cannot select another identity and sees only their own Lab
  2 Tickets and Attachments.
- AC-07: Lab 2 Create Ticket, My Tickets, Ticket Detail, and Attachment flows
  continue to work after authentication migration.
- AC-08: Requester Public Comments and Problem Appears Resolved work only for
  owned Tickets; Requesters cannot formally resolve or close Tickets.
- AC-09: IT Staff can load a Queue with documented search, filters, sorting,
  pagination, owner data, status, and both priorities.
- AC-10: Queue query validation and direct role checks return documented safe
  responses.
- AC-11: IT Staff/Admin can open Ticket Detail and perform permitted
  claim/reassign, IT Priority, and status operations.
- AC-12: Invalid status transitions, inactive owners, and missing Tickets are
  rejected without changing data.
- AC-13: Public Comments are visible to the Requester owner, IT Staff, and
  Administrator with safe rendering and backend author/time.
- AC-14: Internal Notes are visible only to IT Staff and Administrator, including
  through direct API requests.
- AC-15: Empty, whitespace-only, and oversized comment/note content is rejected;
  markup-like content is stored and rendered as plain text without executing.
- AC-16: Administrator can list/search/filter users and view Name, Email, Role,
  Status, and Edit actions.
- AC-17: Administrator can create a user with one role and an initial password;
  duplicate email and invalid role are rejected.
- AC-18: Administrator can edit name, email, role, and activation state.
- AC-19: Administrator can set a new initial password and the target user must
  change it on the next login.
- AC-20: Self-deactivation and deactivation or role demotion of the last active
  Administrator are rejected.
- AC-21: Data migration preserves existing Ticket and Attachment ownership and
  deploys without data loss.
- AC-22: Seed creates all required active/inactive roles and realistic workflow
  data and is safe to run repeatedly.
- AC-23: All major screens provide relevant loading, saving, success, empty,
  no-results, forbidden, not-found, conflict, and safe-failure states.
- AC-24: Desktop, tablet, and mobile screens have no clipping, overlap, or
  unintended horizontal overflow and remain keyboard accessible.
- AC-25: All required tests, builds, migrations, seed checks, and E2E flows pass
  from the final `main` branch with no required test skipped.

Every criterion maps to at least one planned test in [`tests.md`](tests.md).

## 11. Definition of Done

- The approved specification, API contract, UI specification, and test plan are
  committed before the main implementation PRs are completed.
- User migration, session handling, password hashing, and role authorization
  are implemented and tested on the backend.
- Lab 2 Requester behavior remains authenticated, owner-protected, and tested.
- IT Staff Queue, Ticket operations, comments, notes, and Admin user management
  meet the approved acceptance criteria.
- Prisma migration and repeatable seed preserve data and satisfy role fixtures.
- Unit, API/integration, UI, style, regression, responsive, accessibility, and
  E2E tests pass without required skips.
- No secrets, plaintext passwords, session tokens, uploads, or generated build
  output are committed.
- README, reviewer record, AI-use reflection, test evidence, screenshots, and
  Kanban status are current.
- Each PR has a teammate's formal approval before merge into `lab3-staging`.
- The release PR is approved and merged into `main`, and final verification is
  rerun from `main`.

## 12. Assumptions and Decisions

- Lab 3 uses a database-backed opaque session cookie because it allows logout
  invalidation and keeps the client free of authentication secrets.
- The application uses same-origin API calls through the existing Vite/Express
  setup; cross-origin credential sharing is not part of this lab.
- Administrators have explicit operational read/write permission in the matrix
  for support oversight; this is a documented choice, not an assumption that
  every Administrator automatically has staff permissions.
- Existing local-development seed passwords are supplied through environment
  variables and are documented as test-only values outside source control.
- This contract is the baseline for peer review. Implementation may proceed
  only after disagreements are resolved in the PR and reflected here.

# Lab Workflow

## Overall Process

```text
Receive lab requirements
→ Update agent.md with the current lab workflow
→ Plan Issues and Kanban
→ Move Issue to Started
→ Create a feature branch
→ Develop and test
→ Commit and push
→ Open a PR for peer review
→ Fix feedback if needed
→ Teammate Approve
→ Merge to the staging branch
→ Close Issue and move it to Done
→ Repeat for the next Issue
→ Release staging to main
→ Run final verification
→ Submit the report
```

## Lab 1 — Project Foundation

Lab 1 established the basic full-stack project and Git workflow.

Main work included:

- React, TypeScript, Vite, and Bootstrap frontend
- Node.js, Express, and TypeScript backend
- PostgreSQL and Prisma setup
- Health-check API
- Category database seed and category list UI
- Vitest and Supertest configuration
- README, `.gitignore`, and `.env.example`

Lab 1 Issues were completed in order on feature branches, merged into
`lab1-staging`, and then released to `main` through a pull request.

## Lab 2 — Requester Ticket Workflow

Lab 2 extended the foundation into a complete requester-facing IT ticket workflow.

Main work included:

- Lab 2 engineering contract and API/UI specifications
- Development Requester selection context
- Ticket database models and repeatable seed data
- Create Ticket API and UI
- Requester-owned My Tickets list
- Ticket Detail page
- Attachment upload, download, and removal lifecycle
- Playwright E2E, responsive, and accessibility checks
- Reviewer, AI-use, test, README, and submission evidence

The Lab 2 Issue sequence was:

```text
Issue 1: Contract
→ Issue 2: Database foundation
→ Issue 3: Requester context
→ Issue 4: Create Ticket
→ Issue 5: My Tickets
→ Issue 6: Ticket Detail
→ Issue 7: Attachments
→ Issue 8: E2E and responsive QA
→ Issue 9: Documentation and release
```

The database foundation and requester context could be developed in parallel.
The other Issues followed their documented dependencies.

Lab 2 feature branches were merged into `lab2-staging`. After all Issues were
complete, a release PR moved `lab2-staging` into `main`, followed by final tests,
builds, and E2E verification from `main`.

## Lab 3 — Users, Roles, IT Staff, and Administration

Lab 3 replaces the temporary Development Requester selector with real
authentication and role-based authorization while preserving the completed
Lab 2 Requester ticket and attachment workflow.

Main work includes:

- Login, logout, current-user retrieval, and secure password hashing
- Mandatory password change for accounts using an initial password
- One role per user: Requester, IT Staff, or Administrator
- Server-side authorization and Requester ownership protection
- Migration of existing Development Requesters and Tickets to real users
- Requester Public Comments and Problem Appears Resolved action
- IT Staff Ticket Queue with search, filters, sorting, and pagination
- Ticket claiming/reassignment, IT Priority, and status transitions
- Public Comments and role-restricted Internal Notes
- Administrator user listing, search, create/edit, activation, role assignment,
  and initial-password reset
- Responsive, accessible Zen Green interfaces and complete regression coverage

The planned Lab 3 Issue sequence is:

```text
Issue 1: Sprint 3 engineering contract and test plan
→ Issue 2: User data migration, roles, credentials, and seed foundation
→ Issue 3: Authentication, session, logout, and first-login password change
→ Issue 4: Role authorization and Lab 2 Requester regression
→ Issue 5: Requester Public Comments and Problem Appears Resolved
→ Issue 6: IT Staff Ticket Queue
→ Issue 7: IT Staff ticket ownership, priority, and status workflow
→ Issue 8: Public Comments and Internal Notes for IT Staff
→ Issue 9: Administrator user management
→ Issue 10: E2E, responsive, accessibility, documentation, and release
```

Issue 1 must be approved before implementation starts. Issues 2 and 3 establish
the identity foundation required by the protected features. Requester, IT Staff,
and Administrator work must follow the authorization matrix and documented
dependencies in the approved engineering contract.

Each Lab 3 Issue must include:

- Scope and exclusions
- Acceptance Criteria
- Dependencies
- Planned automated and manual tests
- Branch name
- Definition of Done

Lab 3 work uses feature branches merged through peer-reviewed Pull Requests into
`lab3-staging`. After every Issue is approved, merged, closed, and moved to Done,
a release PR moves `lab3-staging` into `main`. Final tests, builds, migrations,
seed verification, and E2E checks must then be rerun from `main`.

Required Lab 3 documentation is maintained under `docs/lab-03/`:

- `specification.md`
- `tests.md`
- `ui-spec.md`
- `api-spec.md`
- `reviewer.md`
- `ai-use.md`

Final submission evidence uses the exact headings `Answer Part 1` through
`Answer Part 9` and includes working links, readable screenshots, review and
Kanban evidence, traceable test results from `main`, and the completed visual
checklist.

## Kanban Flow

```text
Backlog → Specified → Started → PR Review → Fixing → Done
```

`Fixing` is used only when review feedback or failed checks require more work.

## Pull Request Rules

- Work on a feature branch, not directly on `main`.
- Keep each PR focused on one Issue or one release/documentation task.
- Add tests and update documentation related to the work.
- Request a teammate review after pushing the PR.
- Wait for a formal approval before merging.
- Update the Kanban status after each workflow stage.
- Use the staging branch for feature integration and `main` for final releases.

## Future Labs

Future labs will use the same overall process with their own Issues, feature
branches, staging branch, tests, documentation, and release PR. New lab details
will be added to this file before planning or implementation starts, while
keeping each Lab's scope and features separate.

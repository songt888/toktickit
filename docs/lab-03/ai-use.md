# Lab 3 AI Use and Reflection

## LLM Used

OpenAI Codex powered by GPT-5 was used as a specification and coding
assistant. I remained responsible for design decisions, checking the Lab 3
sheet, reviewing generated suggestions, running tests, and confirming the
result in the repository and browser.

## Selected Prompts

The following prompts are the initial examples used for Issue 1. More prompts
will be added as implementation proceeds.

1. "Read the Lab 3 sheet and separate mandatory requirements from excluded
   scope."
2. "Create a Lab 3 workflow that keeps Lab 1 and Lab 2 features separate and
   starts with updating agent.md."
3. "Break Lab 3 into Issues with Scope, Acceptance Criteria, Dependencies,
   Planned tests, Branch name, and Definition of Done."
4. "Design a migration from the Lab 2 Development Requester identity to a real
   User model without losing Ticket ownership or Attachment data."
5. "Review this authentication contract for password, session, logout,
   first-login, authorization, and safe-error gaps."
6. "Create an API contract for Requester, IT Staff, and Administrator operations
   with exact status codes and ownership rules."
7. "Create a test plan where every acceptance criterion maps to a real unit,
   API, UI, regression, responsive, accessibility, or E2E test."
8. "Challenge this specification for race conditions, privilege escalation,
   data leakage, migration loss, and unclear UI behavior."
9. "Implement staff Ticket mutations with optimistic concurrency and test stale
   and concurrent updates against the actual PostgreSQL row version."
10. "Review the staff workflow UI and E2E checks for claim, reassignment,
    unassignment, read-only Requested Priority, status confirmation, and mobile
    overflow; identify any assumptions the tests do not prove."

## How I Used AI Critically

I used the LLM to turn the handout into a reviewable starting point, but I did
not treat its first answer as the specification. I compared each proposed rule
with the Lab 3 sheet, checked that the API and UI documents used the same role
and status names, and added explicit decisions for sessions, password state,
ownership, migration, safe errors, and testing. I also checked that excluded
features such as email delivery, multiple roles, user deletion, and advanced
identity management were not accidentally included.

Before implementation, a teammate reviewed the contract and identified
inconsistencies that were corrected before coding. During coding I verify AI
suggestions against the actual Prisma schema, API behavior, tests, browser
behavior, and final `main` branch rather than relying on autofill or unverified
generated code.

## My Reflection

The specification-agent helped expose decisions that would otherwise remain
implicit, especially the migration path, authorization boundaries, and status
transitions. For Issue 7, I used AI suggestions to scaffold mutation endpoints,
UI controls, and tests, then checked the critical behavior against the actual
transaction predicates, role filters, and returned `updatedAt` values. Running
the browser flow exposed a test synchronization problem around the native
confirmation dialog; I fixed the test to accept the dialog while its click was
in progress rather than weakening the status assertion. Human review remains
important for security, ownership, concurrency, and whether evidence proves
each acceptance criterion; generated code is a draft, not verification.

# Lab 2 — AI Use and Reflection

**LLM/agent used:** Codex (GPT-5)

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read the Lab 2 labsheet and separate mandatory requirements, exclusions, deliverables, and evidence from examples. | I compared the extracted requirements with the labsheet and kept authentication, IT Staff workflow, comments, and later ticket-status changes outside Lab 2. |
| 2 | Identify missing decisions for Ticket Number generation, ownership, validation, pagination, and attachments. | I resolved the ambiguities as numbered business rules instead of allowing the implementation to invent behavior silently. |
| 3 | Draft the engineering contract with requirements, data changes, API behavior, acceptance criteria, and Definition of Done. | I reviewed and corrected the contract before implementation, including the PostgreSQL sequence and active-reference rules. |
| 4 | Build a planned-test table mapping every acceptance criterion to real unit, API, UI, responsive, and E2E test paths. | I checked that each path existed and corrected RELEASE-01 when two test files were missing from the traceability list. |
| 5 | Review the REST API for safe errors, status codes, pagination, and requester ownership. | I compared the suggestions with `api-spec.md`, added explicit requester-header behavior, and kept cross-requester responses safely indistinguishable. |
| 6 | Convert the Zen Green requirements into reusable UI states, responsive rules, accessibility rules, and screenshot checks. | I used the result to guide the UI specification, then verified desktop, tablet, mobile, keyboard focus, and overflow with Playwright. |
| 7 | Diagnose the Prisma P1001 database error without changing working application code. | I confirmed PostgreSQL was unavailable, started the Docker container, and reran migration, seed, and tests before deciding that no code fix was needed. |
| 8 | Review the E2E implementation for race conditions, viewport gaps, fragile selectors, ownership weaknesses, and missing evidence. | I replaced fragile requester assumptions, added exact cross-requester checks, and measured overflow on My Tickets and Ticket Detail as well as Create Ticket. |

## My Reflection

The prompts were most useful when they named a specific requirement, file, failure case, and
verification method. I treated generated code and documentation as proposals rather than final
answers: I checked them against the labsheet, PostgreSQL behavior, automated tests, browser
results, and peer-review feedback. This process helped me catch race conditions, ownership gaps,
stale-response behavior, fragile E2E assumptions, and incomplete traceability while keeping Lab 3
authentication and IT Staff features outside the approved scope.

# Lab 2 AI Use and Reflection

## LLM used

I used ChatGPT/Codex as a specification and coding assistant. I remained responsible for reviewing the Lab 2 labsheet, choosing the final scope and business rules, checking consistency between documents, and verifying tests and evidence.

## Selected key prompts

| # | Prompt purpose | Example prompt used |
|---|---|---|
| 1 | Extract requirements | Read the Lab 2 labsheet and separate mandatory requirements, exclusions, deliverables, and evidence from examples. |
| 2 | Identify ambiguity | List decisions the stakeholder request does not define for Ticket Number, ownership, validation, pagination, and attachments. |
| 3 | Create contract | Draft a numbered specification with FR, BR, AC, data changes, API contract, assumptions, and Definition of Done. |
| 4 | Design tests | Build a planned-test table that maps every acceptance criterion to unit, API, UI, responsive, visual, and E2E tests with actual file paths. |
| 5 | Review API | Review the proposed REST API for request/response consistency, safe errors, status codes, pagination, and cross-requester ownership. |
| 6 | Review UI | Convert the Zen Green visual requirements into reusable component states, responsive rules, accessibility rules, and a screenshot checklist. |
| 7 | TDD planning | For the current Issue, list failing tests to write first, the smallest implementation needed, and the evidence required after the tests pass. |
| 8 | Completion audit | Audit the implementation against every AC and planned test. Report missing evidence, skipped tests, failure cases, and scope creep. |

## My Reflection

The LLM was useful for organizing a long labsheet and finding missing cases, especially ownership, attachment removal, responsive behavior, and failure states. I did not treat generated text as automatically correct: I checked each rule against the stakeholder request, excluded Lab 3 features, selected the final API and data decisions, and planned tests before implementation. I will update this file with concrete implementation prompts and review decisions as the sprint progresses.

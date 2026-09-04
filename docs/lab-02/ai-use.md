# Lab 2 AI Use and Reflection

## LLM used

I used OpenAI Codex (GPT-5) as a specification, coding, testing, and documentation assistant. I remained responsible for reviewing the Lab 2 labsheet, choosing the final scope and business rules, checking consistency between documents, and verifying tests and evidence.

## Selected key prompts

| # | Prompt purpose | Example prompt used |
|---|---|---|
| 1 | Extract requirements | “Read the Lab 2 labsheet and separate mandatory requirements, exclusions, deliverables, and evidence from examples.” |
| 2 | Identify ambiguity | “List decisions the stakeholder request does not define for Ticket Number, ownership, validation, pagination, and attachments.” |
| 3 | Create contract | “Draft a numbered specification with FR, BR, AC, data changes, API contract, assumptions, and Definition of Done.” |
| 4 | Design tests | “Build a planned-test table that maps every acceptance criterion to unit, API, UI, responsive, visual, and E2E tests with actual file paths.” |
| 5 | Review API | “Review the proposed REST API for request/response consistency, safe errors, status codes, pagination, and cross-requester ownership.” |
| 6 | Review UI | “Convert the Zen Green visual requirements into reusable component states, responsive rules, accessibility rules, and a screenshot checklist.” |
| 7 | Investigate failure | “Read this Prisma P1001 output, identify whether the failure is application code or unavailable infrastructure, and give safe checks before changing code.” |
| 8 | Review E2E diff | “Read through the full E2E diff and identify race conditions, viewport gaps, fragile selectors, ownership-test weaknesses, and missing evidence.” |
| 9 | Completion audit | “Audit the implementation against every AC and planned test. Report missing evidence, skipped tests, failure cases, and scope creep.” |

## My Reflection

The LLM was useful for organizing a long labsheet and finding missing cases, especially ownership, attachment removal, responsive behavior, and failure states. I did not treat generated text as automatically correct: I compared suggestions with the specification, checked the implementation and database behavior, rejected unsupported assumptions, and used reviewer feedback to correct the E2E coverage. For example, the final responsive test was changed only after reasoning about hidden desktop/mobile DOM elements and the risk of hardcoded requester IDs. I kept Lab 3 authentication and IT Staff workflow out of scope, ran the tests myself, and used the passing output as the evidence source.

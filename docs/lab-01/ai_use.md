# Lab 1 — AI Use and Reflection

**LLM/agent used:** Codex (GPT-5)

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Inspect the repository and compare the scaffold with the Lab 1 acceptance criteria. | I checked the files, scripts, tests, Git branches, and environment instead of assuming the scaffold was complete. |
| 2 | Verify whether React, Vite, Bootstrap, Express, TypeScript, Vitest, and Supertest actually run. | I ran builds, tests, and local server checks and recorded failures separately from passing checks. |
| 3 | Implement the health endpoint with the exact required JSON response. | I changed the route and confirmed it with Supertest. |
| 4 | Add the Prisma Category model, migration, and idempotent seed. | I validated the schema, applied the migration, ran the seed twice, and queried PostgreSQL for uniqueness. |
| 5 | Implement the categories API and test predictable ID/name ordering. | I used Prisma `findMany`, selected only `id`/`name`, ordered by `id`, and verified the response with Supertest. |
| 6 | Implement the React API call and Online/Loading/Offline UI states. | I mocked API results in Vitest and verified that the UI renders returned category values rather than hard-coded values. |
| 7 | Diagnose why DevTools showed HTTP 304 instead of 200. | I tested the live endpoint with a cache validator, then disabled ETag and added `Cache-Control: no-store`. |
| 8 | Check Git branches, upstreams, tracked secrets, commits, and Pull Requests. | I used Git status/log/diff checks and verified branch/PR state before committing or pushing. |


## Reflection
The prompts became more effective when they named the exact acceptance criterion,
file, expected response, and verification command. I treated generated code as a
proposal: I checked it against the existing tests and PostgreSQL, corrected the
cache behavior after seeing HTTP 304, and did not create empty commits when a
branch had no real diff.

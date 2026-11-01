# Lab 4 AI Use and Reflection

## LLM Used

OpenAI Codex (the VS Code session showed GPT-6.1-Sol, high) was used as a
specification assistant for the Lab 4 plan and the Issue #65 engineering
contract. Claude Code in the Claude desktop app, running Claude Sonnet 5.5 and
Claude Opus 5.5, was used as a coding and review assistant for Issues #66 to
#73 and for drafting my reviews of my partner's PRs. I remained responsible for
design decisions, checking the Lab 4 sheet, reviewing generated suggestions,
running tests, and confirming the result in the repository and browser. My
partner stickkersz approved and merged every PR; the AI never approved or
merged one.

## Selected Prompts

These examples summarize prompts I used across Lab 4; wording is lightly
normalized for readability, and each one keeps only what the original message
asked. Prompts 1 and 2 were sent to Codex, prompts 3 to 10 to Claude Code. Prompts 2, 5, 6 and 10
were written in Thai and are translated here. I
checked generated suggestions against the specification, code, tests, GitHub
and actual browser results.

1. "Accept this Lab 4 workflow and Issue plan."
2. "Write the Lab 4 documents in docs/lab-04/. Define Action assignee and
   status, the append-only boundary, the resolution gate and the Dashboard
   calculations; check the schema, API, UI, business rules and AC/test mapping
   for consistency; open a PR into lab4-staging and wait for teammate
   approval and merge."
3. "Receive the Lab 4 handout."
4. "Review my partner's PR #81 from my account in the tone of my Lab 3 review
   comments, and send me a draft first."
5. "Implement Issue #66: the Prisma migration and models for Actions Taken and
   status changes, a backfill for old Tickets, a rerunnable seed covering every
   Ticket status with zero, one and many Actions and users with an empty
   Dashboard, and migration and seed tests."
6. "Move #65 to Done and close it, move #66 to PR Review, add #76 to the board
   as Done, and do this automatically from now on."
7. "Start Issue #72."
8. "Fix every point in my partner's review (Queue name wrapping at 1280 px, the
   RESP-01 wait for rows, the /assignee test, the CONC-02 timeout and the
   ui-spec tick), and make it fully correct."
9. "Run another QA check of the current work."
10. "Recheck your explanation that the failing Lab 3 search test was caused by
    test Tickets left in the local database."

## How I Used AI Critically

I used Codex to turn the handout into a reviewable contract, but I did not treat
its first answer as the specification. The contract states which choices the
handout leaves open (Action assignee versus performer, append-only revisions,
the exact resolution gate, seven-day windows) and lists them as decisions for
review. My partner requested changes twice in PR #74 and then approved it before any feature code started,
and the out-of-scope PDF change and the paging rule were corrected there.

During coding I checked Claude Code's output against the approved contract, the
database, the tests and the browser. When my own Issue #66 brief asked for a
history backfill, the approved AC-12 already said history must not be invented,
so the migration adds none and DB-02 tests that no rows appear. My partner's
reviews also caught test rows marked Passed without a test behind them (PRs #78,
#79, #80 and #82) and tests that could not fail; each was fixed with a test that
fails without the change, or the row was narrowed. Counts in `tests.md` come from
recorded runs, and the final `main` verification was run on the released SHA
`991b254` after the release merged. Issue #73 allows no PDF work unless
separately requested; in a separate request outside that Issue, I asked Claude
Code for a draft report PDF, and it wrote a script that assembles it outside the
repository from the committed documents and screenshots. The PDF is not
committed.

## My Reflection

The specification-agent helped expose decisions that the handout leaves
implicit, especially who performs versus who is assigned an Action, what can be
edited once recorded, and exactly when a Ticket may be resolved. Writing them as
numbered rules with tests made the later implementation and review easier,
because each disagreement could point at one rule.

For Issue #66, the brief I wrote asked for a backfill of status history, but the
approved contract forbids invented history. I kept the contract, showed a
"history not reconstructed" note for legacy Tickets, and tested that no events
are created for them. This is a deliberate decision recorded in the contract.

For Issue #72, the server suite failed about one run in eight. Instead of
rerunning until it passed, I had the cause traced: Supertest listened on every
interface and then called 127.0.0.1, where another local program could answer.
The fix binds the test server to 127.0.0.1, a harness test fails if the fix stops
applying, and 60 of 60 full runs passed afterwards. A later QA pass found two
layout bugs the tests had missed (a split "Unassigned" and the Queue overflowing
at 992 px), and the new checks fail without the fixes. Eight review rounds on
PR #83 showed me that "it passed once" is not evidence.

For Issue #73, I compared the documents with GitHub and the actual test output.
My partner found places where the records claimed more than they showed, such as
prompts described as exact and stale "planned" wording, and I corrected them.
Generated code and documents are a draft; review and real runs are the
verification. Final `main` verification was run only after the release was
merged, on the released SHA.

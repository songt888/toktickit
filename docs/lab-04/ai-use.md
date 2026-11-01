# Lab 4 AI Use and Reflection

## LLMs and tools used

- **OpenAI Codex** in VS Code (the session UI showed GPT-6.1-Sol, high): Lab 4 planning and the first
  draft of the Issue #65 engineering contract, as recorded when the contract was written.
- **Claude Code** in the Claude desktop app, running **Claude Sonnet 5.5** and **Claude Opus 5.5**
  (model ids `claude-sonnet-5-5` and `claude-opus-5-5`, read from the local session logs): reading
  the Lab 4 handout, the contract review rounds on PR #74, implementation of Issues #66 to #72
  (PRs #75 and #77 to #83), drafting my review comments on my partner's PRs, Kanban updates, and
  this #73 documentation.

I chose what to build, read every review comment before it was posted from my account, approved
each push, and merged only after my partner's formal GitHub approval. The AI never approved or
merged a PR.

## Selected real prompts

Each prompt below is the formal wording of a request I really made during Lab 4. The wording is
tidied for this report; the original messages (spelling kept, Thai translated) are listed after it.
No prompt describes work that was not requested.

1. "Read the Lab 4 handout and separate mandatory requirements from excluded scope."
2. "Review my partner's pull request #81 on my behalf, using the tone of my Lab 3 review comments, and send me a draft before anything is posted."
3. "Create the Issue #66 migration and models for Actions Taken and Ticket status events, with an idempotent seed that covers every Ticket status and zero, one and many Actions, and tests for both."
4. "Update the Kanban board: move #65 to Done and close it, move #66 to PR Review, and from now on move cards and close Issues automatically."
5. "Start Issue #72: create its branch, move its card to Started, and implement the responsive, accessibility and end-to-end hardening."
6. "Address every point in this review, and verify the fixes completely before reporting."
7. "Run another QA pass over the current branch, including layouts at 1280px, 992px, 820px and 390px."
8. "Re-verify your explanation of the failing Lab 3 server test against the database and the spec files before I accept it."
9. "Compare the Lab 4 documentation with the current GitHub PR and Issue state and the actual test output. Record only verified results, keep main-release checks pending until they run after merge, and do not create a PDF."

### Original wording

| # | Date (UTC) | Message as sent |
|---|---|---|
| 1 | 2026-10-29 16:05 | `@"/Users/song/Downloads/SE+Lab+4.pdf" recieve this info` |
| 2 | 2026-10-29 16:15 and 16:19 | "https://github.com/stickkersz/toktickit/pull/81 let review my friend work with my account", then "i want tone like the past comment on lab3.can u  sent me draft" |
| 3 | 2026-10-30 07:30 | Thai plan pasted: "Prisma migration และ model สำหรับ Actions Taken กับ Status Change; Backfill Status Change ให้ ticket เก่า; Seed ที่รันซ้ำได้ ..." [Prisma migration and models for Actions Taken and Status Change; backfill for old tickets; rerunnable seed] |
| 4 | 2026-10-30 07:47 | Thai list: "ย้าย #65 เป็น Done และปิด Issue; ย้าย #66 เป็น PR Review; เพิ่ม #76 เข้าบอร์ดเป็น Done", then "and next time do it for me auto matic" |
| 5 | 2026-10-31 08:08 | "Start #72" |
| 6 | 2026-10-31 18:43 | partner's fifth review pasted, then "make it correct100persent" |
| 7 | 2026-10-31 19:34 | "can u qa recheck again" |
| 8 | 2026-11-01 06:47 | Thai message about the failing Lab 3 test, ending "recheck" |
| 9 | 2026-11-01 | "Start #73" |

What came of them: #3 led to AC-12 (no invented history, DB-02); #6 found the Supertest port clash
and the 60-of-60 rerun; #7 found two layout bugs the tests had missed (a split "Unassigned" at
1280px, Queue overflow at 992px) and added checks that fail without the fixes.

## How AI output was checked

- Every PR was reviewed by stickkersz, who requested changes many times across the nine PRs before
  approving (rounds are listed per PR in [reviewer.md](reviewer.md)).
- Claims in `tests.md` were only kept as Passed when a test covers them. Several review rounds caught
  rows the AI had marked Pass without coverage and tests that could not fail; each was fixed with a
  real test or by narrowing the row (see the per-PR findings in [reviewer.md](reviewer.md)).
- New checks were confirmed by breaking them on purpose: removing a fix and watching the test fail,
  or running a throwaway spec against the console-error guard.
- Counts in the docs come from reruns on the branch being merged, not from earlier PRs.

## My Reflection

*To be written by Kirakit Kingkaew in my own words before this PR is approved.* An AI-written
first-person reflection would not be evidence of my experience, so this section is intentionally
left for me. Points I plan to cover: which AI suggestions I accepted or rejected and why, what the
review rounds taught me about AI-generated tests and docs, and what I would do differently in the
next lab.

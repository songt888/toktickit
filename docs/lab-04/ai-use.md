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

The list below is a **summary** of nine requests I really made during Lab 4, in cleaner wording. Each
line states only what the original message asked; the exact messages (spelling kept, Thai translated)
are quoted in the table after it.

1. "Here is the Lab 4 handout (SE Lab 4.pdf); confirm you received it."
2. "Review my partner's pull request #81 with my account, and send me a draft in the tone of my Lab 3 comments."
3. "Implement Issue #66 as planned: the Prisma migration and models for Actions Taken and status changes, a backfill for old Tickets, a rerunnable seed, and tests."
4. "Move #65 to Done and close it, move #66 to PR Review, add #76 to the board as Done, and do this automatically from now on."
5. "Start Issue #72."
6. "Here is my partner's fifth review; make the result 100% correct."
7. "QA recheck the work again."
8. "Recheck your explanation of the failing Lab 3 server test."
9. "Start Issue #73."

### Original wording

| # | Date (UTC) | Message as sent |
|---|---|---|
| 1 | 2026-10-29 16:05 | `@"<path>/SE+Lab+4.pdf" recieve this info` (local path shortened) |
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

I used AI for the slow parts of Lab 4: reading the handout, drafting the contract and the review
comments, and writing and rerunning tests. I kept the decisions. I decided what to build, I read each
review comment before it was posted from my account, and I never let the AI approve or merge a PR.
I also told it to move Kanban cards and close Issues by itself, because that was routine and easy to
check on the board.

The AI was most useful when I gave it a clear bar. After my partner's fifth review of PR #83 I said
"make it correct100persent". It reran the whole server suite instead of only the failing test, found
that about one run in eight failed, and traced it to Supertest reaching a different program on the
same port. The fix and a 60-of-60 rerun were in the PR. I would not have found that by rerunning the
test until it went green.

The AI was also wrong in ways I only caught because my partner reviewed carefully. Several test
rows were marked Passed without a test behind them (PR #78, #79, #80 and #82), and some tests could
not fail at all. I accepted those corrections and had the rows narrowed or the tests rewritten. I
refused one shortcut in this report: the migration does not backfill history for old Tickets, because
the contract says history must not be invented, and I preferred a visible note over fake data.

What I learned is that a document is only as good as the run behind it. Every count in `tests.md` now
comes from a rerun on the branch, and the review rounds showed me that "it passed once" is not
evidence. Next time I will run the full suite before I push, write each new test so I can see it fail
without the fix, and ask for the review comments one by one instead of fixing many at once.

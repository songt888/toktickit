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

Each entry keeps the **original prompt exactly as I sent it** (spelling kept; Thai translated in
brackets; times are UTC) and adds a **formal restatement** of the same request. The restatements
are written for this report only, were not sent to the AI, and add no new requirements.

1. **Handout input**, 2026-10-29 16:05
   - Original: `@"/Users/song/Downloads/SE+Lab+4.pdf" recieve this info`
   - Formal: "Read the attached Lab 4 handout (SE Lab 4.pdf) and confirm you have received its requirements."
   - Outcome: Claude read the handout; Issue #65's contract was checked against it.
2. **Peer review from my account**, 2026-10-29 16:15 and 16:19
   - Original: "https://github.com/stickkersz/toktickit/pull/81 let review my friend work with my account", then "i want tone like the past comment on lab3.can u  sent me draft"
   - Formal: "Review my partner's pull request #81 on my behalf. Use the tone of my Lab 3 review comments and send me a draft before anything is posted."
   - Outcome: I read the draft before saying "ok let post". It asked for an Idempotency-Key request fingerprint and two missing Cancel transitions; my partner fixed both and I approved at `42424fe`.
3. **Issue #66 scope**, 2026-10-30 07:30 (pasted plan, Thai)
   - Original: "Prisma migration และ model สำหรับ Actions Taken กับ Status Change; Backfill Status Change ให้ ticket เก่า; Seed ที่รันซ้ำได้ ..." [Prisma migration and models for Actions Taken and Status Change; backfill Status Change for old tickets; a rerunnable seed covering every ticket status with 0, 1 and many Actions and users whose dashboard is zero; tests for migration and seed]
   - Formal: "Implement Issue #66: the Prisma migration and models for Actions Taken and Ticket status events, a backfill for existing Tickets, an idempotent seed covering every status and Action count, and tests for both."
   - Outcome: the approved contract (AC-12) forbids invented history, so the migration adds no backfill and legacy Tickets show a "history not reconstructed" note; DB-02 tests that no rows are invented.
4. **Board automation**, 2026-10-30 07:47 (pasted list, Thai)
   - Original: "ย้าย #65 เป็น Done และปิด Issue; ย้าย #66 เป็น PR Review; เพิ่ม #76 เข้าบอร์ดเป็น Done" [move #65 to Done and close it; move #66 to PR Review; add #76 to the board as Done], then "and next time do it for me auto matic"
   - Formal: "Update the Kanban board as listed, and from now on move cards and close Issues automatically without asking."
   - Outcome: cards moved with each PR state afterwards.
5. **Start an Issue**, 2026-10-31 08:08
   - Original: "Start #72"
   - Formal: "Begin work on Issue #72: create its branch, move its card to Started and implement it."
   - Outcome: this began the hardening PR #83, which went through eight review rounds before approval.
6. **Review round with a quality bar**, 2026-10-31 18:43
   - Original: my partner's fifth review pasted in, then "make it correct100persent"
   - Formal: "Address every point in the attached review and verify the fixes completely before reporting."
   - Outcome: while looping the suite, Claude traced random server failures to Supertest binding a port another local program held on 127.0.0.1, fixed it in `server/tests/setup.ts`, and showed 60 of 60 full runs passing (8 of 60 had failed before).
7. **QA request**, 2026-10-31 19:34
   - Original: "can u qa recheck again"
   - Formal: "Perform another QA pass over the current branch, including the layouts."
   - Outcome: it found two layout bugs the tests had missed ("Unassigned" split mid-word at 1280 px, and the Queue table overflowing at 992 px) and added checks that fail without the fixes.
8. **Challenging a claim**, 2026-11-01 06:47
   - Original: I pasted Claude's own explanation of a failing Lab 3 test back with "recheck".
   - Formal: "Re-verify your explanation of the failing Lab 3 test against the database and the spec files before I accept it."
   - Outcome: Claude verified it and ran the full E2E and server suites again before confirming.

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

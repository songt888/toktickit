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

Quoted exactly from the session logs (spelling kept); Thai is translated in brackets. Times are UTC.

1. **Handout input**, 2026-10-29 16:05: `@"/Users/song/Downloads/SE+Lab+4.pdf" recieve this info`.
   Claude read the Lab 4 handout; Issue #65's contract was then checked against it.
2. **Peer review from my account**, 2026-10-29 16:15 and 16:19:
   "https://github.com/stickkersz/toktickit/pull/81 let review my friend work with my account", then
   "i want tone like the past comment on lab3.can u  sent me draft". Claude drafted the review; I read
   it before saying "ok let post". It asked for an Idempotency-Key request fingerprint and two missing
   Cancel transitions; my partner fixed both and I approved at `42424fe`.
3. **Issue #66 scope**, 2026-10-30 07:30 (pasted plan, Thai): "Prisma migration และ model สำหรับ Actions
   Taken กับ Status Change; Backfill Status Change ให้ ticket เก่า; Seed ที่รันซ้ำได้ ..." [Prisma
   migration and models for Actions Taken and Status Change; backfill Status Change for old tickets;
   a rerunnable seed covering every ticket status with 0, 1 and many Actions and users whose
   dashboard is zero; tests for migration and seed]. The approved contract (AC-12) forbids invented
   history, so the migration adds no backfill and legacy Tickets show a "history not reconstructed"
   note instead; DB-02 tests that no rows are invented.
4. **Board automation**, 2026-10-30 07:47: a pasted list (Thai) "ย้าย #65 เป็น Done และปิด Issue; ย้าย #66
   เป็น PR Review; เพิ่ม #76 เข้าบอร์ดเป็น Done" [move #65 to Done and close it; move #66 to PR Review;
   add #76 to the board as Done], then "and next time do it for me auto matic". From then on cards
   moved with each PR state.
5. **Start an Issue**, 2026-10-31 08:08: "Start #72". This began the hardening PR #83, which went
   through eight review rounds before approval.
6. **Review round with a quality bar**, 2026-10-31 18:43: my partner's fifth review pasted in, then
   "make it correct100persent". While looping the suite, Claude traced the random server failures to
   Supertest binding a port another local program held on 127.0.0.1, fixed it in
   `server/tests/setup.ts`, and showed 60 of 60 full runs passing (8 of 60 had failed before).
7. **QA request**, 2026-10-31 19:34: "can u qa recheck again". The recheck found two layout bugs the
   tests had missed ("Unassigned" split mid-word at 1280 px, and the Queue table overflowing at
   992 px) and added checks that fail without the fixes.
8. **Challenging a claim**, 2026-11-01 06:47: I pasted Claude's own explanation of a failing Lab 3
   test back with "recheck". Claude verified it against the database and the spec files and ran the
   full E2E and server suites again before confirming it.

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

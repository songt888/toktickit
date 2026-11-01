# Lab 4 AI Use and Reflection

## LLMs and tools used

- **OpenAI Codex** in VS Code (the session UI showed GPT-6.1-Sol, high): Lab 4 planning and the first
  draft of the Issue #65 engineering contract, as recorded when the contract was written.
- **Claude Code** in the Claude desktop app, running **Claude Sonnet 5.5** and **Claude Opus 5.5**
  (model ids `claude-sonnet-5-5` and `claude-opus-5-5`, read from the local session logs): reading
  the Lab 4 handout, the contract review rounds on PR #74, implementation of Issues #66 to #72
  (PRs #77 to #83) and the PDF-untracking chore (PR #75, Issue #76), drafting my review comments on my partner's PRs, Kanban updates, and
  this #73 documentation.

I chose what to build and read each review comment before it was posted from my account. My
partner stickkersz formally approved and merged every PR into `lab4-staging`; the AI never approved or
merged a PR.

## Selected real prompts

Ten requests from Lab 4. The "Message as sent" column quotes the message exactly (spelling kept, pasted
text shown as pasted, line breaks shown as spaces), with two marked exceptions: #2 is excerpts because
the full Codex prompt was not kept, and in #3 the local folder of the file path is removed. The "English summary" column is a **summary** I wrote for this report;
it was not sent to the AI.

| # | Tool, date (UTC) | Message as sent | English summary |
|---|---|---|---|
| 1 | Codex, Lab 4 planning session (date not recorded) | `ok accept this plan` | Accept the Lab 4 workflow and Issue plan. It did not approve the contract. Outcome: Issues #65 to #73 and [issue-plan.md](issue-plan.md). |
| 2 | Codex, Lab 4 planning session (date not recorded) | **Excerpts** of the Issue #65 instruction (Thai): "จัดทำเอกสารใน docs/lab-04/"; "กำหนดให้ชัด: Action assignee/status, ขอบเขต append-only, Resolution gate และ Dashboard calculations"; "ตรวจความสอดคล้องของ schema, API, UI, business rules และ AC/test mapping"; "Commit/push แล้วเปิด PR เข้า lab4-staging"; "รอ teammate Approve และ Merge" | Write the documents in `docs/lab-04/`; define Action assignee/status, the append-only boundary, the Resolution gate and the Dashboard calculations; check schema, API, UI, business rules and AC/test mapping for consistency; commit, push and open a PR into `lab4-staging`; wait for the teammate to approve and merge. These are excerpts of one prompt. |
| 3 | Claude Code, 2026-10-29 16:05 | `@"<local folder>/SE+Lab+4.pdf"` `recieve this info` (local folder removed) | Receive the Lab 4 handout. Outcome: the handout was read, and the contract under review in PR #74 was checked against it. |
| 4 | Claude Code, 2026-10-29 16:15 and 16:19 | "https://github.com/stickkersz/toktickit/pull/81 let review my friend work with my account", then "i want tone like the past comment on lab3.can u  sent me draft" | Review my partner's PR #81 with my account, in the tone of my Lab 3 comments, and send me a draft first. |
| 5 | Claude Code, 2026-10-30 07:30 | Pasted brief: "Issue #66 data foundation" with bullets in Thai: "Prisma migration และ model สำหรับ Actions Taken กับ Status Change"; "Backfill Status Change ให้ ticket เก่า"; "Seed ที่รันซ้ำได้ ครอบคลุมทุกสถานะ ticket ที่มี 0, 1 และหลาย action และผู้ใช้ที่ dashboard เป็นศูนย์"; "Test migration และ seed"; "งานอื่นทั้งหมด (API, UI, workflow, dashboard) ต้องรอ issue นี้" | Issue #66: a Prisma migration and models for Actions Taken and status changes; a backfill of status changes for old Tickets; a rerunnable seed covering every Ticket status with 0, 1 and many Actions and users with an empty Dashboard; migration and seed tests; all other work waits for this Issue. |
| 6 | Claude Code, 2026-10-30 07:47 | `let` + pasted "ย้าย #65 เป็น Done และปิด Issue * ย้าย #66 เป็น PR Review * เพิ่ม #76 เข้าบอร์ดเป็น Done", then "* and next time do it for me auto matic" | Move #65 to Done and close it; move #66 to PR Review; add #76 to the board as Done; and do this automatically from now on. Outcome: done as listed; afterwards cards moved and Issues closed with each PR state without asking. |
| 7 | Claude Code, 2026-10-31 08:08 | `Start #72` | Start Issue #72. Outcome: branch `feature/lab4-08-e2e-hardening` and PR #83, approved after eight review rounds and merged as `0512c04`. |
| 8 | Claude Code, 2026-10-31 18:43 | "yo bro, close now, few left: * `StaffTicketQueue.tsx:450,454`: long requester/owner name pushes Owner, Updated, Open Detail out of view at 1280, see queue-scoped-desktop.png (1506px). Same in `UserManagement.tsx:248`, `min-w-0` isn't Bootstrap. * `responsive.spec.ts:90`: waits only for the scope banner, so it measures before Queue rows load. Wait for a row. * `authorization.api.test.ts:197`: /assignee uses the current assignee, so it 400s "already assigned" anyway. Use another Staff, assert fieldErrors.performedById. * `concurrency.api.test.ts:136`: CONC-02 has no timeout (5s default) for 12 rounds, likely your 5s flake. Add 60_000 like CONC-01. * `ui-spec.md:174`: "no clipping" tick isn't true until the Queue fix lands. rest checks out bro, badges and counts are good" (my partner's review, pasted), then `make it correct100persent` | Fix every point in this review, and make the result fully correct. |
| 9 | Claude Code, 2026-10-31 19:34 | `can u qa recheck again` | Run another QA check of the current work. |
| 10 | Claude Code, 2026-11-01 06:47 | Thai text pasted back from an earlier explanation by the AI: "ระหว่างทางมีเทสต์ server ของ Lab 3 พังหนึ่งตัว (เทสต์ที่ค้นหา “_” แล้วต้องไม่เจออะไร) สาเหตุคือ Ticket ทดสอบ 10 ใบที่ RESP-01 รุ่นทดลองของผมสร้างทิ้งไว้ใน DB ในเครื่อง ชื่อมี _ ลบออกแล้วไม่มีข้อมูลค้าง และ spec ตัวจริงใช้คำธรรมดาแล้ว จะไม่เกิดซ้ำ", then `recheck` | The AI said one Lab 3 server test (search for "_" must find nothing) failed because 10 test Tickets from an earlier RESP-01 draft were left in the local database; it deleted them and the real spec uses plain words, so it will not recur. Recheck that. |

What came of them:

- #2: the first draft of the Issue #65 contract, reviewed by my partner in PR #74 (two rounds).
- #4: the draft found two gaps in my partner's contract (no stored fingerprint for Idempotency-Key reuse, and no Cancel from `WAITING_FOR_REQUESTER`/`REOPENED`); I posted it after reading it.
- #5: the migration and seed in PR #77. The brief asked for a backfill, but the already approved contract (AC-12, merged in PR #74 before this prompt) forbids inventing history, so the implementation adds no backfill; legacy Tickets show a "history not reconstructed" note and DB-02 tests that no rows are invented.
- #8: the Supertest port clash behind the random server failures (about 1 run in 8) was found and fixed in `server/tests/setup.ts`, with 60 of 60 full runs passing afterwards.
- #9: the recheck found two layout bugs the tests had missed (a split "Unassigned" at 1280 px, and the Queue overflowing at 992 px) and added checks that fail without the fixes.
- #10: the deleted rows were checked in the database, and the full server and Playwright suites were run again before I accepted it.

## How AI output was checked

- Every PR was reviewed by stickkersz, who requested changes many times across the nine PRs before
  approving (rounds are listed per PR in [reviewer.md](reviewer.md)).
- Claims in `tests.md` were only kept as Passed when a test covers them. Several review rounds caught
  rows the AI had marked Pass without coverage and tests that could not fail; each was fixed with a
  real test or by narrowing the row (see the per-PR findings in [reviewer.md](reviewer.md)).
- New checks were confirmed by breaking them on purpose: removing a fix and watching the test fail,
  or running a throwaway spec against the console-error guard.
- Counts in `tests.md` come from reruns, and each says where it ran: section 4.1 is the pre-release run on the #73 branch at `bfc9e87`. The run on `main` after the release will be recorded in the final follow-up PR.

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
not fail at all. I accepted those corrections and had the rows narrowed or the tests rewritten. My own Issue #66 brief asked for a backfill of status history for old Tickets, but the approved
contract says history must not be invented, so the implementation follows the contract and shows a
visible note instead of fake data.

What I learned is that a document is only as good as the run behind it. Every count in `tests.md` now
says which run it comes from, and the review rounds showed me that "it passed once" is not
evidence. Next time I will run the full suite before I push, write each new test so I can see it fail
without the fix, and ask for the review comments one by one instead of fixing many at once.

# Lab 4 Peer Review Record

Author: Kirakit Kingkaew ([songt888](https://github.com/songt888)).
Requested peer: Nattakit Prasertsak ([stickkersz](https://github.com/stickkersz)).
Status: Issue #65 contract prepared for review; no approval or merge recorded.

## Contract review

- Issue: [#65](https://github.com/songt888/toktickit/issues/65).
- Branch: `feature/lab4-01-contract` -> `lab4-staging`.
- Integration baseline: `9313209d224592c9265bb8595aa7cc0f1336b9db` from released main.
- PR: Pending creation; insert actual URL after GitHub confirms it.
- Formal review: Pending. No teammate comments/responses/approval have occurred
  in this record. Do not treat AI/document checks as teammate approval.
- Merge SHA: Pending. #65 remains open; #66 remains Backlog until approval/merge.

Review focus: Action creator/assignee and lifecycle, editable current projection
versus append-only revisions/events, completed follow-up correction, backend
resolution predicate/legacy zero-Action behavior, Ticket-first/user locking,
replay semantics, precise metrics/time/drill-down rules, migration/recovery,
and AC/test coverage in both directions. The revision model and gate are
proposals that require the peer's formal acceptance or revision.

## Author verification (Issue #65)

Executed on 2026-10-05 (Asia/Bangkok) in the isolated contract worktree:

- `python3 scripts/check-lab4-contract.py`: 24 ACs, 44 planned test IDs,
  69 bidirectional mappings and local links valid (exit 0).
- Prisma 5 validation of a temporary schema combining the existing schema,
  proposed models, inverse relations and Ticket fields/index: valid (exit 0).
  Validation used a dummy URL and did not connect to or migrate a database.
- `npm run build` in server: TypeScript build passed (exit 0).
- `npm run build` in client: TypeScript/Vite build passed (exit 0).
- `git diff --check`: passed (exit 0); repeat before each commit.
- Source comparison: all mandatory handout sections and Answer Parts 1-9 mapped
  in tests.md; API/UI/model/status/gate/metric naming reviewed against the current
  Lab 3 code. New runner/filter capabilities are explicitly marked as increments.

Original workspace hash preservation and final staged-diff check are verified
before commit/push. No Lab 4 feature tests, migration, SQL triggers or runtime
gate/metrics have been executed; their matrix stays Planned. Builds validate
the unchanged application baseline, not the proposed feature implementation.

## Reviews received / responses

No Lab 4 review received yet. On each actual review, record its PR URL,
reviewer, reviewed commit, quoted/paraphrased concern, concrete response,
follow-up verification, formal APPROVED/CHANGES_REQUESTED state and eventual
merge SHA. Use Fixing for requested changes; PR Review after the corrected PR
is ready. A comment is not formal approval.

## Reviews performed for partner

No Lab 4 partner review recorded yet. Add only actual reviewed partner PRs,
reviewed commits, findings and review outcomes. Preserve Lab 3 records in their
own document rather than carrying them forward as Lab 4 evidence.

## Review and release checklist

- [ ] Contract PR URL and actual review request recorded.
- [ ] All feedback resolved and both traceability directions checked again.
- [ ] Teammate formally APPROVED the current revision before merge.
- [ ] Merge to lab4-staging verified; #65 closed and Kanban Done afterward.
- [ ] Each dependent feature Issue starts only after its required reviews/merges.
- [ ] Release PR into main separately reviewed and merged.
- [ ] Final-main verification/evidence follow-up reviewed and merged before #73 Done.

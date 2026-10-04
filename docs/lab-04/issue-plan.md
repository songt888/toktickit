# Lab 4 Issue Plan

Planning date: 2026-10-05. Plan accepted by Kirakit Kingkaew (@songt888).
Peer reviewer: Nattakit Prasertsak (@stickkersz).

Source: `/Users/song/Downloads/SE+Lab+4.pdf`, particularly sections 4-12 and
the Answer Part 1-9 rubric. This index is a plan, not the approved Engineering
Contract or evidence that any feature/test has been implemented.

## GitHub Project and initial status

Project: [TokTickIT Individual Sprints](https://github.com/users/songt888/projects/2).

All nine Issues were created and added to this Project with initial Status
`Backlog`. Issue creation does not imply Started or Specified. Consult the live
Project for current status and update it during each workflow stage.
Each linked Issue contains Scope/exclusions, Acceptance Criteria, Dependencies,
Planned tests, Branch name and Definition of Done. GitHub Issue bodies are the
source of truth for the detailed work packages; this file indexes them.

## Issue sequence and dependencies

| Order | GitHub Issue and scope | Required dependencies | Feature branch |
|---|---|---|---|
| 1 | [#65](https://github.com/songt888/toktickit/issues/65) - Define the Sprint 4 engineering contract and test plan | Released Lab 3 / accepted Lab 4 plan | `feature/lab4-01-contract` |
| 2 | [#66](https://github.com/songt888/toktickit/issues/66) - Implement Actions Taken data foundation, migration and seed | [#65](https://github.com/songt888/toktickit/issues/65) | `feature/lab4-02-actions-data` |
| 3 | [#67](https://github.com/songt888/toktickit/issues/67) - Implement Actions Taken API, authorization and lifecycle | [#65](https://github.com/songt888/toktickit/issues/65), [#66](https://github.com/songt888/toktickit/issues/66) | `feature/lab4-03-actions-api` |
| 4 | [#68](https://github.com/songt888/toktickit/issues/68) - Implement Actions Taken UI and requester read-only visibility | [#65](https://github.com/songt888/toktickit/issues/65), [#67](https://github.com/songt888/toktickit/issues/67) | `feature/lab4-04-actions-ui` |
| 5 | [#69](https://github.com/songt888/toktickit/issues/69) - Enforce final Ticket workflow and resolution gate | [#65](https://github.com/songt888/toktickit/issues/65), [#67](https://github.com/songt888/toktickit/issues/67), [#68](https://github.com/songt888/toktickit/issues/68) | `feature/lab4-05-ticket-workflow` |
| 6 | [#70](https://github.com/songt888/toktickit/issues/70) - Implement requester-owned Dashboard API and UI | [#65](https://github.com/songt888/toktickit/issues/65), [#66](https://github.com/songt888/toktickit/issues/66), [#69](https://github.com/songt888/toktickit/issues/69) | `feature/lab4-06-requester-dashboard` |
| 7 | [#71](https://github.com/songt888/toktickit/issues/71) - Implement IT Staff and Administrator Dashboard API and UI | [#65](https://github.com/songt888/toktickit/issues/65), [#66](https://github.com/songt888/toktickit/issues/66), [#69](https://github.com/songt888/toktickit/issues/69) | `feature/lab4-07-staff-dashboard` |
| 8 | [#72](https://github.com/songt888/toktickit/issues/72) - Complete final regression, E2E, responsive and accessibility hardening | [#65](https://github.com/songt888/toktickit/issues/65), [#66](https://github.com/songt888/toktickit/issues/66), [#67](https://github.com/songt888/toktickit/issues/67), [#68](https://github.com/songt888/toktickit/issues/68), [#69](https://github.com/songt888/toktickit/issues/69), [#70](https://github.com/songt888/toktickit/issues/70), [#71](https://github.com/songt888/toktickit/issues/71) | `feature/lab4-08-e2e-hardening` |
| 9 | [#73](https://github.com/songt888/toktickit/issues/73) - Finalize Lab 4 documentation, evidence and reviewed release | [#65](https://github.com/songt888/toktickit/issues/65), [#66](https://github.com/songt888/toktickit/issues/66), [#67](https://github.com/songt888/toktickit/issues/67), [#68](https://github.com/songt888/toktickit/issues/68), [#69](https://github.com/songt888/toktickit/issues/69), [#70](https://github.com/songt888/toktickit/issues/70), [#71](https://github.com/songt888/toktickit/issues/71), [#72](https://github.com/songt888/toktickit/issues/72) | `feature/lab4-09-docs-release` |

Follow the numbered sequence by default. Dependency links mean approval and
merge are required before implementation, not that those Issues are currently
complete. Wait for teammate approval/merge before the next implementation
Issue. Do not automatically start a second Issue just because another dependency
path permits it.

## Contract decisions to resolve in Issue #65

Issue #65 contract work started on 2026-10-05; the six contract/evidence
documents now exist on `feature/lab4-01-contract` for peer review. `lab4-staging`
was created from released main `9313209d224592c9265bb8595aa7cc0f1336b9db`.
The original planning edits were copied from `docs/lab4-planning` into an
isolated worktree; other local changes remain in the original workspace.
Proposed decisions are recorded in [specification.md](specification.md), not
approved by this index. Consult [reviewer.md](reviewer.md) and the live Project
for the actual PR/review state; #66 remains Backlog until approval/merge.

1. **Action actor and assignee:** distinguish backend-attributed creator /
   performed-by from approved active assignee and the primary Ticket Owner.
   Include assign/edit/status/complete/cancel and inactive-assignee rejection
   required by Answer Part 6.
2. **Editable versus append-only:** specify exactly what can be updated and what
   is immutable under Answer Part 7. An append-only revision/audit history is a
   possible design, not an already approved implementation requirement.
3. **Resolution gate:** define the exact predicate, all eight Ticket status
   transitions, roles, legacy zero-Action behavior and concurrency semantics.
   The Requester's advisory indication must not itself formally resolve a Ticket.
4. **Dashboard calculations:** define count formulas, current-user Actions scope,
   timezone/date boundaries, bounded recent/urgent lists, zero states and
   drill-down destinations/query parameters.
5. **Data and failure safety:** concrete schema, at least two DB justifications,
   preserving populated Lab 3 data, migration/recovery, repeatable seeds,
   conflict/retry handling and drafts after recoverable failures.
6. **Traceability:** reconcile FR/BR/AC/API/UI/model names and both directions of
   the AC/test matrix before seeking contract approval.

## Verification and evidence plan

Tests will live in `server/tests/lab-04/`, `client/tests/lab-04/` and
`e2e/lab-04/`. Required baseline files include:

- `server/tests/lab-04/actions-taken.api.test.ts`
- `server/tests/lab-04/ticket-workflow.api.test.ts`
- `server/tests/lab-04/requester-dashboard.api.test.ts`
- `server/tests/lab-04/staff-dashboard.api.test.ts`
- `client/tests/lab-04/ActionsTaken.test.tsx`
- `client/tests/lab-04/TicketWorkflow.test.tsx`
- `client/tests/lab-04/RequesterDashboard.test.tsx`
- `client/tests/lab-04/StaffDashboard.test.tsx`
- `e2e/lab-04/actions-taken-flow.spec.ts`
- `e2e/lab-04/ticket-resolution.spec.ts`
- `e2e/lab-04/dashboards.spec.ts`

The Issues additionally plan migration/seed preservation, independent transition
tests, authorization, concurrent/stale writes, retry/double-submit,
performance-smoke, responsive and accessibility checks. These paths describe
future tests, not existing passing evidence. All unexecuted tests remain Planned.

Keep screenshots under `artifacts/lab-04/screenshots/`, grouped by
`staff-dashboard/`, `requester-dashboard/` and `actions-taken/`, and index
workflow/regression evidence accurately. Capture meaningful states and network /
requester context rather than filenames alone. Inspect all major screens at
1280px, 820px and 390px with keyboard access and overflow checks.

## Branch and release rules

- Planning edits are isolated on `docs/lab4-planning`, based on released
  `main` commit `9313209`. No direct main development or commit is allowed.
- Create integration branch `lab4-staging` from the latest released main.
- Each feature PR targets `lab4-staging` and requires formal teammate approval.
- Close each feature Issue and move it to Done only after approval and merge.
- Issue #73 remains open through release and final verification; closing its
  feature documentation PR is not enough to mark release complete.
- Release `lab4-staging -> main` through a reviewed PR.
- Run all suites/builds/migration/seed/E2E from the released main. Record actual
  merge SHA/results through a separate branch and reviewed follow-up PR.
- No final check is Passed until run; do not copy Lab 3 test totals.
- Prepare evidence for `Answer Part 1` through `Answer Part 9`, but do not
  generate/edit a PDF unless separately requested.

## Out of scope

SLA/escalation, external notification services, inventory/cost accounting,
payroll, advanced BI, multitenancy and new unapproved product features.

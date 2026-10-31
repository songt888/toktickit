# Lab 4 screenshot index

Every PNG here is written by a Playwright spec under `e2e/lab-04/`, so it can be regenerated with
`npx playwright test --project=lab4-desktop`. Widths: desktop 1280 px, tablet 820 px, mobile 390 px.

## Answer Part 5: Staff/Administrator Dashboard

| Screenshot | Shows | Spec |
| --- | --- | --- |
| `staff-dashboard/staff-desktop.png`, `-tablet`, `-mobile` | Metric cards, 8 status and 4 IT-priority buckets, My Pending Actions, Urgent and Recently Updated lists; values checked against SQL | `dashboards.spec.ts` (E2E-03) |
| `staff-dashboard/refresh-failure.png` | Zero state for a new Staff user, then a failed refresh keeping older data with Retry | `dashboards.spec.ts` (E2E-03 failure injection) |
| `responsive/queue-scoped-*.png` | Drill-down: a card opens the Ticket Queue with its exact scope banner | `responsive.spec.ts` (RESP-01) |
| `responsive/my-pending-actions-*.png` | The My Pending Actions drill-down page | `responsive.spec.ts` |
| `responsive/staff-dashboard-*.png` | Staff Dashboard at all three widths with overflow and clipping checks | `responsive.spec.ts` |

## Answer Part 6: Actions Taken

| Screenshot | Shows | Spec |
| --- | --- | --- |
| `actions-taken/staff-*.png` | Actions by two staff: assign, reassign, edit, start, complete with result, cancel with reason, history | `actions-taken-flow.spec.ts` (E2E-01) |
| `responsive/action-create-*.png` | Add Action form | `responsive.spec.ts` |
| `responsive/action-edit-*.png` | Edit Action form | `responsive.spec.ts` |
| `responsive/action-complete-*.png` | Complete Action form (result required) | `responsive.spec.ts` |
| `responsive/action-cancel-*.png` | Cancel Action form (reason and confirmation) | `responsive.spec.ts` |
| `actions-taken/invalid-assignee.png` | Action assigned to a deactivated user: flagged "Not eligible", work buttons disabled, user not selectable | `ticket-resolution.spec.ts` (E2E-02) |
| `accessibility/cancel-panel-errors.png` | Validation errors announced on the cancel form | `accessibility.spec.ts` (A11Y-01) |

## Answer Part 7: Ticket workflow, resolution gate and history

| Screenshot | Shows | Spec |
| --- | --- | --- |
| `ticket-resolution/gate-failed.png` | Resolved disabled: 1 completed, 1 pending, 1 unsettled follow-up, with the reason | `ticket-resolution.spec.ts` (E2E-02) |
| `ticket-resolution/staff-cancelled.png` | After resolve, close, reopen and cancel: Actions locked | `ticket-resolution.spec.ts` |
| `ticket-resolution/requester-shared-history.png` | The Requester sees the same Actions, results and revision history, read-only | `ticket-resolution.spec.ts` |
| `responsive/action-history-*.png` | Revision history in version order | `responsive.spec.ts` |

## Answer Part 8: Requester Dashboard and regression

| Screenshot | Shows | Spec |
| --- | --- | --- |
| `requester-dashboard/requester-desktop.png`, `-tablet`, `-mobile` | Owned metrics, needs-attention and recent lists; values checked against SQL | `dashboards.spec.ts` (E2E-03) |
| `requester-dashboard/refresh-failure.png` | Zero state for a new Requester, then a failed refresh keeping older data with Retry | `dashboards.spec.ts` |
| `actions-taken/requester-*.png`, `responsive/requester-detail-actions-*.png` | Requester Ticket Detail with read-only Actions | `actions-taken-flow.spec.ts`, `responsive.spec.ts` |
| `../../lab-03/screenshots/`, `../../lab-02/screenshots/` | Labs 2-3 screens still produced by their own specs in the same run | `e2e/lab-02/`, `e2e/lab-03/` |

Labs 1-3 behaviour (auth, password change, logout, Tickets, attachments, comments, Queue owner and IT priority, Internal Notes, Administrator safety) is asserted without screenshots in `e2e/lab-04/regression.spec.ts` (E2E-04).

## Answer Part 9: Responsive and accessible UI

| Screenshot | Shows | Spec |
| --- | --- | --- |
| `responsive/*-desktop.png`, `*-tablet.png`, `*-mobile.png` | 11 Lab 4 screens at 1280/820/390 px; each fails the run on page overflow or a control cut off at the edge | `responsive.spec.ts` (RESP-01) |
| `accessibility/cancel-panel-errors.png` | Keyboard-opened form with focus moved in and errors tied to fields | `accessibility.spec.ts` (A11Y-01) |

Performance evidence (no screenshot): `../performance/perf-01.md`.

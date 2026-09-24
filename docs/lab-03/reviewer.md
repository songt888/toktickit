# Lab 3 Peer Review Record

## Author

Kirakit Kingkaew - Student ID `67070503460` - GitHub `@songt888`

## Peer reviewer

Nattakit Prasertsak - Student ID `67070503413` - GitHub `@stickkersz`

## Pull Requests Reviewed for My Partner

This section will record the Pull Request number, URL, reviewer comment,
partner response, approval, and merge status for each Lab 3 review I complete.

| PR | Issue | URL | Comment | Partner response | Approval/Merge |
|---|---|---|---|---|---|
| To be added | To be added | To be added | To be added | To be added | To be added |

## Reviews Received on My Lab 3 Pull Requests

This section will be updated after each PR is opened. Each entry will preserve
the reviewer's useful feedback, my response, and the final approval/merge
status.

| PR | Issue | URL | Reviewer comment | My response | Approval/Merge |
|---|---|---|---|---|---|
| To be added | Issue 1 | To be added | Contract review pending | To be added after review | Pending |
| #54 | Issue #44 | [Implement Staff ticket ownership and workflow](https://github.com/songt888/toktickit/pull/54) | Requested an int32 ticket-ID limit and regression case, an independently specified status-transition test, and E2E-06 wording that matches the implemented workflow. Also noted unbounded ID parsing in requester ticket detail and create-ticket reference validation. | Capped parsed database IDs, added oversized-ID 404 assertions for staff mutations and requester detail, rejected out-of-range category/system IDs before Prisma queries, hard-coded the expected transition matrix from `api-spec.md`, and corrected E2E-06. The full server suite now passes (74 tests across 24 files); builds and diff checks pass. | Fixes pushed; awaiting formal approval and merge |
| #55 | Issue #41 | [Add Staff public comments and internal notes](https://github.com/songt888/toktickit/pull/55) | Awaiting teammate review. | Followed approved AC-15: markup-like content is stored as text and rendered literally. Added role/ownership, validation, append-only, UI, and attachment-continuity coverage; server/client tests and builds pass. | Open; awaiting teammate approval and merge |

### PR #38 contract feedback addressed

The reviewer identified ten contract consistency issues before Issue 2 and
Issue 3 implementation. I updated the documents to make staff attachment
metadata/download access explicit while keeping upload/removal requester-only,
added `problemAppearsResolved` to staff detail, chose `403` for Internal Notes
on an owned Ticket and safe `404` for cross-owner access, made logout idempotent
with `204`, and changed a wrong current password to `400`.

I also added `updatedAt` to staff mutation requests for optimistic concurrency,
blocked last-Administrator role demotion as well as deactivation, aligned the
comment policy around safe plain-text rendering, documented the required
placeholder password hash and seed overwrite rule, and regenerated the test
matrix/traceability mappings. Approval is still pending after these changes.

## Review Checklist

- [ ] Reviewer identity is recorded.
- [ ] PR URL and Issue number are recorded.
- [ ] Feedback is summarized accurately.
- [ ] Response explains the change or decision.
- [ ] Formal teammate approval is recorded, not only a comment.
- [ ] Merge commit is recorded after merge.
- [ ] Kanban status is updated after the PR is merged.

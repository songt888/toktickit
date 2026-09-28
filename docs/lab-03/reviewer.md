# Lab 3 Peer Review Record

## Author

Kirakit Kingkaew - Student ID `67070503460` - GitHub `@songt888`

## Peer reviewer

Nattakit Prasertsak - Student ID `67070503413` - GitHub `@stickkersz`

## Pull Requests Reviewed for My Partner

The following records summarize my reviews of my partner's Lab 3 PRs. I kept
the comments short but preserved the requested fix and the final review state.

| PR | Issue | URL | Comment | Partner response | Approval/Merge |
|---|---|---|---|---|---|
| #38 | Lab 3 Issue 1 | [Sprint 3 engineering contract](https://github.com/stickkersz/toktickit/pull/38) | Requested a clear password migration sequence, separate staff attachment permissions, inactive-owner behavior, and matching tests; later requested a small BR-58/API wording fix. | Partner added the migration, authorization, inactive-owner, and wording details with coverage. | Approved and merged on 2026-09-19. |
| #47 | Lab 3 Issue 2 | [Auth foundation](https://github.com/stickkersz/toktickit/pull/47) | Requested credentialed CORS and isolated authentication tests; later noted an outdated Vite-proxy note. | Partner fixed CORS, test isolation, and the proxy documentation. | Approved and merged on 2026-09-19. |
| #48 | Lab 3 Issue 3 | [Login and Change Password screens](https://github.com/stickkersz/toktickit/pull/48) | Requested direct-route role protection and removal of legacy requester selection for Staff/Admin. | Partner added the route and selector regression coverage. | Approved and merged on 2026-09-19. |
| #49 | Lab 3 Issue 4 | [Role navigation and requester regression](https://github.com/stickkersz/toktickit/pull/49) | Checked session-based requester identity, role navigation, and authorization before upload parsing. | Partner fixed the selector/session flow and added regression coverage. | Approved and merged on 2026-09-19. |
| #50 | Lab 3 Issue 5 | [IT Staff Ticket Queue](https://github.com/stickkersz/toktickit/pull/50) | Checked queue authorization, filters, sorting, pagination, owner markers, priority backfill, and responsive behavior. | Partner completed the queue flow and verified the documented test/build counts. | Approved and merged on 2026-09-19. |
| #51 | Lab 3 Issue 6 | [Staff Ticket operations and Ticket Detail](https://github.com/stickkersz/toktickit/pull/51) | Requested race-safe status updates, scoped client state updates, and safe refresh-failure handling. | Partner added the concurrency guards, scoped updates, and Reload state for failed refreshes. | Approved and merged on 2026-09-19. |
| #52 | Lab 3 Issue 7 | [Public Comments and Internal Notes](https://github.com/stickkersz/toktickit/pull/52) | Requested seeded Public Comments/Internal Notes and rerun tests proving no duplicates or overwrites. | Partner added the seed examples and idempotency coverage. | Approved and merged on 2026-09-24. |
| #53 | Lab 3 Issue 8 | [Administrator User Management](https://github.com/stickkersz/toktickit/pull/53) | Checked the user-management flow and Administrator safeguards; noted README wording as non-blocking cleanup. | Partner completed the Admin flow and tests. | Approved and merged on 2026-09-24. |
| #54 | Lab 3 Issue 9 | [E2E and responsive pass](https://github.com/stickkersz/toktickit/pull/54) | Requested name-based category/system lookups instead of hard-coded IDs and a wait for the resolved screenshot. | Partner changed the lookups and synchronization, then retested. | Approved and merged on 2026-09-27. |
| #56 | Pre-release review fixes | [Pre-release code review fixes](https://github.com/stickkersz/toktickit/pull/56) | Checked the breadcrumb, traceability, and documentation fixes. | Partner applied the requested pre-release documentation fixes. | Approved and merged on 2026-09-27. |
| #57 | Release | [Lab 3 release](https://github.com/stickkersz/toktickit/pull/57) | Requested one Prisma transaction for password update plus other-session revocation, with a rollback test. | Partner implemented the atomic password/session update and rollback coverage in [PR #59](https://github.com/stickkersz/toktickit/pull/59). | Fix merged in PR #59 on 2026-09-28; release PR #57 remains open for final review. |

## Reviews Received on My Lab 3 Pull Requests

The entries below summarize useful reviewer feedback, my response, and the
verified approval/merge status.

| PR | Issue | URL | Reviewer comment | My response | Approval/Merge |
|---|---|---|---|---|---|
| #38 | Issue 1: engineering contract | [Define Lab 3 engineering contract](https://github.com/songt888/toktickit/pull/38) | The reviewer found contract inconsistencies around attachment access, resolution fields, safe errors, logout, optimistic concurrency, last-admin protection, comment safety, seed passwords, and AC/test traceability. | I aligned the specification, API/UI contracts, data rules, and traceability table, then addressed a second review pass on the remaining test mappings and response details. | Approved and merged to `lab3-staging` (`b6a5f87`) on 2026-09-19. |
| #49 | Lab 3 Issue 2: user data foundation | [Lab 3 Issue 2: User data foundation](https://github.com/songt888/toktickit/pull/49) | Review found schema/migration drift, shared password salts, a sequence reset that could reuse numbers, parallel-test flakiness, and missing migration-preservation coverage. | I synchronized the migration and schema, generated a password hash per user, removed the sequence rewind, made seed reruns stable under parallel tests, and added preservation/hash assertions. | Approved and merged to `lab3-staging` (`401a944`) on 2026-09-19. |
| #50 | Lab 3 Issue 3: authentication | [Implement Lab 3 Issue 3 authentication and sessions](https://github.com/songt888/toktickit/pull/50) | Review identified a timing difference for unknown users, a logout test that did not prove revocation, missing session/origin cases, and the absent same-origin Vite proxy. | I added dummy password verification, replayed the revoked cookie in tests, covered inactive/expired sessions and origin checks, and configured the proxy. | Approved and merged to `lab3-staging` (`4fffd75`) on 2026-09-19. |
| #51 | Issue #45 | [Migrate requester workflow to authenticated sessions](https://github.com/songt888/toktickit/pull/51) | Review found stale My Tickets data after returning from Create Ticket, shared requester fixtures racing a seed-count test, inaccurate test totals, and authorization paths not protected against mutation. | I refreshed the list when it becomes visible, isolated the fixtures, corrected the results, and added tests that fail if session identity/header protections are removed. | Approved and merged to `lab3-staging` (`eb13c09`) on 2026-09-19. |
| #52 | Issue #47 | [Add requester public comments and resolution indication](https://github.com/songt888/toktickit/pull/52) | Review found comment-load and submit states could overwrite each other, the form was usable before loading finished, and author/order/length/timestamp behaviors needed stronger tests. | I disabled the form until comments load, separated load and submit errors, added the requested API assertions, and preserved the original resolution timestamp on repeated requests. | Approved and merged to `lab3-staging` (`717c8f0`) on 2026-09-19. |
| #53 | Issue #43 | [Implement IT Staff ticket queue](https://github.com/songt888/toktickit/pull/53) | Review found missing int32 query bounds, a clipped tablet control, traceability mismatch, weak coverage for sorting/search/forbidden behavior, and wildcard search characters matching too broadly. | I added bounded parsing and literal wildcard handling, widened the control, corrected the test mapping, and added the missing independent API assertions. | Approved and merged to `lab3-staging` (`c25168b`) on 2026-09-24. |
| #54 | Issue #44 | [Implement Staff ticket ownership and workflow](https://github.com/songt888/toktickit/pull/54) | Review found missing int32 ticket-ID bounds, a weak missing-ticket test, a transition test that asserted the matrix against itself, and inaccurate E2E wording; follow-ups covered requester detail and create-ticket ID bounds too. | I added the bounds and regression assertions, hard-coded the allowed transition pairs from the specification, corrected the E2E description, and verified the oversized-ID cases return safe client errors. | Approved and merged to `lab3-staging` (`d9578c6`) on 2026-09-24. |
| #55 | Issue #41 | [Add Staff public comments and internal notes](https://github.com/songt888/toktickit/pull/55) | The reviewer verified role/ownership responses, append-only behavior, server-controlled author/time, safe literal rendering, and distinct comment/note styling. | I followed the approved plain-text policy and added API/UI, validation, append-only, ownership, and attachment-continuity coverage. | Approved and merged to `lab3-staging` (`b75ef06`) on 2026-09-27. |
| #56 | Issue #42 | [Implement Administrator user management](https://github.com/songt888/toktickit/pull/56) | The reviewer confirmed Administrator-only route guards, safe user fields, case-insensitive email handling, last-admin/self-deactivation protections, validation, and wildcard search tests. | I implemented the Admin workflow and added API/UI/E2E coverage for the listed access and safety rules. | Approved and merged to `lab3-staging` (`5a67740`) on 2026-09-27. |

## Review Checklist

- [x] Reviewer identity is recorded.
- [x] PR URL and Issue number are recorded.
- [x] Feedback is summarized accurately.
- [x] Response explains the change or decision.
- [x] Formal teammate approval is recorded, not only a comment.
- [x] Merge commit is recorded after merge.
- [x] Kanban status is updated after the PR is merged.

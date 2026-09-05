# Lab 2 — Peer Review Record

**Author:** Kirakit Kingkaew — [67070503460] — GitHub: [@songt888](https://github.com/songt888)

**Peer reviewer:** Nattakit Prasertsak — [67070503413] — GitHub: [@stickkersz](https://github.com/stickkersz)

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#26](https://github.com/songt888/toktickit/pull/26) | `feature/lab2-01-contract` | Reviewed, corrected, and merged |
| [#27](https://github.com/songt888/toktickit/pull/27) | `feature/lab2-02-data-foundation` | Reviewed, corrected, and merged |
| [#28](https://github.com/songt888/toktickit/pull/28) | `feature/lab2-03-requester-context` | Reviewed, corrected, and merged |
| [#29](https://github.com/songt888/toktickit/pull/29) | `feature/lab2-04-create-ticket` | Reviewed, corrected, and merged |
| [#30](https://github.com/songt888/toktickit/pull/30) | `feature/lab2-05-my-tickets` | Reviewed, corrected, and merged |
| [#31](https://github.com/songt888/toktickit/pull/31) | `feature/lab2-06-ticket-detail` | Reviewed, corrected, and merged |
| [#32](https://github.com/songt888/toktickit/pull/32) | `feature/lab2-07-attachments` | Reviewed, corrected, and merged |
| [#33](https://github.com/songt888/toktickit/pull/33) | `feature/lab2-08-e2e-responsive` | Reviewed, corrected, and merged |
| [#34](https://github.com/songt888/toktickit/pull/34) | `feature/lab2-09-docs-release` | Reviewed, evidence corrections completed, and merged by `@stickkersz` |
| [#35](https://github.com/songt888/toktickit/pull/35) | `lab2-staging` → `main` | [Formally approved by `@stickkersz`](https://github.com/songt888/toktickit/pull/35#pullrequestreview-5121978636) and merged |

Reviewer comments I received: The reviewer requested clearer Prisma and API contracts, inactive
reference fixtures, requester-context accessibility, documented validation responses, protection
against stale UI responses, preserved My Tickets state, atomic attachment limits, stronger
ownership assertions, and wider responsive checks.

How I responded: I updated the specification and implementation, added the missing database,
API, UI, concurrency, and responsive tests, reran the relevant suites, and asked the reviewer to
check each follow-up before the feature PR was approved and merged.

## Pull Requests I reviewed for my partner

Partner repository: [stickkersz/toktickit](https://github.com/stickkersz/toktickit)

| PR | Branch | My reviewer verdict |
|----|--------|---------------------|
| [#12](https://github.com/stickkersz/toktickit/pull/12) | `feature/lab2-spec-docs` | [Approved after requested contract fixes](https://github.com/stickkersz/toktickit/pull/12#pullrequestreview-5052818505) |
| [#14](https://github.com/stickkersz/toktickit/pull/14) | `feature/lab2-02-db-seed` | [Approved after API error-contract fix](https://github.com/stickkersz/toktickit/pull/14#pullrequestreview-5053292071) |
| [#16](https://github.com/stickkersz/toktickit/pull/16) | `feature/lab2-03-requester-context` | [Approved after context, dependency, UI, and test fixes](https://github.com/stickkersz/toktickit/pull/16#pullrequestreview-5053627936) |
| [#18](https://github.com/stickkersz/toktickit/pull/18) | `feature/lab2-04-create-ticket` | [Approved after validation and upload-failure fixes](https://github.com/stickkersz/toktickit/pull/18#pullrequestreview-5054149054) |
| [#20](https://github.com/stickkersz/toktickit/pull/20) | `feature/lab2-05-my-tickets` | [Approved after failure, responsive, navigation, and keyboard fixes](https://github.com/stickkersz/toktickit/pull/20#pullrequestreview-5054639229) |
| [#22](https://github.com/stickkersz/toktickit/pull/22) | `feature/lab2-06-ticket-detail-attachments` | [Approved after active-owner, concurrency, and accessibility fixes](https://github.com/stickkersz/toktickit/pull/22#pullrequestreview-5069258261) |
| [#24](https://github.com/stickkersz/toktickit/pull/24) | `feature/lab2-07-e2e-responsive` | [Approved after port, Node compatibility, and contrast fixes](https://github.com/stickkersz/toktickit/pull/24#pullrequestreview-5069849349) |
| [#26](https://github.com/stickkersz/toktickit/pull/26) | `feature/lab2-08-submission-docs` | [Approved after final documentation verification](https://github.com/stickkersz/toktickit/pull/26#pullrequestreview-5089736537) |

Reviewer comments partner received: I reviewed the engineering contract, database seed, requester
context, ticket creation, My Tickets, Ticket Detail, attachments, responsive E2E flow, and final
documentation. My comments focused on API consistency, active-user ownership, safe partial
failure, concurrency, accessibility, responsive behavior, and reliable automated evidence.

How partner responded: My partner replied with the follow-up commit for each review, explained the
changes, added regression tests, and reported the verification results. I reviewed the updated
commits and gave formal approval only after the requested changes were complete.

## Review checklist

- [x] Author and peer-reviewer identities are recorded.
- [x] Authored and reviewed PR URLs are working links.
- [x] Comments received, my responses, comments given, partner responses, and approvals are documented.
- [x] [Release PR #35](https://github.com/songt888/toktickit/pull/35) from `lab2-staging` to `main` was formally approved by Nattakit Prasertsak ([@stickkersz](https://github.com/stickkersz)) and merged as commit `b985c9a`.

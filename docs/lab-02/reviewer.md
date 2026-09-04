# Lab 2 Peer Review Evidence

## Pull Requests I reviewed for my partner

No partner pull requests are recorded in this repository. The Lab 2 pull requests below
were authored by me and reviewed by my teammate.

## Reviews I received

Reviewer: **stickkersz (TonklaNattakit)**

| PR | Branch | Comment received and response | Approval / merge evidence |
|---|---|---|---|
| [#26](https://github.com/songt888/toktickit/pull/26) | `feature/lab2-01-contract` | The reviewer requested concrete Prisma/schema decisions, documented status codes, requester-header behavior, and AC traceability. I added the schema, PostgreSQL sequence strategy, response rules, and test mappings in `9452f48` and `e6e84a0`. | Reviewer confirmed both follow-ups and said “Good to merge” in [this comment](https://github.com/songt888/toktickit/pull/26#issuecomment-5454976752). |
| [#27](https://github.com/songt888/toktickit/pull/27) | `feature/lab2-02-data-foundation` | The reviewer asked for inactive Category and Related System seed rows. I added idempotent inactive fixtures, active filtering, and seed assertions in `a209810`. | Reviewer confirmed the fixtures and tests, then said “Good to merge from my side” in [this comment](https://github.com/songt888/toktickit/pull/27#issuecomment-5455485428). |
| [#28](https://github.com/songt888/toktickit/pull/28) | `feature/lab2-03-requester-context` | The reviewer asked me to clarify the fixed `active=true` contract and add a status role to the empty state. I documented the contract and added the accessibility role in `266615e`. | Reviewer confirmed both fixes and said “Good to merge from my side” in [this comment](https://github.com/songt888/toktickit/pull/28#issuecomment-5455946156). |
| [#29](https://github.com/songt888/toktickit/pull/29) | `feature/lab2-04-create-ticket` | The reviewer noted that attachments were deferred and `fieldErrors` was undocumented. I added clear UI wording and documented the validation response in `01d50a6`. | Reviewer confirmed both changes and said “Good to merge from my side” in [this comment](https://github.com/songt888/toktickit/pull/29#issuecomment-5456639124). |
| [#30](https://github.com/songt888/toktickit/pull/30) | `feature/lab2-05-my-tickets` | The reviewer identified stale out-of-order responses, redundant reference-data requests, and indistinguishable priority badges. I split the effects, added sequence guards, value-specific badges, and a regression test in `0a72520`. | Reviewer verified the behavior and explicitly wrote “Approved, LGTM” in [this comment](https://github.com/songt888/toktickit/pull/30#issuecomment-5457312979). |
| [#31](https://github.com/songt888/toktickit/pull/31) | `feature/lab2-06-ticket-detail` | The reviewer requested My Tickets state preservation, an active navigation indication, typed HTTP error handling, and accurate API-08 traceability. I kept My Tickets mounted, added the navigation/error fixes, and corrected the evidence mapping in `d53e24e`. | Reviewer confirmed all four fixes and wrote “all good, merging” in [this comment](https://github.com/songt888/toktickit/pull/31#issuecomment-5482134792). |
| [#32](https://github.com/songt888/toktickit/pull/32) | `feature/lab2-07-attachments` | The reviewer found a race in the five-active-attachment limit. I added a PostgreSQL advisory transaction lock, serialized count-plus-insert, and a concurrent regression test in `5e4aa41`. | Reviewer verified the locking and deterministic test, then wrote “all good, merging” in [this comment](https://github.com/songt888/toktickit/pull/32#issuecomment-5482907543). |
| [#33](https://github.com/songt888/toktickit/pull/33) | `feature/lab2-08-e2e-responsive` | The reviewer asked for overflow checks on the visible My Tickets/Ticket Detail views and a dynamic, exact cross-requester assertion. I added both checks, extra viewport screenshots, and documentation in `a3303a3`. | Reviewer verified both fixes and wrote “all good, merging” in [this comment](https://github.com/songt888/toktickit/pull/33#issuecomment-5483718879). |

## Review checklist

- [x] Reviewer identity is recorded.
- [x] PR URLs are working links.
- [x] Comments received and responses are documented accurately.
- [x] Teammate review/merge comments are recorded for PRs #26-#33.
- [ ] Lab 2 release PR approval is recorded; release PR is intentionally not opened yet.

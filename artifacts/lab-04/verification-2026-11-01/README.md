# Final-main verification, 2026-11-01

Released `main` SHA `991b254` (merge of release PR #85; tree equals `b10c7dc`), checked out with no
local changes. Local Docker PostgreSQL 16, Node v24.19.0, 12:25:58 to 12:27:21 UTC.

Each `.log` starts with the command, SHA and start time and ends with the exit code and finish time.
Local absolute paths are replaced with `<repo>`. `03-seed-counts.txt` holds Lab 4 fixture Tickets,
Actions, revisions, status events and Users (`|`-separated) before and after each seed run.

| Log | Command | Result |
|---|---|---|
| `01-migrate-deploy.log` | `server: npm exec -- prisma migrate deploy` | No pending migrations |
| `02-migrate-status.log` | `server: npm exec -- prisma migrate status` | Up to date |
| `03a-seed-1.log`, `03b-seed-2.log` | `server: npm run prisma:seed` | Counts unchanged (11, 956, 1995, 1607, 2304) |
| `04-server-test.log` | `server: npm test -- --reporter=verbose` | 186 passed, 1 skipped (PERF-01) |
| `05-server-perf.log` | `server: npm run test:perf` | 1 passed |
| `06-server-build.log` | `server: npm run build` | Passed |
| `07-client-test.log` | `client: npm test -- --reporter=verbose` | 132 passed |
| `08-client-build.log` | `client: npm run build` | Passed |
| `09-e2e-list.log` | `npm run test:e2e -- --list` | 26 tests in 14 files |
| `10-e2e.log` | `npm run test:e2e -- --workers=1 --reporter=list` | 26 passed |
| `11-contract.log` | `python3 scripts/check-lab4-contract.py` | 24 ACs, 44 IDs, 69 mappings |
| `12-diff-check.log` | `git diff --check` | Clean |

All 13 steps exited 0. Screenshots rewritten by the E2E run were restored afterwards.

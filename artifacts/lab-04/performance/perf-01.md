# PERF-01 Dashboard performance smoke

Command: `cd server && npm run test:perf` (sets `PERF=1`; plain `npm test` skips this file; each run creates and drops its own `toktickit_perf_<pid>_<time>` database) (last run 2026-10-31).

## Conditions

- Separate database `toktickit_perf_<pid>_<time>` per run (created, migrated with `prisma migrate deploy`, dropped after the run); shared test data is never touched. A failed migration fails the run with its output.
- 10,000 Tickets spread over every status and IT priority, a fifth owned by the measured Requester, owners split between two Staff users and unassigned, updates over the last 60 days.
- 30,000 Actions (three per Ticket, every Action status), each with its initial revision. `ANALYZE` before measuring.
- Requests go through the real Express app (Supertest) with a session cookie. One untimed warm-up, then five sequential timed requests per endpoint.
- Statements = data `SELECT`s logged by Prisma for one request (transaction control excluded).
- Machine: Apple M5, 16 GB RAM, macOS; Node v24.19.0; PostgreSQL 16.15 in Docker.

## Budget and result

| Endpoint | SELECT statements (max 12) | Body bytes (max 32,768) | Median ms (max 1,000) | Max ms (max 2,000) |
| --- | --- | --- | --- | --- |
| `GET /api/dashboard/requester` | 7 | 2,267 | 5 | 6 |
| `GET /api/dashboard/staff` (IT Staff) | 12 | 6,233 | 12 | 15 |
| `GET /api/dashboard/staff` (Administrator) | 12 | 6,238 | 10 | 11 |
| `GET /api/staff/actions-taken?pageSize=50` | 5 | 14,768 | 6 | 6 |

Statement counts do not grow with data size: every metric is a count or grouped count, and each list is a single bounded query (no per-row lookups).
The Staff Dashboard first used 13 statements; the unassigned and my-Tickets counts were merged into one grouped query to meet the budget.

## Query plans

Every run writes `EXPLAIN` for each measured request's `SELECT`s, using the values that request sent, to [`perf-01-plans.txt`](perf-01-plans.txt) (36 statements).

- Requester counts and the recent list, My Actions and the IT-priority counts use indexes (`Ticket_requesterId_…`, `ActionTaken_assigneeId_status_updatedAt_id_idx`, `Ticket_currentStatus_itPriority_updatedAt_idx`).
- The all-status count reads every Ticket by design, because it counts all 8 statuses.
- The Staff "recently updated" list (`updatedAt` window, no owner) is a sequential scan plus top-5 sort (planner estimate: all 10,000 Tickets scanned to find about 1,155 in the window, total cost about 1,293), because no index starts with `updatedAt`. Plans are plain `EXPLAIN`, so they give estimates, not timings; the whole Staff Dashboard request, this query included, has the 12 ms median above. An index on `("updatedAt" DESC, id DESC)` would remove the scan; it is not added here, since it needs a migration and the budget is met.
- Seq scans on `User` and `AuthSession` are on tables of a few rows.

Raw log line:

```json
{"perf":"PERF-01","node":"v24.19.0","postgres":"PostgreSQL 16.15","tickets":10000,"actions":30000,"budget":{"statements":12,"bodyBytes":32768,"medianMs":1000,"maxMs":2000},"results":{"requester":{"statements":7,"bodyBytes":2267,"medianMs":5,"maxMs":6},"staff":{"statements":12,"bodyBytes":6233,"medianMs":12,"maxMs":15},"admin":{"statements":12,"bodyBytes":6238,"medianMs":10,"maxMs":11},"myActionsList":{"statements":5,"bodyBytes":14768,"medianMs":6,"maxMs":6}}}
```

Timings are from one local machine and are a smoke check, not a production benchmark.

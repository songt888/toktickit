# PERF-01 Dashboard performance smoke

Command: `cd server && npx vitest run tests/lab-04/dashboard-performance.test.ts` (run 2026-10-31).

## Conditions

- Separate database `toktickit_perf` (created, migrated with `prisma migrate deploy`, dropped after the run); shared test data is never touched.
- 10,000 Tickets spread over every status and IT priority, a fifth owned by the measured Requester, owners split between two Staff users and unassigned, updates over the last 60 days.
- 30,000 Actions (three per Ticket, every Action status), each with its initial revision. `ANALYZE` before measuring.
- Requests go through the real Express app (Supertest) with a session cookie. One untimed warm-up, then five sequential timed requests per endpoint.
- Statements = data `SELECT`s logged by Prisma for one request (transaction control excluded).
- Machine: Apple M5, 16 GB RAM, macOS; Node v24.19.0; PostgreSQL 16.15 in Docker.

## Budget and result

| Endpoint | SELECT statements (max 12) | Body bytes (max 32,768) | Median ms (max 1,000) | Max ms (max 2,000) |
| --- | --- | --- | --- | --- |
| `GET /api/dashboard/requester` | 7 | 2,267 | 5 | 7 |
| `GET /api/dashboard/staff` (IT Staff) | 12 | 6,233 | 13 | 14 |
| `GET /api/dashboard/staff` (Administrator) | 12 | 6,238 | 13 | 16 |
| `GET /api/staff/actions-taken?pageSize=50` | 5 | 14,768 | 6 | 7 |

Statement counts do not grow with data size: every metric is a count or grouped count, and each list is a single bounded query (no per-row lookups).
The Staff Dashboard first used 13 statements; the unassigned and my-Tickets counts were merged into one grouped query to meet the budget.

Raw log line:

```json
{"perf":"PERF-01","node":"v24.19.0","postgres":"PostgreSQL 16.15","tickets":10000,"actions":30000,"budget":{"statements":12,"bodyBytes":32768,"medianMs":1000,"maxMs":2000},"results":{"requester":{"statements":7,"bodyBytes":2267,"medianMs":5,"maxMs":7},"staff":{"statements":12,"bodyBytes":6233,"medianMs":13,"maxMs":14},"admin":{"statements":12,"bodyBytes":6238,"medianMs":13,"maxMs":16},"myActionsList":{"statements":5,"bodyBytes":14768,"medianMs":6,"maxMs":7}}}
```

Timings are from one local machine and are a smoke check, not a production benchmark.

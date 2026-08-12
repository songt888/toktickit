# Lab 1 — Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | PASS |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | PASS |
| 3 | Vitest | Heading renders | PASS |
| 4 | Vitest | Success state shows Online + category list from the API | PASS |
| 5 | Vitest | Error state shows Offline + message | PASS |

Final automated verification:

```text
Client: 4 tests passed; production build passed.
Server: 4 tests passed; TypeScript build passed.
Prisma validation passed; migration status was up to date.
Manual API check: GET /api/health and GET /api/categories returned HTTP 200.
```

Evidence screenshots should show the passing test commands and the browser
Network panel with `/api/health` and `/api/categories` returning HTTP 200.

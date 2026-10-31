// PERF-01 performance smoke (specification AC-22, tests.md section 2).
// Runs against its own database, so 10,000 Tickets never touch the shared test data.
import { execSync } from "node:child_process";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const baseUrl = new URL(process.env.DATABASE_URL!);
const perfDatabase = "toktickit_perf";
const perfUrl = new URL(baseUrl);
perfUrl.pathname = `/${perfDatabase}`;

// The app's client, with query events so each request's SQL statements can be counted.
const queries: string[] = [];
const perfClient = new PrismaClient({ datasourceUrl: perfUrl.toString(), log: [{ emit: "event", level: "query" }] });
perfClient.$on("query", (event) => queries.push(event.query));
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => perfClient }));

const TICKETS = 10_000;
const ACTIONS = 30_000;
const BUDGET = { statements: 12, bodyBytes: 32 * 1024, medianMs: 1000, maxMs: 2000 };
const admin = new PrismaClient({ datasourceUrl: baseUrl.toString() });
let send: typeof import("./actionFixtures.js")["send"];
const cookies: Record<string, string> = {};

async function dropPerfDatabase() {
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${perfDatabase}" WITH (FORCE)`);
}

beforeAll(async () => {
  await dropPerfDatabase();
  await admin.$executeRawUnsafe(`CREATE DATABASE "${perfDatabase}"`);
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: perfUrl.toString() }, stdio: "ignore" });

  const { seedLab2Data } = await import("../../prisma/seed.js");
  await seedLab2Data(perfClient);
  ({ send } = await import("./actionFixtures.js"));
  const { createTestUser, sessionCookieFor } = await import("../lab-03/testSession.js");
  const users: Record<string, number> = {};
  for (const [role, name] of [["REQUESTER", "requester"], ["IT_STAFF", "staff"], ["IT_STAFF", "otherStaff"], ["ADMINISTRATOR", "admin"]] as const) {
    users[name] = (await createTestUser(`perf-${name}@example.test`, role)).id;
    cookies[name] = await sessionCookieFor(users[name]);
  }
  const otherRequester = (await createTestUser("perf-other-requester@example.test", "REQUESTER")).id;
  const category = await perfClient.category.findFirstOrThrow({ orderBy: { id: "asc" } });
  const system = await perfClient.relatedSystem.findFirstOrThrow({ orderBy: { id: "asc" } });

  // Realistic spread: every status and priority, a fifth owned by the measured Requester,
  // owners split between two Staff users and unassigned, updates over the last 60 days.
  await perfClient.$executeRaw`
    INSERT INTO "Ticket" ("ticketNumber", "requesterId", "ownerId", "categoryId", "relatedSystemId", "summary", "description",
      "requestedPriority", "itPriority", "currentStatus", "ticketDate", "createdAt", "updatedAt", "lastResolvedAt")
    SELECT 'TKT-PERF-' || n,
      CASE WHEN n % 5 = 0 THEN ${users.requester} ELSE ${otherRequester} END,
      CASE n % 3 WHEN 0 THEN NULL WHEN 1 THEN ${users.staff} ELSE ${users.otherStaff} END,
      ${category.id}, ${system.id}, 'Performance fixture ' || n || ' ' || repeat('s', 200), repeat('d', 500),
      (ARRAY['LOW','MEDIUM','HIGH','URGENT'])[1 + n % 4]::"TicketPriority",
      (ARRAY['LOW','MEDIUM','HIGH','URGENT'])[1 + (n / 4) % 4]::"TicketPriority",
      (ARRAY['NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','RESOLVED','CLOSED','REOPENED','CANCELLED'])[1 + n % 8]::"TicketStatus",
      now() - (n % 60) * interval '1 day', now() - (n % 60) * interval '1 day', now() - (n % 60) * interval '1 day' + (n % 1000) * interval '1 second',
      CASE WHEN n % 8 IN (4, 5) THEN now() - (n % 30) * interval '1 day' END
    FROM generate_series(1, ${TICKETS}) AS n`;

  // Three Actions per Ticket, each with the initial revision the database requires (snapshot = the saved row).
  await perfClient.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
    await tx.$executeRaw`
      INSERT INTO "ActionTaken" ("ticketId", "performedById", "assigneeId", "actionAt", "description", "status", "result", "cancellationReason", "createdAt", "updatedAt")
      SELECT t.id, ${users.staff},
        CASE k WHEN 0 THEN ${users.staff} WHEN 1 THEN ${users.otherStaff} ELSE ${users.admin} END,
        t."ticketDate", 'Performance Action ' || k || ' ' || repeat('a', 300),
        (ARRAY['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'])[1 + (t.id + k) % 4]::"ActionStatus",
        CASE WHEN (t.id + k) % 4 = 2 THEN 'Done' ELSE '' END,
        CASE WHEN (t.id + k) % 4 = 3 THEN 'Not needed' END,
        t."ticketDate", t."updatedAt"
      FROM "Ticket" t CROSS JOIN generate_series(0, 2) AS k`;
    await tx.$executeRaw`
      INSERT INTO "ActionTakenRevision" ("actionId", "version", "actorId", "operation", "mutationId", "requestHash", "snapshot", "ticketUpdatedAt")
      SELECT a.id, 1, a."performedById", 'CREATE', gen_random_uuid(), repeat('0', 64), to_jsonb(a), a."updatedAt" FROM "ActionTaken" a`;
  }, { timeout: 120_000 });
  await perfClient.$executeRaw`ANALYZE`;
}, 180_000);

afterAll(async () => {
  await perfClient.$disconnect();
  await dropPerfDatabase().catch(() => undefined);
  await admin.$disconnect();
});

// One untimed warm-up, then five sequential timed requests; statements counted per request.
async function measure(url: string, cookie: string) {
  await send("get", url, cookie);
  const timings: number[] = [];
  let statements = 0;
  let bodyBytes = 0;
  for (let run = 0; run < 5; run += 1) {
    queries.length = 0;
    const started = performance.now();
    const response = await send("get", url, cookie);
    timings.push(performance.now() - started);
    expect(response.status).toBe(200);
    // Data statements only: transaction control (BEGIN/COMMIT/SET ISOLATION) is not data access.
    statements = Math.max(statements, queries.filter((sql) => /^\s*SELECT/i.test(sql)).length);
    bodyBytes = Math.max(bodyBytes, Buffer.byteLength(JSON.stringify(response.body)));
  }
  timings.sort((a, b) => a - b);
  return { statements, bodyBytes, medianMs: Math.round(timings[2]), maxMs: Math.round(timings[4]) };
}

describe("Dashboard performance smoke (PERF-01)", () => {
  it(`stays within budget with ${TICKETS} Tickets and ${ACTIONS} Actions`, async () => {
    expect(await perfClient.ticket.count()).toBe(TICKETS);
    expect(await perfClient.actionTaken.count()).toBe(ACTIONS);
    const results = {
      requester: await measure("/api/dashboard/requester", cookies.requester),
      staff: await measure("/api/dashboard/staff", cookies.staff),
      admin: await measure("/api/dashboard/staff", cookies.admin),
      myActionsList: await measure("/api/staff/actions-taken?pageSize=50", cookies.staff),
    };
    const [[version]] = [await perfClient.$queryRaw<Array<{ version: string }>>(Prisma.sql`SELECT version()`)];
    console.log(JSON.stringify({ perf: "PERF-01", node: process.version, postgres: version.version.split(" ").slice(0, 2).join(" "), tickets: TICKETS, actions: ACTIONS, budget: BUDGET, results }));
    for (const [name, result] of Object.entries(results)) {
      expect(result.statements, name).toBeLessThanOrEqual(BUDGET.statements);
      expect(result.bodyBytes, name).toBeLessThanOrEqual(BUDGET.bodyBytes);
      expect(result.medianMs, name).toBeLessThanOrEqual(BUDGET.medianMs);
      expect(result.maxMs, name).toBeLessThanOrEqual(BUDGET.maxMs);
    }
  }, 60_000);
});

import type { TicketPriority, TicketStatus } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { actionRow as actionAt, createWorld, send } from "./actionFixtures.js";

const prisma = getPrisma();
const world = await createWorld("staff-dashboard");
const DAY = 86_400_000;
const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const active = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
// A year ahead, so no other test file's Tickets fall inside this file's windows and lists.
const asOf = new Date(Math.floor(Date.now() / 1000) * 1000 + 365 * DAY);
const recentFrom = new Date(asOf.getTime() - 7 * DAY);
let requester: { id: number; cookie: string };
let staff: { id: number; cookie: string };
let otherStaff: { id: number; cookie: string };
let admin: { id: number; cookie: string };

type TicketFixture = { status?: TicketStatus; itPriority?: TicketPriority; ownerId?: number | null; updatedAt?: Date; summary?: string };
// Raw SQL so Prisma's @updatedAt cannot overwrite the timestamp.
async function ticketAt({ status = "NEW", itPriority = "MEDIUM", ownerId = null, updatedAt = new Date(Date.now() - DAY), summary }: TicketFixture = {}) {
  const ticket = await world.ticket(requester.id);
  await prisma.$executeRaw`UPDATE "Ticket" SET "currentStatus" = ${status}::"TicketStatus", "itPriority" = ${itPriority}::"TicketPriority", "ownerId" = ${ownerId},
    "updatedAt" = ${updatedAt}, "summary" = COALESCE(${summary ?? null}, "summary") WHERE id = ${ticket.id}`;
  return ticket;
}

// Independent reference counts written as SQL, not through the route's Prisma filters.
async function reference(userId: number) {
  const [row] = await prisma.$queryRaw<Array<Record<string, bigint>>>`
    SELECT
      COUNT(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') AND "ownerId" IS NULL) AS unassigned,
      COUNT(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') AND "ownerId" = ${userId}) AS mine
    FROM "Ticket"`;
  const byStatus = await prisma.$queryRaw<Array<{ key: string; n: bigint }>>`SELECT "currentStatus"::text AS key, COUNT(*) AS n FROM "Ticket" GROUP BY 1`;
  const byPriority = await prisma.$queryRaw<Array<{ key: string; n: bigint }>>`
    SELECT "itPriority"::text AS key, COUNT(*) AS n FROM "Ticket" WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') GROUP BY 1`;
  const [actions] = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*) AS n FROM "ActionTaken" a JOIN "Ticket" t ON t.id = a."ticketId"
    WHERE a."assigneeId" = ${userId} AND a.status IN ('PLANNED','IN_PROGRESS') AND t."currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')`;
  const bucket = (keys: string[], rows: Array<{ key: string; n: bigint }>) =>
    Object.fromEntries(keys.map((key) => [key, Number(rows.find((r) => r.key === key)?.n ?? 0)]));
  return {
    unassignedTickets: Number(row.unassigned),
    myTickets: Number(row.mine),
    myActions: Number(actions.n),
    byStatus: bucket(statuses, byStatus),
    byItPriority: bucket(["LOW", "MEDIUM", "HIGH", "URGENT"], byPriority),
  };
}

// Other test files write Tickets in parallel; accept only a reading taken while nothing changed.
// A wrong formula never matches, so it still fails after every attempt.
async function stableMetrics(user: { id: number; cookie: string }) {
  let last: { response: Awaited<ReturnType<typeof send>>; expected: Awaited<ReturnType<typeof reference>> } | undefined;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 250));
    const before = await reference(user.id);
    const response = await send("get", "/api/dashboard/staff", user.cookie);
    const after = await reference(user.id);
    last = { response, expected: before };
    if (JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(response.body.metrics) === JSON.stringify(before)) break;
  }
  return last!;
}

async function dashboardAt(cookie: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(asOf);
  const response = await send("get", "/api/dashboard/staff", cookie);
  vi.useRealTimers();
  return response;
}

beforeAll(async () => {
  [requester, staff, otherStaff, admin] = await Promise.all([
    world.user("requester", "REQUESTER"), world.user("staff", "IT_STAFF"), world.user("other", "IT_STAFF"), world.user("admin", "ADMINISTRATOR"),
  ]);
  // The list tests read the Dashboard a year ahead; keep this file's sessions valid then.
  await prisma.authSession.updateMany({ where: { userId: staff.id }, data: { expiresAt: new Date(asOf.getTime() + DAY) } });
});
afterEach(() => vi.useRealTimers());
afterAll(() => world.cleanup());

describe("Staff and Administrator Dashboard API (API-12)", () => {
  it("returns every metric and bucket for a user with no work, including zeros", async () => {
    const fresh = await world.user("fresh", "IT_STAFF");
    const response = await send("get", "/api/dashboard/staff", fresh.cookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ displayTimeZone: "Asia/Bangkok", metrics: { myTickets: 0, myActions: 0 }, myActions: [] });
    expect(Object.keys(response.body.metrics.byStatus)).toEqual(statuses);
    expect(Object.keys(response.body.metrics.byItPriority)).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);
    expect(new Date(response.body.asOf).getTime() - new Date(response.body.recentFrom).getTime()).toBe(7 * DAY);
  });

  it("counts match independent SQL: active-only owner and priority scope, all-status breakdown, assignee-not-performer Actions", async () => {
    // One Ticket per status for this Staff user, unassigned, and another owner; inactive ones are URGENT so priority scope matters.
    const own: Record<string, number> = {};
    for (const status of statuses) {
      const itPriority = active.includes(status) ? "LOW" : "URGENT";
      own[status] = (await ticketAt({ status, itPriority, ownerId: staff.id })).id;
      await ticketAt({ status, itPriority });
      await ticketAt({ status, itPriority, ownerId: otherStaff.id });
    }
    await actionAt(own.NEW, staff.id, staff.id); // counts
    await actionAt(own.OPEN, staff.id, otherStaff.id, "IN_PROGRESS"); // counts: assigned to staff, performed by someone else
    await actionAt(own.OPEN, otherStaff.id, staff.id); // performed by staff, assigned elsewhere: not counted
    await actionAt(own.NEW, staff.id, staff.id, "COMPLETED"); // settled
    await actionAt(own.NEW, staff.id, staff.id, "CANCELLED"); // settled
    await actionAt(own.RESOLVED, staff.id, staff.id); // parent not active
    await actionAt(own.CANCELLED, staff.id, staff.id, "IN_PROGRESS"); // parent not active

    const { response, expected } = await stableMetrics(staff);
    expect(response.status).toBe(200);
    expect(response.body.metrics).toEqual(expected);
    expect([response.body.metrics.myTickets, response.body.metrics.myActions]).toEqual([5, 2]);

    // Administrator reuses the same formulas with their own assignments only.
    const adminView = await stableMetrics(admin);
    expect(adminView.response.body.metrics).toEqual(adminView.expected);
    expect([adminView.response.body.metrics.myTickets, adminView.response.body.metrics.myActions]).toEqual([0, 0]);
  }, 30_000);

  it("lists recent Tickets inside the inclusive window by updatedAt then id, with the summary shape only", async () => {
    const tie = new Date(asOf.getTime() - DAY);
    const ids = {
      lowerBound: (await ticketAt({ updatedAt: recentFrom })).id,
      outside: (await ticketAt({ updatedAt: new Date(recentFrom.getTime() - 1) })).id,
      future: (await ticketAt({ updatedAt: new Date(asOf.getTime() + 1) })).id,
      upperBound: (await ticketAt({ status: "CLOSED", updatedAt: asOf, ownerId: staff.id, summary: "x".repeat(300) })).id,
      tieA: (await ticketAt({ updatedAt: tie })).id,
      tieB: (await ticketAt({ updatedAt: tie })).id,
    };
    const items = (await dashboardAt(staff.cookie)).body.recentTickets as Array<Record<string, unknown>>;
    expect(items.map((item) => item.id)).toEqual([ids.upperBound, ids.tieB, ids.tieA, ids.lowerBound]);
    expect(Object.keys(items[0]).sort()).toEqual(["currentStatus", "id", "itPriority", "lastResolvedAt", "owner", "summary", "ticketNumber", "updatedAt"]);
    expect((items[0].summary as string).length).toBe(240);
    expect(items[0].owner).toEqual({ id: staff.id, name: expect.any(String) });
  });

  it("lists at most five active URGENT Tickets, newest first with an id tie-break", async () => {
    const at = (hours: number) => new Date(asOf.getTime() + 30 * DAY - hours * 3_600_000);
    await ticketAt({ status: "CANCELLED", itPriority: "URGENT", updatedAt: at(0) }); // inactive, newest
    await ticketAt({ status: "OPEN", itPriority: "HIGH", updatedAt: at(0) }); // not urgent
    const ids: number[] = [];
    for (const hours of [1, 2, 2, 3, 4, 5]) ids.push((await ticketAt({ status: "OPEN", itPriority: "URGENT", updatedAt: at(hours) })).id);
    const items = (await dashboardAt(staff.cookie)).body.urgentTickets as Array<{ id: number }>;
    expect(items.map((item) => item.id)).toEqual([ids[0], ids[2], ids[1], ids[3], ids[4]]);
  });

  it("lists at most five of the user's pending Actions by updatedAt then id, while the count covers all of them", async () => {
    const worker = await world.user("worker", "IT_STAFF");
    const ticket = await ticketAt({ status: "IN_PROGRESS" });
    const base = Date.now();
    const at = (hours: number) => new Date(base - hours * 3_600_000);
    const ids: number[] = [];
    for (const hours of [1, 2, 2, 3, 4, 5]) ids.push(await actionAt(ticket.id, worker.id, staff.id, "PLANNED", at(hours), "y".repeat(300)));
    await actionAt(ticket.id, worker.id, worker.id, "COMPLETED", at(0));

    const response = await send("get", "/api/dashboard/staff", worker.cookie);
    expect(response.body.metrics.myActions).toBe(6);
    const items = response.body.myActions as Array<Record<string, unknown>>;
    expect(items.map((item) => item.id)).toEqual([ids[0], ids[2], ids[1], ids[3], ids[4]]);
    expect(items[0]).toEqual({ id: ids[0], ticketId: ticket.id, ticketNumber: ticket.ticketNumber, description: "y".repeat(160), status: "PLANNED", updatedAt: at(1).toISOString() });
  });

  it("is for Staff and Administrators only, needs a session and takes no query parameters", async () => {
    expect((await send("get", "/api/dashboard/staff", requester.cookie)).status).toBe(403);
    expect((await send("get", "/api/dashboard/staff", "")).status).toBe(401);
    expect((await send("get", `/api/dashboard/staff?userId=${otherStaff.id}`, staff.cookie)).status).toBe(400);
    expect((await send("get", "/api/dashboard/staff", admin.cookie)).status).toBe(200);
  });
});

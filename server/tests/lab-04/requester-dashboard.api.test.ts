import type { TicketStatus } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { createWorld, send } from "./actionFixtures.js";

const prisma = getPrisma();
const world = await createWorld("req-dashboard");
const DAY = 86_400_000;
let owner: { id: number; cookie: string };
let other: { id: number; cookie: string };
let empty: { id: number; cookie: string };
let staff: { id: number; cookie: string };

// Fixture Ticket with exact timestamps; raw SQL so Prisma's @updatedAt cannot overwrite them.
async function ticketAt(requesterId: number, status: TicketStatus, updatedAt: Date, lastResolvedAt: Date | null = null, summary?: string) {
  const ticket = await world.ticket(requesterId);
  await prisma.$executeRaw`UPDATE "Ticket" SET "currentStatus" = ${status}::"TicketStatus", "updatedAt" = ${updatedAt}, "lastResolvedAt" = ${lastResolvedAt}, "summary" = COALESCE(${summary ?? null}, "summary") WHERE id = ${ticket.id}`;
  return ticket.id;
}

// Independent reference counts written as SQL, not through the route's Prisma filters.
async function referenceCounts(requesterId: number, from: Date, to: Date) {
  const [row] = await prisma.$queryRaw<Array<{ open: bigint; waiting: bigint; resolved: bigint }>>`
    SELECT
      COUNT(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')) AS open,
      COUNT(*) FILTER (WHERE "currentStatus" = 'WAITING_FOR_REQUESTER') AS waiting,
      COUNT(*) FILTER (WHERE "currentStatus" IN ('RESOLVED','CLOSED') AND "lastResolvedAt" BETWEEN ${from} AND ${to}) AS resolved
    FROM "Ticket" WHERE "requesterId" = ${requesterId}`;
  return { openTickets: Number(row.open), waitingForRequester: Number(row.waiting), recentlyResolved: Number(row.resolved) };
}

beforeAll(async () => {
  [owner, other, empty, staff] = await Promise.all([
    world.user("owner", "REQUESTER"), world.user("other", "REQUESTER"), world.user("empty", "REQUESTER"), world.user("staff", "IT_STAFF"),
  ]);
});
afterEach(() => vi.useRealTimers());
afterAll(() => world.cleanup());

describe("Requester Dashboard API (API-11)", () => {
  it("returns a zero snapshot with every metric present", async () => {
    const response = await send("get", "/api/dashboard/requester", empty.cookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      displayTimeZone: "Asia/Bangkok",
      metrics: { openTickets: 0, waitingForRequester: 0, recentlyResolved: 0 },
      recentTickets: [],
    });
    expect(new Date(response.body.asOf).getTime() - new Date(response.body.recentFrom).getTime()).toBe(7 * DAY);
  });

  it("counts only the session Requester's Tickets, with inclusive 7-day bounds, no future dates and no unknown legacy resolution", async () => {
    const asOf = new Date(Math.floor(Date.now() / 1000) * 1000);
    const recentFrom = new Date(asOf.getTime() - 7 * DAY);
    const before = new Date(recentFrom.getTime() - 1);
    const future = new Date(asOf.getTime() + 1);

    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "CANCELLED"] as const) {
      await ticketAt(owner.id, status, before);
      await ticketAt(other.id, status, asOf);
    }
    await ticketAt(owner.id, "WAITING_FOR_REQUESTER", before);
    await ticketAt(owner.id, "RESOLVED", before, recentFrom); // lower bound, inclusive
    await ticketAt(owner.id, "CLOSED", before, asOf); // upper bound, inclusive
    await ticketAt(owner.id, "RESOLVED", before, before); // just outside
    await ticketAt(owner.id, "CLOSED", before, future); // future, excluded
    await ticketAt(owner.id, "RESOLVED", before, null); // legacy, unknown date
    await ticketAt(owner.id, "REOPENED", before, asOf); // resolved earlier, but not RESOLVED/CLOSED now
    await ticketAt(other.id, "RESOLVED", asOf, asOf);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(asOf);
    const response = await send("get", "/api/dashboard/requester", owner.cookie);
    vi.useRealTimers();

    expect(response.status).toBe(200);
    expect([response.body.asOf, response.body.recentFrom]).toEqual([asOf.toISOString(), recentFrom.toISOString()]);
    expect(response.body.metrics).toEqual({ openTickets: 7, waitingForRequester: 2, recentlyResolved: 2 });
    expect(response.body.metrics).toEqual(await referenceCounts(owner.id, recentFrom, asOf));
  });

  it("lists at most five recent own Tickets by updatedAt then id, inside the window, with the summary shape only", async () => {
    const asOf = new Date(Math.floor(Date.now() / 1000) * 1000);
    const recentFrom = new Date(asOf.getTime() - 7 * DAY);
    const requester = await world.user("recent", "REQUESTER");
    const tie = new Date(asOf.getTime() - DAY);
    const ids = {
      lowerBound: await ticketAt(requester.id, "NEW", recentFrom),
      outside: await ticketAt(requester.id, "NEW", new Date(recentFrom.getTime() - 1)),
      future: await ticketAt(requester.id, "NEW", new Date(asOf.getTime() + 1)),
      upperBound: await ticketAt(requester.id, "OPEN", asOf, null, "x".repeat(300)),
      tieA: await ticketAt(requester.id, "IN_PROGRESS", tie),
      tieB: await ticketAt(requester.id, "IN_PROGRESS", tie),
      older: await ticketAt(requester.id, "CLOSED", new Date(asOf.getTime() - 2 * DAY), asOf),
      oldest: await ticketAt(requester.id, "NEW", new Date(asOf.getTime() - 3 * DAY)),
    };
    await ticketAt(other.id, "NEW", asOf);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(asOf);
    const response = await send("get", "/api/dashboard/requester", requester.cookie);
    vi.useRealTimers();

    const items = response.body.recentTickets as Array<Record<string, unknown>>;
    expect(items.map((item) => item.id)).toEqual([ids.upperBound, ids.tieB, ids.tieA, ids.older, ids.oldest]);
    expect(Object.keys(items[0]).sort()).toEqual(["currentStatus", "id", "itPriority", "lastResolvedAt", "owner", "summary", "ticketNumber", "updatedAt"]);
    expect((items[0].summary as string).length).toBe(240);
    expect(items[0].owner).toBeNull();
  });

  it("is for Requesters only, needs a session and takes no query parameters", async () => {
    expect((await send("get", "/api/dashboard/requester", staff.cookie)).status).toBe(403);
    expect((await send("get", "/api/dashboard/requester", "")).status).toBe(401);
    const override = await send("get", `/api/dashboard/requester?requesterId=${other.id}`, owner.cookie);
    expect(override.status).toBe(400);
  });
});

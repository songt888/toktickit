import type { TicketStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { randomUUID } from "node:crypto";
import { actionRow, createWorld, send } from "./actionFixtures.js";

const prisma = getPrisma();
const world = await createWorld("drilldown");
const DAY = 86_400_000;
const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
let owner: { id: number; cookie: string };
let other: { id: number; cookie: string };
const ownIds = new Map<string, number>();

async function ticketAt(requesterId: number, status: TicketStatus, updatedAt: Date, lastResolvedAt: Date | null = null) {
  const ticket = await world.ticket(requesterId);
  await prisma.$executeRaw`UPDATE "Ticket" SET "currentStatus" = ${status}::"TicketStatus", "updatedAt" = ${updatedAt}, "lastResolvedAt" = ${lastResolvedAt} WHERE id = ${ticket.id}`;
  return ticket.id;
}

const list = async (query: Record<string, string>, cookie = owner.cookie) =>
  send("get", `/api/tickets?${new URLSearchParams({ pageSize: "50", ...query })}`, cookie);
const ids = (response: { body: { items: Array<{ id: number }> } }) => response.body.items.map((item) => item.id).sort((a, b) => a - b);

beforeAll(async () => {
  [owner, other] = await Promise.all([world.user("owner", "REQUESTER"), world.user("other", "REQUESTER")]);
  const now = Date.now();
  for (const status of statuses) {
    ownIds.set(status, await ticketAt(owner.id, status, new Date(now - DAY), status === "RESOLVED" || status === "CLOSED" ? new Date(now - DAY) : null));
    await ticketAt(other.id, status, new Date(now - DAY), new Date(now - DAY));
  }
  ownIds.set("oldResolved", await ticketAt(owner.id, "RESOLVED", new Date(now - 20 * DAY), new Date(now - 20 * DAY)));
  ownIds.set("legacyClosed", await ticketAt(owner.id, "CLOSED", new Date(now - 20 * DAY), null));
});
afterAll(() => world.cleanup());

describe("Requester list drill-down filters (API-13, Requester part)", () => {
  it("filters each of the eight statuses exactly and never shows another Requester's Tickets", async () => {
    for (const status of statuses) {
      const response = await list({ currentStatus: status, requesterId: String(other.id) });
      expect(response.status, status).toBe(200);
      const expected = [ownIds.get(status)!, ...(status === "RESOLVED" ? [ownIds.get("oldResolved")!] : []), ...(status === "CLOSED" ? [ownIds.get("legacyClosed")!] : [])];
      expect(ids(response), status).toEqual(expected.sort((a, b) => a - b));
    }
  });

  it("supports active and resolved groups and rejects bad or conflicting filters", async () => {
    const active = await list({ statusGroup: "active" });
    expect(ids(active)).toEqual(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].map((s) => ownIds.get(s)!).sort((a, b) => a - b));
    const resolved = await list({ statusGroup: "resolved" });
    expect(ids(resolved)).toEqual([ownIds.get("RESOLVED")!, ownIds.get("CLOSED")!, ownIds.get("oldResolved")!, ownIds.get("legacyClosed")!].sort((a, b) => a - b));

    const invalid: Array<Record<string, string>> = [
      { statusGroup: "active", currentStatus: "NEW" },
      { statusGroup: "done" },
      { currentStatus: "FIXED" },
      { updatedFrom: "2026-10-01" },
      { updatedFrom: "not-a-date" },
      { resolvedTo: "2026-10-01T00:00:00" },
      { updatedFrom: "2026-10-02T00:00:00.000Z", updatedTo: "2026-10-01T00:00:00.000Z" },
      { resolvedFrom: "2026-10-02T00:00:00.000Z", resolvedTo: "2026-10-01T00:00:00.000Z" },
    ];
    for (const query of invalid) {
      expect((await list(query)).status, JSON.stringify(query)).toBe(400);
    }
  });

  it("applies inclusive date bounds and skips unknown resolution dates", async () => {
    const at = new Date(Date.now() - 5 * DAY);
    const exact = await ticketAt(owner.id, "CLOSED", at, at);
    const iso = at.toISOString();
    expect(ids(await list({ updatedFrom: iso, updatedTo: iso }))).toEqual([exact]);
    expect(ids(await list({ resolvedFrom: iso, resolvedTo: iso }))).toEqual([exact]);
    const anyResolved = ids(await list({ resolvedFrom: "2000-01-01T00:00:00.000Z" }));
    expect(anyResolved).not.toContain(ownIds.get("legacyClosed"));
    expect(anyResolved).toContain(ownIds.get("oldResolved"));
  });

  it("each Dashboard metric equals the total of its drill-down list using the returned asOf and recentFrom", async () => {
    const dashboard = (await send("get", "/api/dashboard/requester", owner.cookie)).body;
    const { asOf, recentFrom } = dashboard;
    const total = async (query: Record<string, string>) => (await list(query)).body.pagination.totalItems;
    expect(await total({ statusGroup: "active" })).toBe(dashboard.metrics.openTickets);
    expect(await total({ currentStatus: "WAITING_FOR_REQUESTER" })).toBe(dashboard.metrics.waitingForRequester);
    expect(await total({ statusGroup: "resolved", resolvedFrom: recentFrom, resolvedTo: asOf })).toBe(dashboard.metrics.recentlyResolved);
    const viewAll = await list({ updatedFrom: recentFrom, updatedTo: asOf, pageSize: "10" });
    expect(viewAll.body.items.slice(0, 5).map((item: { id: number }) => item.id)).toEqual(dashboard.recentTickets.map((item: { id: number }) => item.id));
  });
});

describe("Staff Queue drill-down filters and My Pending Actions list (API-13, Staff part)", () => {
  const token = `staffdrill${randomUUID().slice(0, 8)}`;
  let staff: { id: number; cookie: string };
  let other: { id: number; cookie: string };
  const queueIds = new Map<string, number>();

  // Tagged with this run's token so the global Queue can be narrowed to this file's Tickets.
  async function staffTicket(key: string, status: TicketStatus, itPriority: string, ownerId: number | null, updatedAt: Date) {
    const ticket = await world.ticket(owner.id);
    await prisma.$executeRaw`UPDATE "Ticket" SET "currentStatus" = ${status}::"TicketStatus", "itPriority" = ${itPriority}::"TicketPriority",
      "ownerId" = ${ownerId}, "updatedAt" = ${updatedAt}, "summary" = ${`${token} ${key}`} WHERE id = ${ticket.id}`;
    queueIds.set(key, ticket.id);
    return ticket;
  }
  const queue = async (query: Record<string, string>, cookie = staff.cookie) =>
    send("get", `/api/staff/tickets?${new URLSearchParams({ search: token, pageSize: "50", ...query })}`, cookie);
  const mine = (query: Record<string, string> = {}, cookie = staff.cookie) =>
    send("get", `/api/staff/actions-taken?${new URLSearchParams(query)}`, cookie);
  const keys = (response: { body: { items: Array<{ id: number }> } }) =>
    response.body.items.map((item) => [...queueIds].find(([, id]) => id === item.id)?.[0]).sort();

  beforeAll(async () => {
    [staff, other] = await Promise.all([world.user("drill-staff", "IT_STAFF"), world.user("drill-other", "IT_STAFF")]);
    const now = Date.now();
    await staffTicket("activeUnassigned", "OPEN", "URGENT", null, new Date(now - DAY));
    await staffTicket("activeMine", "IN_PROGRESS", "LOW", staff.id, new Date(now - 2 * DAY));
    await staffTicket("activeOther", "REOPENED", "URGENT", other.id, new Date(now - 3 * DAY));
    await staffTicket("closedUnassigned", "CLOSED", "URGENT", null, new Date(now - DAY));
    await staffTicket("cancelledMine", "CANCELLED", "LOW", staff.id, new Date(now - 20 * DAY));
  });

  it("filters the Queue by active group, owner, status, IT priority and inclusive updated bounds", async () => {
    expect(keys(await queue({ statusGroup: "active", ownerId: "unassigned" }))).toEqual(["activeUnassigned"]);
    expect(keys(await queue({ statusGroup: "active", ownerId: String(staff.id) }))).toEqual(["activeMine"]);
    expect(keys(await queue({ statusGroup: "active", itPriority: "URGENT" }))).toEqual(["activeOther", "activeUnassigned"]);
    expect(keys(await queue({ currentStatus: "CLOSED" }))).toEqual(["closedUnassigned"]);
    expect(keys(await queue({ statusGroup: "resolved" }))).toEqual(["closedUnassigned"]);
    const at = (await prisma.ticket.findUniqueOrThrow({ where: { id: queueIds.get("activeMine")! } })).updatedAt.toISOString();
    expect(keys(await queue({ updatedFrom: at, updatedTo: at }))).toEqual(["activeMine"]);
    const invalidQueue: Array<Record<string, string>> = [{ statusGroup: "active", currentStatus: "NEW" }, { statusGroup: "all" }, { updatedFrom: "2026-10-01" }, { updatedFrom: at, updatedTo: "2000-01-01T00:00:00.000Z" }];
    for (const query of invalidQueue) {
      expect((await queue(query)).status, JSON.stringify(query)).toBe(400);
    }
  });

  it("lists only the session user's pending Actions on active Tickets, paged and ordered by updatedAt then id", async () => {
    const worker = await world.user("drill-worker", "IT_STAFF");
    const ticket = await staffTicket("workTicket", "OPEN", "HIGH", worker.id, new Date(Date.now() - DAY));
    const closed = await staffTicket("workClosed", "CLOSED", "HIGH", worker.id, new Date(Date.now() - DAY));
    const base = Date.now();
    const ids: number[] = [];
    for (let index = 0; index < 12; index += 1) ids.push(await actionRow(ticket.id, worker.id, staff.id, index % 2 ? "IN_PROGRESS" : "PLANNED", new Date(base - index * 60_000)));
    await actionRow(ticket.id, staff.id, worker.id); // performed by the worker, assigned elsewhere
    await actionRow(ticket.id, worker.id, worker.id, "COMPLETED");
    await actionRow(closed.id, worker.id, worker.id);

    const first = await mine({ assigneeId: "me", statusGroup: "pending", ticketStatusGroup: "active" }, worker.cookie);
    expect(first.status).toBe(200);
    expect(first.body.pagination).toEqual({ page: 1, pageSize: 10, totalItems: 12, totalPages: 2 });
    expect(first.body.items.map((item: { id: number }) => item.id)).toEqual(ids.slice(0, 10));
    expect(Object.keys(first.body.items[0]).sort()).toEqual(["description", "id", "status", "ticketId", "ticketNumber", "updatedAt"]);
    const second = await mine({ page: "2" }, worker.cookie);
    expect(second.body.items.map((item: { id: number }) => item.id)).toEqual(ids.slice(10));

    const dashboard = (await send("get", "/api/dashboard/staff", worker.cookie)).body;
    expect(dashboard.metrics.myActions).toBe(first.body.pagination.totalItems);
    expect(dashboard.myActions.map((item: { id: number }) => item.id)).toEqual(ids.slice(0, 5));
  });

  it("rejects any other user, scope, page size or parameter and is for Staff and Administrators only", async () => {
    const invalidMine: Array<Record<string, string>> = [{ assigneeId: String(staff.id) }, { statusGroup: "all" }, { ticketStatusGroup: "any" }, { pageSize: "7" }, { page: "0" }, { userId: "1" }];
    for (const query of invalidMine) {
      expect((await mine(query)).status, JSON.stringify(query)).toBe(400);
    }
    expect((await mine({}, owner.cookie)).status).toBe(403);
    expect((await mine({}, "")).status).toBe(401);
  });

  it("each Staff metric equals the total of its Queue drill-down using the returned asOf and recentFrom", async () => {
    // The Queue is global and other files write Tickets in parallel; accept a reading taken while nothing changed.
    const total = async (query: Record<string, string>) =>
      (await send("get", `/api/staff/tickets?${new URLSearchParams({ pageSize: "10", ...query })}`, staff.cookie)).body.pagination.totalItems;
    let mismatch = "";
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 250));
      const dashboard = (await send("get", "/api/dashboard/staff", staff.cookie)).body;
      const { metrics, recentFrom, asOf } = dashboard;
      const pairs: Array<[string, number, number]> = [
        ["unassigned", metrics.unassignedTickets, await total({ statusGroup: "active", ownerId: "unassigned" })],
        ["mine", metrics.myTickets, await total({ statusGroup: "active", ownerId: String(staff.id) })],
        ...statuses.map((status): [string, number, number] => [status, metrics.byStatus[status], 0]),
        ...["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority): [string, number, number] => [priority, metrics.byItPriority[priority], 0]),
      ];
      for (const pair of pairs) {
        if (statuses.includes(pair[0] as TicketStatus)) pair[2] = await total({ currentStatus: pair[0] });
        else if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(pair[0])) pair[2] = await total({ statusGroup: "active", itPriority: pair[0] });
      }
      const viewAll = await send("get", `/api/staff/tickets?${new URLSearchParams({ updatedFrom: recentFrom, updatedTo: asOf, pageSize: "10" })}`, staff.cookie);
      const urgent = await send("get", `/api/staff/tickets?${new URLSearchParams({ statusGroup: "active", itPriority: "URGENT", pageSize: "10" })}`, staff.cookie);
      const again = (await send("get", "/api/dashboard/staff", staff.cookie)).body;
      mismatch = pairs.filter(([, metric, list]) => metric !== list).map(([key]) => key).join(",");
      const lists = JSON.stringify(viewAll.body.items.slice(0, 5).map((item: { id: number }) => item.id)) === JSON.stringify(dashboard.recentTickets.map((item: { id: number }) => item.id))
        && JSON.stringify(urgent.body.items.slice(0, 5).map((item: { id: number }) => item.id)) === JSON.stringify(dashboard.urgentTickets.map((item: { id: number }) => item.id));
      if (!lists) mismatch += ",lists";
      if (JSON.stringify(again.metrics) === JSON.stringify(metrics) && !mismatch) break;
    }
    expect(mismatch).toBe("");
  }, 30_000);
});

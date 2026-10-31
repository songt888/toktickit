import type { TicketStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { createWorld, send } from "./actionFixtures.js";

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

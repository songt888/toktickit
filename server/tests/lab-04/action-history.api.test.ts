import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { createAction, createWorld, iso, send, ticketStamp } from "./actionFixtures.js";

const prisma = getPrisma();
const world = await createWorld("history");
let staff: { id: number; cookie: string };
let requester: { id: number; cookie: string };

beforeAll(async () => {
  [staff, requester] = await Promise.all([world.user("staff", "IT_STAFF"), world.user("requester", "REQUESTER")]);
});
afterAll(() => world.cleanup());

describe("Action and status history ordering (API-06)", () => {
  it("orders equal Action dates by id and pages them deterministically", async () => {
    const ticket = await world.ticket(requester.id);
    const sameAt = iso(new Date(Date.now() - 600_000));
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) ids.push((await createAction(ticket.id, staff.cookie, { actionAt: sameAt, description: `Step ${i}` })).action.id);
    const earlier = (await createAction(ticket.id, staff.cookie, { actionAt: iso(new Date(Date.now() - 900_000)) })).action.id;

    const page1 = await send("get", `/api/tickets/${ticket.id}/actions-taken?pageSize=10`, staff.cookie);
    const page2 = await send("get", `/api/tickets/${ticket.id}/actions-taken?page=2&pageSize=10`, staff.cookie);
    expect(page1.body.pagination).toEqual({ page: 1, pageSize: 10, totalItems: 13, totalPages: 2 });
    expect([...page1.body.items, ...page2.body.items].map((a: { id: number }) => a.id)).toEqual([earlier, ...ids]);
    expect(page1.body.ticketUpdatedAt).toBe(await ticketStamp(ticket.id));
    for (const pageSize of [25, 50]) {
      const all = await send("get", `/api/tickets/${ticket.id}/actions-taken?pageSize=${pageSize}`, staff.cookie);
      expect(all.body.pagination).toEqual({ page: 1, pageSize, totalItems: 13, totalPages: 1 });
      expect(all.body.items.map((a: { id: number }) => a.id)).toEqual([earlier, ...ids]);
    }
    const beyond = await send("get", `/api/tickets/${ticket.id}/actions-taken?page=5`, staff.cookie);
    expect(beyond.body.items).toEqual([]);

    for (const query of ["page=0", "pageSize=20", "page=abc", "sort=id"]) {
      expect((await send("get", `/api/tickets/${ticket.id}/actions-taken?${query}`, staff.cookie)).status, query).toBe(400);
    }
    const empty = await world.ticket(requester.id);
    expect((await send("get", `/api/tickets/${empty.id}/actions-taken`, staff.cookie)).body).toMatchObject({
      items: [], pagination: { totalItems: 0, totalPages: 0 },
    });
  });

  it("lists revisions by version with the historical actor name and no internal keys", async () => {
    const ticket = await world.ticket(requester.id);
    const { action } = await createAction(ticket.id, staff.cookie);
    for (const description of ["First edit", "Second edit", ...Array.from({ length: 10 }, (_, i) => `Edit ${i}`)]) {
      const row = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
      await send("patch", `/api/tickets/${ticket.id}/actions-taken/${action.id}`, staff.cookie, {
        mutationId: randomUUID(), ticketUpdatedAt: await ticketStamp(ticket.id), version: row.version, description,
      });
    }
    const response = await send("get", `/api/tickets/${ticket.id}/actions-taken/${action.id}/revisions`, requester.cookie);
    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 1, pageSize: 10, totalItems: 13, totalPages: 2 });
    expect(response.body.items.slice(0, 3).map((r: { version: number; operation: string }) => [r.version, r.operation])).toEqual([[1, "CREATE"], [2, "EDIT"], [3, "EDIT"]]);
    const rest = await send("get", `/api/tickets/${ticket.id}/actions-taken/${action.id}/revisions?page=2&pageSize=10`, requester.cookie);
    expect(rest.body.items.map((r: { version: number }) => r.version)).toEqual([11, 12, 13]);
    const max = await send("get", `/api/tickets/${ticket.id}/actions-taken/${action.id}/revisions?pageSize=50`, requester.cookie);
    expect(max.body.items.map((r: { version: number }) => r.version)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect(response.body.items[2].snapshot.description).toBe("Second edit");
    expect(response.body.items[0].actor).toEqual({ id: staff.id, name: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toMatch(/mutationId|requestHash|actorName|email/);

    const otherTicket = await world.ticket(requester.id);
    expect((await send("get", `/api/tickets/${otherTicket.id}/actions-taken/${action.id}/revisions`, staff.cookie)).status).toBe(404);
    expect((await send("get", `/api/tickets/${otherTicket.id}/actions-taken/${action.id}`, staff.cookie)).status).toBe(404);
  });

  it("orders status events by time then id, including equal times", async () => {
    const ticket = await world.ticket(requester.id);
    const at = new Date(Date.now() - 60_000);
    await prisma.ticketStatusEvent.createMany({
      data: [
        { ticketId: ticket.id, actorId: requester.id, fromStatus: null, toStatus: "NEW", createdAt: new Date(at.getTime() - 1000) },
        { ticketId: ticket.id, actorId: staff.id, fromStatus: "NEW", toStatus: "OPEN", createdAt: at },
        { ticketId: ticket.id, actorId: staff.id, fromStatus: "OPEN", toStatus: "IN_PROGRESS", createdAt: at },
      ],
    });
    const response = await send("get", `/api/tickets/${ticket.id}/status-history`, requester.cookie);
    expect(response.body.items.map((e: { toStatus: string }) => e.toStatus)).toEqual(["NEW", "OPEN", "IN_PROGRESS"]);
    expect(response.body.items[1].actor).toEqual({ id: staff.id, name: expect.any(String) });
    const legacy = await world.ticket(requester.id);
    expect((await send("get", `/api/tickets/${legacy.id}/status-history`, staff.cookie)).body.items).toEqual([]);
  });
});

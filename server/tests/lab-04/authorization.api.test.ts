import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { createAction, createBody, createWorld, send, ticketStamp } from "./actionFixtures.js";

const prisma = getPrisma();
const world = await createWorld("auth");
let staff: { id: number; cookie: string };
let owner: { id: number; cookie: string };
let other: { id: number; cookie: string };

beforeAll(async () => {
  [staff, owner, other] = await Promise.all([
    world.user("staff", "IT_STAFF"), world.user("owner", "REQUESTER"), world.user("other", "REQUESTER"),
  ]);
});
afterAll(() => world.cleanup());

describe("Actions Taken authorization (AUTH-01, Action endpoints)", () => {
  it("requires a valid session and a completed password change", async () => {
    const ticket = await world.ticket(owner.id);
    expect((await request(app).get(`/api/tickets/${ticket.id}/actions-taken`)).status).toBe(401);
    await prisma.user.update({ where: { id: other.id }, data: { mustChangePassword: true } });
    expect((await send("get", `/api/tickets/${ticket.id}/actions-taken`, other.cookie)).status).toBe(403);
    await prisma.user.update({ where: { id: other.id }, data: { mustChangePassword: false } });
  });

  it("lets the owning Requester read all shared work, but every write is 403 and writes nothing", async () => {
    const ticket = await world.ticket(owner.id);
    const { action } = await createAction(ticket.id, staff.cookie, { followUpRequired: true, followUpNote: "Call back" });
    await prisma.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, content: "PRIVATE-STAFF-NOTE" } });

    for (const url of ["/actions-taken", `/actions-taken/${action.id}`, `/actions-taken/${action.id}/revisions`, "/status-history"]) {
      const response = await send("get", `/api/tickets/${ticket.id}${url}`, owner.cookie);
      expect(response.status, url).toBe(200);
      expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE-STAFF-NOTE|email|passwordHash|tokenHash|storedName/);
    }
    const stamp = await ticketStamp(ticket.id);
    const writes: Array<[string, Record<string, unknown>]> = [
      ["post:", createBody(stamp)],
      [`patch:/${action.id}`, { mutationId: randomUUID(), ticketUpdatedAt: stamp, version: 1, description: "Requester edit" }],
      [`patch:/${action.id}/assignee`, { mutationId: randomUUID(), ticketUpdatedAt: stamp, version: 1, assigneeId: staff.id }],
      [`patch:/${action.id}/status`, { mutationId: randomUUID(), ticketUpdatedAt: stamp, version: 1, status: "COMPLETED", result: "Done" }],
    ];
    for (const [key, body] of writes) {
      const [method, rest] = key.split(":") as ["post" | "patch", string];
      const response = await send(method, `/api/tickets/${ticket.id}/actions-taken${rest}`, owner.cookie, body);
      expect(response.status, key).toBe(403);
    }
    expect(await prisma.actionTakenRevision.count({ where: { actionId: action.id } })).toBe(1);
    expect(await ticketStamp(ticket.id)).toBe(stamp);
  });

  it("answers another Requester's reads and writes with 404, exactly like a missing Ticket", async () => {
    const ticket = await world.ticket(owner.id);
    const { action } = await createAction(ticket.id, staff.cookie);
    const missing = 2_147_483_000;
    for (const url of ["/actions-taken", `/actions-taken/${action.id}`, `/actions-taken/${action.id}/revisions`, "/status-history"]) {
      const cross = await send("get", `/api/tickets/${ticket.id}${url}`, other.cookie);
      const absent = await send("get", `/api/tickets/${missing}${url}`, other.cookie);
      expect([cross.status, cross.body]).toEqual([absent.status, absent.body]);
      expect(cross.status).toBe(404);
    }
    const write = await send("post", `/api/tickets/${ticket.id}/actions-taken`, other.cookie, createBody(await ticketStamp(ticket.id)));
    expect(write.status).toBe(404);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
    expect((await send("get", `/api/tickets/abc/actions-taken`, staff.cookie)).status).toBe(400);
  });

  it("rejects a deactivated Staff session before any write", async () => {
    const ticket = await world.ticket(owner.id);
    const leaving = await world.user("leaving", "IT_STAFF");
    await prisma.user.update({ where: { id: leaving.id }, data: { isActive: false } });
    const response = await send("post", `/api/tickets/${ticket.id}/actions-taken`, leaving.cookie, createBody(await ticketStamp(ticket.id)));
    expect(response.status).toBe(401);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
  });
});

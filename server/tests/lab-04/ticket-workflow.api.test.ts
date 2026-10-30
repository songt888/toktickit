import { randomUUID } from "node:crypto";
import type { TicketStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { completedAction, createAction, createWorld, moveTicket, send, ticketStamp } from "./actionFixtures.js";
import { isAllowed, ticketStatuses } from "./workflowExpectations.js";

const prisma = getPrisma();
const world = await createWorld("workflow");
let staff: { id: number; cookie: string };
let requester: { id: number; cookie: string };

const events = (ticketId: number) => prisma.ticketStatusEvent.count({ where: { ticketId } });
const needsConfirm = (status: TicketStatus) => status === "CLOSED" || status === "CANCELLED";

beforeAll(async () => {
  [staff, requester] = await Promise.all([world.user("staff", "IT_STAFF"), world.user("requester", "REQUESTER")]);
});
afterAll(() => world.cleanup());

describe("Ticket workflow API", () => {
  it("API-07 allows exactly the matrix for all 64 direct calls and appends one event only on success", async () => {
    // One Ticket with settled work, so RESOLVED is decided by the matrix alone.
    const ticket = await world.ticket(requester.id, { ownerId: staff.id });
    await completedAction(ticket.id, staff.cookie);
    for (const from of ticketStatuses) {
      for (const to of ticketStatuses) {
        await prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: from } });
        const before = await events(ticket.id);
        const response = await moveTicket(ticket.id, staff.cookie, to, await ticketStamp(ticket.id), needsConfirm(to) ? true : undefined);
        const pair = `${from} -> ${to}`;
        if (isAllowed(from, to)) {
          expect(response.status, pair).toBe(200);
          expect(response.body.currentStatus, pair).toBe(to);
          expect(await events(ticket.id), pair).toBe(before + 1);
          const last = await prisma.ticketStatusEvent.findFirstOrThrow({ where: { ticketId: ticket.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
          expect([last.fromStatus, last.toStatus, last.actorId], pair).toEqual([from, to, staff.id]);
        } else {
          expect([response.status, response.body.code], pair).toEqual([409, "INVALID_TRANSITION"]);
          expect(await events(ticket.id), pair).toBe(before);
        }
      }
    }

    for (const terminal of ["CLOSED", "CANCELLED"] as const) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: terminal === "CLOSED" ? "RESOLVED" : "OPEN" } });
      const before = await events(ticket.id);
      expect((await moveTicket(ticket.id, staff.cookie, terminal, await ticketStamp(ticket.id))).status).toBe(400);
      expect(await events(ticket.id)).toBe(before);
    }
    expect((await moveTicket(ticket.id, requester.cookie, "OPEN", await ticketStamp(ticket.id))).status).toBe(403);

    const stale = await ticketStamp(ticket.id);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: "OPEN" } });
    const before = await events(ticket.id);
    const staleMove = await moveTicket(ticket.id, staff.cookie, "IN_PROGRESS", stale);
    expect([staleMove.status, staleMove.body.code]).toEqual([409, "STALE_STATE"]);
    expect(await events(ticket.id)).toBe(before);
  });

  it("API-08 enforces the resolution gate on direct calls and explains it", async () => {
    const ticket = await world.ticket(requester.id, { ownerId: staff.id });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: "IN_PROGRESS" } });
    const resolve = async () => moveTicket(ticket.id, staff.cookie, "RESOLVED", await ticketStamp(ticket.id));

    const none = await resolve();
    expect([none.status, none.body.code]).toEqual([409, "RESOLUTION_GATE_FAILED"]);
    expect(none.body.resolutionGate).toEqual({ canResolve: false, completedActions: 0, pendingActions: 0, unsettledFollowUpActions: 0 });

    const { action: cancelled } = await createAction(ticket.id, staff.cookie);
    await send("patch", `/api/tickets/${ticket.id}/actions-taken/${cancelled.id}/status`, staff.cookie, {
      mutationId: randomUUID(), ticketUpdatedAt: await ticketStamp(ticket.id), version: 1, status: "CANCELLED", confirm: true, cancellationReason: "Not needed after all",
    });
    expect((await resolve()).body.resolutionGate).toMatchObject({ canResolve: false, completedActions: 0 });

    const pending = (await createAction(ticket.id, staff.cookie)).action;
    const followUp = await completedAction(ticket.id, staff.cookie, { followUpRequired: true, followUpNote: "Check again next week" });
    expect((await resolve()).body.resolutionGate).toEqual({ canResolve: false, completedActions: 1, pendingActions: 1, unsettledFollowUpActions: 1 });

    // Advisory indication neither resolves nor satisfies the gate, and records no status event.
    const before = await events(ticket.id);
    const advisory = await send("post", `/api/tickets/${ticket.id}/problem-resolution`, requester.cookie, { appearsResolved: true });
    expect(advisory.body).toMatchObject({ problemAppearsResolved: true, currentStatus: "IN_PROGRESS" });
    expect(await events(ticket.id)).toBe(before);
    expect((await resolve()).body.code).toBe("RESOLUTION_GATE_FAILED");

    const detail = await send("get", `/api/staff/tickets/${ticket.id}`, staff.cookie);
    expect(detail.body).toMatchObject({ lastResolvedAt: null, resolutionGate: { canResolve: false, pendingActions: 1, unsettledFollowUpActions: 1 } });

    await send("patch", `/api/tickets/${ticket.id}/actions-taken/${pending.id}/status`, staff.cookie, {
      mutationId: randomUUID(), ticketUpdatedAt: await ticketStamp(ticket.id), version: 1, status: "CANCELLED", confirm: true, cancellationReason: "Covered by the other work",
    });
    expect((await resolve()).body.resolutionGate).toMatchObject({ pendingActions: 0, unsettledFollowUpActions: 1 });
    await send("patch", `/api/tickets/${ticket.id}/actions-taken/${followUp.id}`, staff.cookie, {
      mutationId: randomUUID(), ticketUpdatedAt: await ticketStamp(ticket.id), version: followUp.version, followUpRequired: false,
    });
    const resolved = await resolve();
    expect([resolved.status, resolved.body.currentStatus]).toEqual([200, "RESOLVED"]);
    expect(resolved.body.lastResolvedAt).toBe(resolved.body.updatedAt);

    const requesterView = await send("get", `/api/tickets/${ticket.id}`, requester.cookie);
    expect(requesterView.body.lastResolvedAt).toBe(resolved.body.lastResolvedAt);
    expect(requesterView.body).not.toHaveProperty("resolutionGate");
    const actionWrite = await send("post", `/api/tickets/${ticket.id}/actions-taken`, staff.cookie, {
      mutationId: randomUUID(), ticketUpdatedAt: await ticketStamp(ticket.id), actionAt: new Date(Date.now() - 1000).toISOString(), description: "Late work", followUpRequired: false,
    });
    expect(actionWrite.body.code).toBe("TICKET_LOCKED");
  });

  it("API-08 grandfathers legacy resolved and closed Tickets but gates a reopened zero-Action Ticket", async () => {
    const legacy = await world.ticket(requester.id, { currentStatus: "RESOLVED", ownerId: staff.id });
    expect((await moveTicket(legacy.id, staff.cookie, "CLOSED", await ticketStamp(legacy.id), true)).status).toBe(200);
    const reopened = await moveTicket(legacy.id, staff.cookie, "REOPENED", await ticketStamp(legacy.id));
    expect([reopened.status, reopened.body.lastResolvedAt]).toEqual([200, null]);
    expect((await moveTicket(legacy.id, staff.cookie, "IN_PROGRESS", await ticketStamp(legacy.id))).status).toBe(200);
    const gated = await moveTicket(legacy.id, staff.cookie, "RESOLVED", await ticketStamp(legacy.id));
    expect([gated.status, gated.body.code]).toEqual([409, "RESOLUTION_GATE_FAILED"]);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: legacy.id } })).currentStatus).toBe("IN_PROGRESS");
  });

  it("keeps lastResolvedAt through close and reopen, and resets it only on a new resolution", async () => {
    const ticket = await world.ticket(requester.id, { ownerId: staff.id });
    await completedAction(ticket.id, staff.cookie);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: "IN_PROGRESS" } });
    const first = await moveTicket(ticket.id, staff.cookie, "RESOLVED", await ticketStamp(ticket.id));
    const closed = await moveTicket(ticket.id, staff.cookie, "CLOSED", await ticketStamp(ticket.id), true);
    const reopened = await moveTicket(ticket.id, staff.cookie, "REOPENED", await ticketStamp(ticket.id));
    expect([closed.body.lastResolvedAt, reopened.body.lastResolvedAt]).toEqual([first.body.lastResolvedAt, first.body.lastResolvedAt]);
    await moveTicket(ticket.id, staff.cookie, "IN_PROGRESS", await ticketStamp(ticket.id));
    const second = await moveTicket(ticket.id, staff.cookie, "RESOLVED", await ticketStamp(ticket.id));
    expect(new Date(second.body.lastResolvedAt).getTime()).toBeGreaterThan(new Date(first.body.lastResolvedAt).getTime());
  });

  it("records the creation event with the Ticket and advances timestamps on advisory writes", async () => {
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    const created = await send("post", "/api/tickets", requester.cookie, {
      categoryId: category.id, relatedSystemId: system.id, summary: "Workflow creation event", description: "Created through the API.", requestedPriority: "LOW",
    });
    expect(created.status).toBe(201);
    world.track(created.body.id);
    const history = await send("get", `/api/tickets/${created.body.id}/status-history`, requester.cookie);
    expect(history.body.items).toMatchObject([{ fromStatus: null, toStatus: "NEW", actor: { id: requester.id } }]);

    const stamps = [new Date(await ticketStamp(created.body.id)).getTime()];
    for (const appearsResolved of [true, false, true]) {
      const response = await send("post", `/api/tickets/${created.body.id}/problem-resolution`, requester.cookie, { appearsResolved });
      stamps.push(new Date(response.body.updatedAt).getTime());
    }
    expect(stamps.every((value, i) => i === 0 || value > stamps[i - 1])).toBe(true);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: created.body.id } })).currentStatus).toBe("NEW");
  });
});

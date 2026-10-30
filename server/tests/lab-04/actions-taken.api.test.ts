import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { createAction, createBody, createWorld, iso, send, ticketStamp } from "./actionFixtures.js";

const prisma = getPrisma();
const world = await createWorld("api");
let staff: { id: number; cookie: string };
let staffB: { id: number; cookie: string };
let admin: { id: number; cookie: string };
let requester: { id: number; cookie: string };
let inactiveStaff: { id: number; cookie: string };

const path = (ticketId: number, rest = "") => `/api/tickets/${ticketId}/actions-taken${rest}`;
const counts = async (ticketId: number) => ({
  actions: await prisma.actionTaken.count({ where: { ticketId } }),
  revisions: await prisma.actionTakenRevision.count({ where: { action: { ticketId } } }),
  ticket: await ticketStamp(ticketId),
});
async function current(ticketId: number, actionId: number) {
  const action = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } });
  return { mutationId: randomUUID(), ticketUpdatedAt: await ticketStamp(ticketId), version: action.version };
}

beforeAll(async () => {
  [staff, staffB, admin, requester, inactiveStaff] = await Promise.all([
    world.user("staff", "IT_STAFF"),
    world.user("staff-b", "IT_STAFF"),
    world.user("admin", "ADMINISTRATOR"),
    world.user("requester", "REQUESTER"),
    world.user("inactive", "IT_STAFF", false),
  ]);
});
afterAll(() => world.cleanup());

describe("Actions Taken API", () => {
  it("API-01 creates under the Ticket with the session performer, an eligible assignee and one revision", async () => {
    const ticket = await world.ticket(requester.id, { ownerId: staffB.id });
    const before = await ticketStamp(ticket.id);
    const forDefault = await send("post", path(ticket.id), staff.cookie, createBody(before));
    expect(forDefault.status).toBe(201);
    expect(forDefault.body.replayed).toBe(false);
    expect(forDefault.body.action).toMatchObject({
      ticketId: ticket.id, status: "PLANNED", version: 1, result: "",
      performedBy: { id: staff.id }, assignee: { id: staff.id, role: "IT_STAFF", isActive: true },
    });
    expect(new Date(forDefault.body.ticketUpdatedAt).getTime()).toBeGreaterThan(new Date(before).getTime());

    const chosen = await send("post", path(ticket.id), admin.cookie, createBody(forDefault.body.ticketUpdatedAt, { assigneeId: staffB.id }));
    expect(chosen.status).toBe(201);
    expect(chosen.body.action).toMatchObject({ performedBy: { id: admin.id }, assignee: { id: staffB.id } });

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.ownerId).toBe(staffB.id);
    const revisions = await prisma.actionTakenRevision.findMany({ where: { actionId: forDefault.body.action.id } });
    expect(revisions).toMatchObject([{ version: 1, operation: "CREATE", actorId: staff.id }]);
    expect(JSON.stringify(forDefault.body)).not.toMatch(/email|passwordHash|mutationId|requestHash/);
  });

  it("API-02 rejects invalid input with 400 and writes nothing; boundaries and literal text work", async () => {
    const ticket = await world.ticket(requester.id, { ticketDate: new Date(Date.now() - 3_600_000) });
    const stamp = await ticketStamp(ticket.id);
    const before = await counts(ticket.id);
    const cases: Array<Record<string, unknown>> = [
      { description: "   " },
      { description: "x".repeat(4001) },
      { actionAt: iso(new Date(Date.now() + 120_000)) },
      { actionAt: iso(new Date(ticket.ticketDate.getTime() - 1_000)) },
      { actionAt: "2026-10-05T01:00:00" },
      { followUpRequired: true },
      { followUpRequired: false, followUpNote: "Call back" },
      { performedById: staffB.id },
      { status: "COMPLETED" },
      { version: 3 },
      { mutationId: "not-a-uuid" },
      { ticketUpdatedAt: "yesterday" },
      { assigneeId: 0 },
    ];
    for (const extra of cases) {
      const response = await send("post", path(ticket.id), staff.cookie, createBody(stamp, extra));
      expect(response.status, JSON.stringify(extra)).toBe(400);
      expect(response.body.code).toBe("VALIDATION_FAILED");
    }
    const missing = await send("post", path(ticket.id), staff.cookie, { mutationId: randomUUID(), ticketUpdatedAt: stamp });
    expect(Object.keys(missing.body.fieldErrors).sort()).toEqual(["actionAt", "description", "followUpRequired"]);
    expect(await counts(ticket.id)).toEqual(before);

    const ok = await send("post", path(ticket.id), staff.cookie, createBody(stamp, {
      description: `<script>alert(1)</script>${"x".repeat(3975)}`, followUpRequired: true, followUpNote: "n".repeat(2000), attachmentNotes: "see photo.png",
    }));
    expect(ok.status).toBe(201);
    expect(ok.body.action.description.startsWith("<script>")).toBe(true);
    const unicode = await send("post", path(ticket.id), staff.cookie, createBody(ok.body.ticketUpdatedAt, { description: "ตรวจสอบสาย LAN ✓" }));
    expect(unicode.body.action.description).toBe("ตรวจสอบสาย LAN ✓");
  });

  it("API-03 assigns only active Staff or Administrators and keeps performer and owner", async () => {
    const ticket = await world.ticket(requester.id, { ownerId: staff.id });
    for (const assigneeId of [requester.id, inactiveStaff.id, 2_147_483_647]) {
      const response = await send("post", path(ticket.id), staff.cookie, createBody(await ticketStamp(ticket.id), { assigneeId }));
      expect(response.status).toBe(400);
      expect(response.body.fieldErrors).toHaveProperty("assigneeId");
    }
    const { action } = await createAction(ticket.id, staff.cookie);
    const reassign = await send("patch", path(ticket.id, `/${action.id}/assignee`), admin.cookie, { ...(await current(ticket.id, action.id)), assigneeId: staffB.id });
    expect(reassign.status).toBe(200);
    expect(reassign.body.action).toMatchObject({ performedBy: { id: staff.id }, assignee: { id: staffB.id }, version: 2 });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ownerId).toBe(staff.id);

    for (const assigneeId of [staffB.id, null, inactiveStaff.id, requester.id]) {
      const response = await send("patch", path(ticket.id, `/${action.id}/assignee`), admin.cookie, { ...(await current(ticket.id, action.id)), assigneeId });
      expect(response.status, String(assigneeId)).toBe(400);
    }
    expect(await prisma.actionTakenRevision.findMany({ where: { actionId: action.id }, orderBy: { version: "asc" }, select: { operation: true } }))
      .toEqual([{ operation: "CREATE" }, { operation: "ASSIGN" }]);

    // A later deactivation keeps the historical assignee readable, marked inactive.
    const leaver = await world.user("leaver", "IT_STAFF");
    await send("patch", path(ticket.id, `/${action.id}/assignee`), admin.cookie, { ...(await current(ticket.id, action.id)), assigneeId: leaver.id });
    await prisma.user.update({ where: { id: leaver.id }, data: { isActive: false } });
    const read = await send("get", path(ticket.id, `/${action.id}`), staff.cookie);
    expect(read.body.action.assignee).toMatchObject({ id: leaver.id, isActive: false, name: expect.any(String) });
  });

  it("API-04 follows the lifecycle, needs result, reason and confirmation, and locks finished Tickets", async () => {
    const ticket = await world.ticket(requester.id);
    const status = async (actionId: number, body: Record<string, unknown>) =>
      send("patch", path(ticket.id, `/${actionId}/status`), staff.cookie, { ...(await current(ticket.id, actionId)), ...body });

    const { action } = await createAction(ticket.id, staff.cookie);
    expect((await status(action.id, { status: "PLANNED" })).status).toBe(400);
    expect((await status(action.id, { status: "IN_PROGRESS" })).body.action.status).toBe("IN_PROGRESS");
    expect((await status(action.id, { status: "IN_PROGRESS" })).body.code).toBe("INVALID_TRANSITION");
    expect((await status(action.id, { status: "COMPLETED" })).body.fieldErrors).toHaveProperty("result");
    expect((await status(action.id, { status: "COMPLETED", confirm: true, result: "Fixed" })).status).toBe(400);
    const done = await status(action.id, { status: "COMPLETED", result: "Adapter replaced" });
    expect(done.body.action).toMatchObject({ status: "COMPLETED", result: "Adapter replaced", version: 3 });
    expect((await status(action.id, { status: "CANCELLED", confirm: true, cancellationReason: "Too late now" })).body.code).toBe("INVALID_TRANSITION");

    const second = (await createAction(ticket.id, staff.cookie)).action;
    expect((await status(second.id, { status: "CANCELLED", cancellationReason: "Not needed" })).body.fieldErrors).toHaveProperty("confirm");
    expect((await status(second.id, { status: "CANCELLED", confirm: true, cancellationReason: "No" })).body.fieldErrors).toHaveProperty("cancellationReason");
    expect((await status(second.id, { status: "CANCELLED", confirm: true, cancellationReason: "Not needed", result: "x" })).status).toBe(400);
    const cancelled = await status(second.id, { status: "CANCELLED", confirm: true, cancellationReason: "Duplicate of the first action" });
    expect(cancelled.body.action).toMatchObject({ status: "CANCELLED", cancellationReason: "Duplicate of the first action" });
    const edit = await send("patch", path(ticket.id, `/${second.id}`), staff.cookie, { ...(await current(ticket.id, second.id)), description: "Changed" });
    expect(edit.body.code).toBe("INVALID_TRANSITION");

    for (const locked of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
      const lockedTicket = await world.ticket(requester.id, { currentStatus: locked });
      const response = await send("post", path(lockedTicket.id), staff.cookie, createBody(await ticketStamp(lockedTicket.id)));
      expect(response.status).toBe(409);
      expect(response.body.code).toBe("TICKET_LOCKED");
    }
    await prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: "RESOLVED" } });
    expect((await send("patch", path(ticket.id, `/${action.id}`), staff.cookie, { ...(await current(ticket.id, action.id)), result: "More detail" })).body.code).toBe("TICKET_LOCKED");
  });

  it("API-05 appends exactly one revision per edit, allows completed corrections, and rejects no-op edits", async () => {
    const ticket = await world.ticket(requester.id);
    const { action } = await createAction(ticket.id, staff.cookie, { followUpRequired: true, followUpNote: "Call the Requester" });
    const edit = (body: Record<string, unknown>) =>
      current(ticket.id, action.id).then((c) => send("patch", path(ticket.id, `/${action.id}`), staffB.cookie, { ...c, ...body }));

    const changed = await edit({ description: "Check the wireless adapter and driver" });
    expect(changed.body.action).toMatchObject({ version: 2, description: "Check the wireless adapter and driver", performedBy: { id: staff.id } });
    expect((await edit({ description: "  Check the wireless adapter and driver  " })).status).toBe(400);
    expect((await edit({ assigneeId: staffB.id })).status).toBe(400);
    expect((await edit({ status: "COMPLETED" })).status).toBe(400);
    const cleared = await edit({ followUpRequired: false });
    expect(cleared.body.action).toMatchObject({ followUpRequired: false, followUpNote: null, version: 3 });

    await send("patch", path(ticket.id, `/${action.id}/status`), staff.cookie, { ...(await current(ticket.id, action.id)), status: "COMPLETED", result: "Driver updated" });
    const correction = await edit({ followUpRequired: true, followUpNote: "Confirm after a week" });
    expect(correction.body.action).toMatchObject({ status: "COMPLETED", followUpRequired: true, version: 5 });
    expect((await edit({ result: "" })).body.fieldErrors).toHaveProperty("result");

    const revisions = await prisma.actionTakenRevision.findMany({ where: { actionId: action.id }, orderBy: { version: "asc" } });
    expect(revisions.map((r) => [r.version, r.operation])).toEqual([[1, "CREATE"], [2, "EDIT"], [3, "EDIT"], [4, "STATUS"], [5, "EDIT"]]);
    expect(revisions.map((r) => r.actorId)).toEqual([staff.id, staffB.id, staffB.id, staff.id, staffB.id]);
  });

  it("API-09 rejects stale Ticket timestamps and Action versions without partial writes", async () => {
    const ticket = await world.ticket(requester.id);
    const first = await createAction(ticket.id, staff.cookie);
    const staleStamp = iso(new Date(new Date(first.ticketUpdatedAt).getTime() - 1));
    const before = await counts(ticket.id);
    const staleCreate = await send("post", path(ticket.id), staff.cookie, createBody(staleStamp));
    expect(staleCreate.status).toBe(409);
    expect(staleCreate.body.code).toBe("STALE_STATE");
    const staleVersion = await send("patch", path(ticket.id, `/${first.action.id}`), staff.cookie, {
      ...(await current(ticket.id, first.action.id)), version: 2, description: "Other",
    });
    expect(staleVersion.body.code).toBe("STALE_STATE");
    expect(await counts(ticket.id)).toEqual(before);

    const stamps: number[] = [new Date(first.ticketUpdatedAt).getTime()];
    for (let i = 0; i < 3; i++) stamps.push(new Date((await createAction(ticket.id, staff.cookie)).ticketUpdatedAt).getTime());
    expect(stamps.every((value, i) => i === 0 || value > stamps[i - 1])).toBe(true);
  });

  it("API-10 replays a lost-response retry exactly and rejects a reused id for another change", async () => {
    const ticket = await world.ticket(requester.id);
    const body = createBody(await ticketStamp(ticket.id));
    const first = await send("post", path(ticket.id), staff.cookie, body);
    const retry = await send("post", path(ticket.id), staff.cookie, body);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual({ ...first.body, replayed: true });
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);

    const editBody = { ...(await current(ticket.id, first.body.action.id)), description: "Edited once" };
    const edited = await send("patch", path(ticket.id, `/${first.body.action.id}`), staff.cookie, editBody);
    await send("patch", path(ticket.id, `/${first.body.action.id}`), staff.cookie, { ...(await current(ticket.id, first.body.action.id)), description: "Edited twice" });
    const lateRetry = await send("patch", path(ticket.id, `/${first.body.action.id}`), staff.cookie, editBody);
    expect(lateRetry.status).toBe(200);
    expect(lateRetry.body.action).toEqual(edited.body.action);

    const reused = await send("post", path(ticket.id), staff.cookie, { ...body, description: "Different work" });
    expect(reused.status).toBe(409);
    expect(reused.body.code).toBe("MUTATION_ID_REUSED");
    const otherTicket = await world.ticket(requester.id);
    const crossTicket = await send("post", path(otherTicket.id), staff.cookie, { ...body, ticketUpdatedAt: await ticketStamp(otherTicket.id) });
    expect(crossTicket.body.code).toBe("MUTATION_ID_REUSED");
    expect(await prisma.actionTaken.count({ where: { ticketId: otherTicket.id } })).toBe(0);
  });
});

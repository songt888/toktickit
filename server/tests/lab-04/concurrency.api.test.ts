import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { createAction, createBody, createWorld, send, ticketStamp } from "./actionFixtures.js";

const prisma = getPrisma();
const world = await createWorld("conc");
let staff: { id: number; cookie: string };
let staffB: { id: number; cookie: string };
let admin: { id: number; cookie: string };
let requester: { id: number; cookie: string };

beforeAll(async () => {
  [staff, staffB, admin, requester] = await Promise.all([
    world.user("staff", "IT_STAFF"), world.user("staff-b", "IT_STAFF"), world.user("admin", "ADMINISTRATOR"), world.user("requester", "REQUESTER"),
  ]);
});
afterAll(() => world.cleanup());

describe("Actions Taken concurrency", () => {
  it("CONC-03 runs simultaneous same-id retries exactly once and blocks cross-Ticket reuse", async () => {
    const ticket = await world.ticket(requester.id);
    const body = createBody(await ticketStamp(ticket.id));
    const responses = await Promise.all(Array.from({ length: 6 }, () => send("post", `/api/tickets/${ticket.id}/actions-taken`, staff.cookie, body)));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 200, 201]);
    expect(new Set(responses.map((r) => r.body.action.id)).size).toBe(1);
    expect(await prisma.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(1);
    expect(await prisma.actionTakenRevision.count({ where: { action: { ticketId: ticket.id } } })).toBe(1);

    const [a, b] = [await world.ticket(requester.id), await world.ticket(requester.id)];
    const mutationId = randomUUID();
    const [ra, rb] = await Promise.all([a, b].map(async (t) =>
      send("post", `/api/tickets/${t.id}/actions-taken`, staff.cookie, { ...createBody(await ticketStamp(t.id)), mutationId })));
    expect([ra.status, rb.status].sort()).toEqual([201, 409]);
    expect([ra.body.code, rb.body.code]).toContain("MUTATION_ID_REUSED");
    expect(await prisma.actionTaken.count({ where: { ticketId: { in: [a.id, b.id] } } })).toBe(1);
  });

  it("CONC-01 serializes competing writes on one Ticket: one wins, the other conflicts, nothing partial", async () => {
    const ticket = await world.ticket(requester.id);
    const { action } = await createAction(ticket.id, staff.cookie);
    const stamp = await ticketStamp(ticket.id);
    const edits = await Promise.all(["Edit A", "Edit B"].map((description, i) =>
      send("patch", `/api/tickets/${ticket.id}/actions-taken/${action.id}`, i ? staffB.cookie : staff.cookie, {
        mutationId: randomUUID(), ticketUpdatedAt: stamp, version: 1, description,
      })));
    expect(edits.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.actionTakenRevision.count({ where: { actionId: action.id } })).toBe(2);

    // An Action create races a Lab 3 owner change that saw the same Ticket timestamp.
    const seen = await ticketStamp(ticket.id);
    const [create, owner] = await Promise.all([
      send("post", `/api/tickets/${ticket.id}/actions-taken`, staff.cookie, createBody(seen)),
      send("patch", `/api/staff/tickets/${ticket.id}/owner`, staffB.cookie, { ownerId: staffB.id, updatedAt: seen }),
    ]);
    const outcomes = [create.status, owner.status];
    expect(outcomes.filter((status) => status < 300)).toHaveLength(1);
    expect(outcomes).toContain(409);
    const actions = await prisma.actionTaken.count({ where: { ticketId: ticket.id } });
    const revisions = await prisma.actionTakenRevision.count({ where: { action: { ticketId: ticket.id } } });
    expect(revisions).toBe(actions + 1);
  });

  it("CONC-02 never commits a fresh assignment, create or completion for a user deactivated or demoted first", async () => {
    const eligibility = "Choose an active IT Staff member or Administrator.";
    type Race = { name: string; userChange: Record<string, unknown> };
    const races: Race[] = [
      { name: "assign vs deactivate", userChange: { isActive: false } },
      { name: "create vs demote", userChange: { role: "REQUESTER" } },
      { name: "complete vs deactivate", userChange: { isActive: false } },
    ];
    for (const race of races) {
      for (let round = 0; round < 3; round++) {
        const ticket = await world.ticket(requester.id);
        const target = await world.user(`target-${races.indexOf(race)}-${round}`, "IT_STAFF");
        // Complete needs the target already assigned; the other races assign it in the racing write.
        const seeded = race.name.startsWith("complete") ? (await createAction(ticket.id, staff.cookie, { assigneeId: target.id })).action : null;
        const write = async () => {
          const stamp = await ticketStamp(ticket.id);
          if (race.name.startsWith("create")) {
            return send("post", `/api/tickets/${ticket.id}/actions-taken`, staff.cookie, createBody(stamp, { assigneeId: target.id }));
          }
          if (seeded) {
            return send("patch", `/api/tickets/${ticket.id}/actions-taken/${seeded.id}/status`, staff.cookie, {
              mutationId: randomUUID(), ticketUpdatedAt: stamp, version: 1, status: "COMPLETED", result: "Done",
            });
          }
          const { action } = await createAction(ticket.id, staff.cookie);
          return send("patch", `/api/tickets/${ticket.id}/actions-taken/${action.id}/assignee`, staff.cookie, {
            mutationId: randomUUID(), ticketUpdatedAt: await ticketStamp(ticket.id), version: 1, assigneeId: target.id,
          });
        };
        const [result, change] = await Promise.all([write(), send("patch", `/api/admin/users/${target.id}`, admin.cookie, race.userChange)]);
        expect(change.status, race.name).toBe(200);
        if (result.status < 300) {
          // The snapshot is read under the User lock, so it shows the assignee as it was at commit.
          expect(result.body.action.assignee, race.name).toMatchObject({ id: target.id, isActive: true, role: "IT_STAFF" });
        } else {
          expect([result.status, result.body.fieldErrors?.assigneeId], race.name).toEqual([400, eligibility]);
        }
        const [actions, revisions] = await Promise.all([
          prisma.actionTaken.count({ where: { ticketId: ticket.id } }),
          prisma.actionTakenRevision.count({ where: { action: { ticketId: ticket.id } } }),
        ]);
        expect(revisions, race.name).toBeGreaterThanOrEqual(actions);
      }
    }

    // Once the change has committed, a fresh write naming that user fails for eligibility, not a duplicate.
    const ticket = await world.ticket(requester.id);
    const gone = await world.user("gone", "IT_STAFF");
    await send("patch", `/api/admin/users/${gone.id}`, admin.cookie, { isActive: false });
    const { action } = await createAction(ticket.id, staff.cookie);
    const late = await send("patch", `/api/tickets/${ticket.id}/actions-taken/${action.id}/assignee`, staff.cookie, {
      mutationId: randomUUID(), ticketUpdatedAt: await ticketStamp(ticket.id), version: 1, assigneeId: gone.id,
    });
    expect([late.status, late.body.fieldErrors?.assigneeId]).toEqual([400, eligibility]);
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { completedAction, createAction, createBody, createWorld, moveTicket, send, ticketStamp } from "./actionFixtures.js";
import { evaluateResolutionGate } from "../../src/resolutionGate.js";

// Barrier: hold the Ticket row lock, start every request, wait until all of them are blocked
// behind it inside their own transactions, then release so they contend for real.
async function behindTicketBarrier<T>(ticketId: number, requests: Array<() => PromiseLike<T>>): Promise<T[]> {
  const db = getPrisma();
  let started: Array<Promise<T>> = [];
  await db.$transaction(async (tx) => {
    const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`;
    // supertest only sends on then(), so wrap each request in a Promise to start it now.
    started = requests.map((run) => Promise.resolve(run()));
    for (let waited = 0; ; waited += 10) {
      // Later waiters queue behind earlier ones, so count everything blocked through the barrier.
      const [{ n }] = await db.$queryRaw<Array<{ n: bigint }>>`
        WITH RECURSIVE chain(pid) AS (
          SELECT pid FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))
          UNION
          SELECT a.pid FROM pg_stat_activity a JOIN chain c ON c.pid = ANY(pg_blocking_pids(a.pid))
        )
        SELECT count(*) AS n FROM chain`;
      if (Number(n) >= requests.length) break;
      if (waited > 5_000) throw new Error(`barrier: only ${n} of ${requests.length} requests reached the lock`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }, { timeout: 10_000 });
  return Promise.all(started);
}

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

  it("CONC-01 never resolves past the gate when barrier-held Action, owner, priority, status or advisory writes race the Resolve", async () => {
    const competitors = ["new pending Action", "reopen follow-up", "owner change", "priority change", "status change", "advisory indication"] as const;
    for (const competitor of competitors) {
      for (let round = 0; round < 3; round++) {
        const ticket = await world.ticket(requester.id, { ownerId: staff.id });
        const done = await completedAction(ticket.id, staff.cookie);
        await moveTicket(ticket.id, staff.cookie, "IN_PROGRESS", await ticketStamp(ticket.id));
        const seen = await ticketStamp(ticket.id);
        const rival = () =>
          competitor === "new pending Action" ? send("post", `/api/tickets/${ticket.id}/actions-taken`, staffB.cookie, createBody(seen))
          : competitor === "reopen follow-up" ? send("patch", `/api/tickets/${ticket.id}/actions-taken/${done.id}`, staffB.cookie, {
            mutationId: randomUUID(), ticketUpdatedAt: seen, version: done.version, followUpRequired: true, followUpNote: "Not settled yet",
          })
          : competitor === "owner change" ? send("patch", `/api/staff/tickets/${ticket.id}/owner`, staffB.cookie, { ownerId: staffB.id, updatedAt: seen })
          : competitor === "priority change" ? send("patch", `/api/staff/tickets/${ticket.id}/it-priority`, staffB.cookie, { itPriority: "URGENT", updatedAt: seen })
          : competitor === "status change" ? moveTicket(ticket.id, staffB.cookie, "WAITING_FOR_REQUESTER", seen)
          : send("post", `/api/tickets/${ticket.id}/problem-resolution`, requester.cookie, { appearsResolved: true });
        const [resolve, other] = await behindTicketBarrier(ticket.id, [() => moveTicket(ticket.id, staff.cookie, "RESOLVED", seen), rival]);

        const label = `${competitor} #${round}: resolve ${resolve.status}, rival ${other.status}`;
        const stale = (response: { status: number; body: { code?: string } }) => response.status === 409 && response.body.code === "STALE_STATE";
        if (competitor === "advisory indication") {
          // The advisory write has no timestamp check, so it always lands; Resolve wins or sees it as stale.
          expect(other.status, label).toBe(200);
          expect(resolve.status === 200 || stale(resolve), label).toBe(true);
        } else {
          // Exactly one writer wins; the loser is a safe stale conflict, never a 500 or a second success.
          expect([resolve.status, other.status].filter((status) => status < 300), label).toHaveLength(1);
          expect(stale(resolve.status < 300 ? other : resolve), label).toBe(true);
        }
        const final = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: { actionsTaken: true } });
        expect(resolve.status === 200, label).toBe(final.currentStatus === "RESOLVED");
        if (final.currentStatus === "RESOLVED") expect(evaluateResolutionGate(final.actionsTaken).canResolve, label).toBe(true);
        const [events, revisions] = await Promise.all([
          prisma.ticketStatusEvent.count({ where: { ticketId: ticket.id } }),
          prisma.actionTakenRevision.count({ where: { action: { ticketId: ticket.id } } }),
        ]);
        const statusWins = Number(resolve.status === 200) + Number(competitor === "status change" && other.status === 200);
        expect(events, label).toBe(1 + statusWins);
        expect(revisions, label).toBe(2 + (competitor === "new pending Action" || competitor === "reopen follow-up" ? Number(other.status < 300) : 0));
      }
    }
  }, 60_000);

  it("CONC-02 never commits a fresh assignment, create or completion for a user deactivated or demoted first", async () => {
    const eligibility = "Choose an active IT Staff member or Administrator.";
    type Race = { name: string; userChange: Record<string, unknown> };
    const races: Race[] = [
      { name: "assign vs deactivate", userChange: { isActive: false } },
      { name: "create vs demote", userChange: { role: "REQUESTER" } },
      { name: "start vs deactivate", userChange: { isActive: false } },
      { name: "complete vs deactivate", userChange: { isActive: false } },
    ];
    for (const race of races) {
      for (let round = 0; round < 3; round++) {
        const ticket = await world.ticket(requester.id);
        const target = await world.user(`target-${races.indexOf(race)}-${round}`, "IT_STAFF");
        // Everything except the racing write is prepared first, so both requests start together.
        const kind = race.name.split(" ")[0];
        const action = kind === "create" ? null
          : (await createAction(ticket.id, staff.cookie, kind === "assign" ? {} : { assigneeId: target.id })).action;
        const stamp = await ticketStamp(ticket.id);
        const actionPath = `/api/tickets/${ticket.id}/actions-taken/${action?.id}`;
        const common = { mutationId: randomUUID(), ticketUpdatedAt: stamp, version: 1 };
        const write = kind === "create"
          ? send("post", `/api/tickets/${ticket.id}/actions-taken`, staff.cookie, createBody(stamp, { assigneeId: target.id }))
          : kind === "assign"
            ? send("patch", `${actionPath}/assignee`, staff.cookie, { ...common, assigneeId: target.id })
            : send("patch", `${actionPath}/status`, staff.cookie, { ...common, status: kind === "start" ? "IN_PROGRESS" : "COMPLETED", ...(kind === "complete" ? { result: "Done" } : {}) });
        const [result, change] = await Promise.all([write, send("patch", `/api/admin/users/${target.id}`, admin.cookie, race.userChange)]);
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
        expect(revisions, race.name).toBe(actions + (result.status < 300 && kind !== "create" ? 1 : 0));
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

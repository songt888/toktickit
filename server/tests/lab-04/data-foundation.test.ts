import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { seedLab3Data } from "../../prisma/seed.js";
import {
  emptyRequesterSeed,
  emptyStaffSeed,
  lab4Tickets,
  seedLab4Data,
} from "../../prisma/seedLab4.js";

const prisma = getPrisma();
const numbers = lab4Tickets.map(({ number }) => number);

// Scoped to the Lab 4 fixtures: other suites create Tickets and users in parallel.
async function snapshotCounts() {
  const ticket = { ticketNumber: { in: numbers } };
  const [tickets, actions, revisions, events, users] = await Promise.all([
    prisma.ticket.count({ where: ticket }),
    prisma.actionTaken.count({ where: { ticket } }),
    prisma.actionTakenRevision.count({ where: { action: { ticket } } }),
    prisma.ticketStatusEvent.count({ where: { ticket } }),
    prisma.user.count({ where: { email: { in: [emptyRequesterSeed.email, emptyStaffSeed.email] } } }),
  ]);
  return { tickets, actions, revisions, events, users };
}

async function sqlRejects(run: () => Promise<unknown>, message: RegExp) {
  await expect(run()).rejects.toThrow(message);
}

describe("Lab 4 data foundation (MIG)", () => {
  beforeAll(async () => {
    process.env.LAB3_SEED_INITIAL_PASSWORD = "Lab4SeedTestPassword123";
    await seedLab3Data(prisma);
    await seedLab4Data(prisma);
  });
  afterAll(async () => {
    delete process.env.LAB3_SEED_INITIAL_PASSWORD;
    await prisma.$disconnect();
  });

  it("MIG-01 keeps Lab 3 tickets untouched: no invented history or resolution time", async () => {
    const legacy = await prisma.ticket.findMany({
      where: { ticketNumber: { notIn: numbers } },
      include: { statusEvents: true },
    });
    expect(legacy.length).toBeGreaterThan(0);
    for (const ticket of legacy) {
      expect(ticket.lastResolvedAt).toBeNull();
      expect(ticket.statusEvents).toHaveLength(0);
    }
  });

  it("MIG-02 seed is idempotent: a second run changes nothing", async () => {
    const before = await snapshotCounts();
    const rows = await prisma.actionTaken.findMany({ where: { ticket: { ticketNumber: { in: numbers } } }, orderBy: { id: "asc" } });
    await seedLab4Data(prisma);
    expect(await snapshotCounts()).toEqual(before);
    expect(await prisma.actionTaken.findMany({ where: { ticket: { ticketNumber: { in: numbers } } }, orderBy: { id: "asc" } })).toEqual(rows);
  });

  it("MIG-03 seed covers every status, priority, ownership and 0/1/many Actions", async () => {
    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { in: numbers } },
      include: { _count: { select: { actionsTaken: true } } },
    });
    expect(new Set(tickets.map((t) => t.currentStatus)).size).toBe(8);
    expect(new Set(tickets.map((t) => t.itPriority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]));
    expect(tickets.some((t) => t.ownerId === null)).toBe(true);
    expect(tickets.some((t) => t.ownerId !== null)).toBe(true);
    const counts = tickets.map((t) => t._count.actionsTaken);
    expect(counts).toContain(0);
    expect(counts).toContain(1);
    expect(Math.max(...counts)).toBeGreaterThan(1);
    const statuses = (await prisma.actionTaken.findMany({ select: { status: true } })).map((a) => a.status);
    for (const s of ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]) expect(statuses).toContain(s);
    expect(await prisma.actionTaken.count({ where: { followUpRequired: true } })).toBeGreaterThan(0);
  });

  it("MIG-04 resolved tickets satisfy the resolution gate and carry lastResolvedAt", async () => {
    const resolved = await prisma.ticket.findMany({
      where: { ticketNumber: { in: numbers }, currentStatus: { in: ["RESOLVED", "CLOSED"] } },
      include: { actionsTaken: true },
    });
    expect(resolved).toHaveLength(2);
    for (const t of resolved) {
      expect(t.lastResolvedAt).not.toBeNull();
      expect(t.actionsTaken.some((a) => a.status === "COMPLETED")).toBe(true);
      expect(t.actionsTaken.every((a) => a.status === "COMPLETED" || a.status === "CANCELLED")).toBe(true);
      expect(t.actionsTaken.some((a) => a.status === "COMPLETED" && a.followUpRequired)).toBe(false);
    }
  });

  it("MIG-05 status events follow the matrix and end at the current status", async () => {
    const allowed: Record<string, string[]> = {
      NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
      OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
      IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
      WAITING_FOR_REQUESTER: ["IN_PROGRESS", "REOPENED", "CANCELLED"],
      RESOLVED: ["CLOSED", "REOPENED"],
      CLOSED: ["REOPENED"],
      REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
      CANCELLED: ["REOPENED"],
    };
    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { in: numbers } },
      include: { statusEvents: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    for (const t of tickets) {
      const events = t.statusEvents;
      expect(events[0].fromStatus).toBeNull();
      expect(events[0].toStatus).toBe("NEW");
      expect(events[events.length - 1].toStatus).toBe(t.currentStatus);
      for (let i = 1; i < events.length; i++) {
        expect(events[i].fromStatus).toBe(events[i - 1].toStatus);
        expect(allowed[events[i].fromStatus!]).toContain(events[i].toStatus);
      }
    }
  });

  it("MIG-06 every Action has one matching creation revision and a stable mutation id", async () => {
    const actions = await prisma.actionTaken.findMany({
      where: { ticket: { ticketNumber: { in: numbers } } },
      include: { revisions: true },
    });
    for (const a of actions) {
      expect(a.revisions).toHaveLength(1);
      expect(a.revisions[0].version).toBe(a.version);
      expect(a.revisions[0].operation).toBe("CREATE");
      expect(a.revisions[0].requestHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(a.revisions[0].snapshot)).not.toMatch(/passwordHash|email/);
    }
  });

  it("MIG-07 dashboard fixtures: a Requester and Staff user with no work", async () => {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: emptyRequesterSeed.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: emptyStaffSeed.email } });
    expect(await prisma.ticket.count({ where: { requesterId: requester.id } })).toBe(0);
    expect(await prisma.ticket.count({ where: { ownerId: staff.id } })).toBe(0);
    expect(await prisma.actionTaken.count({ where: { OR: [{ assigneeId: staff.id }, { performedById: staff.id }] } })).toBe(0);
  });

  it("MIG-08 revisions and status events are append-only, even through raw SQL", async () => {
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTakenRevision" SET "requestHash" = repeat('0', 64)`, /append-only/);
    await sqlRejects(() => prisma.$executeRaw`DELETE FROM "ActionTakenRevision"`, /append-only/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "TicketStatusEvent" SET "toStatus" = 'NEW'`, /append-only/);
    await sqlRejects(() => prisma.$executeRaw`DELETE FROM "TicketStatusEvent"`, /append-only/);
  });

  it("MIG-09 database checks reject invalid Action rows", async () => {
    const a = await prisma.actionTaken.findFirstOrThrow({ where: { status: "COMPLETED", followUpRequired: false } });
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "description" = '  ', "version" = "version" + 1 WHERE id = ${a.id}`, /description_check/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "followUpRequired" = true, "version" = "version" + 1 WHERE id = ${a.id}`, /followUp_check/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "followUpNote" = 'x', "version" = "version" + 1 WHERE id = ${a.id}`, /followUp_check/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "result" = '', "version" = "version" + 1 WHERE id = ${a.id}`, /result_check/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "cancellationReason" = 'reason text', "version" = "version" + 1 WHERE id = ${a.id}`, /cancellation_check/);
  });

  it("MIG-10 Action identity is immutable and versions increase by one", async () => {
    const a = await prisma.actionTaken.findFirstOrThrow({ orderBy: { id: "asc" } });
    const other = await prisma.ticket.findFirstOrThrow({ where: { id: { not: a.ticketId } } });
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "ticketId" = ${other.id}, "version" = "version" + 1 WHERE id = ${a.id}`, /immutable/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "createdAt" = now(), "version" = "version" + 1 WHERE id = ${a.id}`, /immutable/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "description" = 'edited' WHERE id = ${a.id}`, /version must increase/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "version" = "version" + 2 WHERE id = ${a.id}`, /version must increase/);
  });

  it("MIG-11 a projection-only write cannot commit without a matching revision", async () => {
    const a = await prisma.actionTaken.findFirstOrThrow({ where: { status: "PLANNED" } });
    await sqlRejects(
      () => prisma.$executeRaw`UPDATE "ActionTaken" SET "description" = 'sneaky edit', "version" = "version" + 1 WHERE id = ${a.id}`,
      /no matching revision/,
    );
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: a.id } })).description).toBe(a.description);
  });

  it("MIG-12 a revision whose snapshot differs from the Action never commits", async () => {
    const a = await prisma.actionTaken.findFirstOrThrow({ where: { status: "PLANNED" } });
    const mutationId = "00000000-0000-4000-8000-000000000001";
    const attempt = (immediate: boolean) =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "ActionTaken" SET "description" = 'honest edit', "version" = "version" + 1 WHERE id = ${a.id}`;
        await tx.actionTakenRevision.create({
          data: {
            actionId: a.id, version: a.version + 1, actorId: a.performedById, operation: "EDIT",
            mutationId, requestHash: "0".repeat(64), ticketUpdatedAt: new Date(),
            snapshot: { id: a.id, description: "different" },
          },
        });
        // Prisma 5 does not surface a deferred-trigger error raised by COMMIT itself.
        if (immediate) await tx.$executeRaw`SET CONSTRAINTS "ActionTaken_revision_check" IMMEDIATE`;
      });

    await expect(attempt(true)).rejects.toThrow(/no matching revision/);
    await attempt(false).catch(() => undefined);
    const after = await prisma.actionTaken.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.description).toBe(a.description);
    expect(after.version).toBe(a.version);
    expect(await prisma.actionTakenRevision.count({ where: { mutationId } })).toBe(0);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { seedLab3Data } from "../../prisma/seed.js";
import {
  emptyRequesterSeed,
  emptyStaffSeed,
  fixtureMarker,
  lab4TicketWhere,
  lab4Tickets,
  seedLab4Data,
} from "../../prisma/seedLab4.js";

const prisma = getPrisma();

describe("Lab 4 seed (DB-03)", () => {
  beforeAll(async () => {
    process.env.LAB3_SEED_INITIAL_PASSWORD = "Lab4SeedTestPassword123";
    await seedLab3Data(prisma);
    await seedLab4Data(prisma);
  });
  afterAll(async () => {
    delete process.env.LAB3_SEED_INITIAL_PASSWORD;
    await prisma.$disconnect();
  });

  it("DB-03a keeps Lab 3 tickets untouched: no invented history or resolution time", async () => {
    const legacy = await prisma.ticket.findMany({
      where: { NOT: lab4TicketWhere },
      include: { statusEvents: true },
    });
    expect(legacy.length).toBeGreaterThan(0);
    for (const ticket of legacy) {
      expect(ticket.lastResolvedAt).toBeNull();
      expect(ticket.statusEvents).toHaveLength(0);
    }
  });

  it("DB-03b a second run changes nothing: rows, hashes, timestamps, app edits (sequences: DB-02)", async () => {
    const read = async () => ({
      users: await prisma.user.findMany({ where: { email: { in: [emptyRequesterSeed.email, emptyStaffSeed.email] } }, select: { id: true, passwordHash: true, role: true, isActive: true, updatedAt: true }, orderBy: { id: "asc" } }),
      tickets: await prisma.ticket.findMany({ where: lab4TicketWhere, orderBy: { id: "asc" } }),
      actions: await prisma.actionTaken.findMany({ where: { ticket: lab4TicketWhere }, orderBy: { id: "asc" } }),
      revisions: await prisma.actionTakenRevision.findMany({ where: { action: { ticket: lab4TicketWhere } }, orderBy: { id: "asc" } }),
      events: await prisma.ticketStatusEvent.findMany({ where: { ticket: lab4TicketWhere }, orderBy: { id: "asc" } }),
    });
    const target = await prisma.ticket.findFirstOrThrow({ where: { description: { contains: fixtureMarker("910002") } } });
    const edited = await prisma.ticket.update({ where: { id: target.id }, data: { summary: "Edited by staff after seeding" } });
    const before = await read();
    const staffUser = before.users.find((u) => u.role === "IT_STAFF")!; // the fresh fixture user: no other suite edits it
    await prisma.user.update({ where: { id: staffUser.id }, data: { passwordHash: "scrypt$real$changed-by-user" } });
    const beforeWithHash = await read();

    await seedLab4Data(prisma);

    expect(await read()).toEqual(beforeWithHash);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: target.id } })).summary).toBe("Edited by staff after seeding");
    await prisma.user.update({ where: { id: staffUser.id }, data: { passwordHash: before.users.find((u) => u.id === staffUser.id)!.passwordHash } });
    await prisma.ticket.update({ where: { id: target.id }, data: { summary: target.summary, updatedAt: edited.updatedAt } });
  });

  it("DB-03h Action timestamps follow the status path (BR-13 history)", async () => {
    const tickets = await prisma.ticket.findMany({
      where: lab4TicketWhere,
      include: { actionsTaken: true, statusEvents: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    const now = Date.now();
    for (const t of tickets) {
      const resolvedAt = t.statusEvents.find((e) => e.toStatus === "RESOLVED")?.createdAt;
      const reopenedAt = t.statusEvents.find((e) => e.toStatus === "REOPENED")?.createdAt;
      for (const a of t.actionsTaken) {
        expect(a.actionAt.getTime()).toBeGreaterThanOrEqual(t.ticketDate.getTime());
        expect(a.actionAt.getTime()).toBeLessThanOrEqual(now);
        // Work that gates Resolved happens before it; only post-reopen work may follow it.
        if (resolvedAt && !reopenedAt) expect(a.actionAt.getTime()).toBeLessThan(resolvedAt.getTime());
        if (reopenedAt && a.status === "PLANNED") expect(a.actionAt.getTime()).toBeGreaterThan(reopenedAt.getTime());
      }
    }
  });

  it("DB-03i fixtures span the 7-day window and Ticket Numbers match their dates", async () => {
    // Window membership drifts as a reused database ages, so DB-02 checks it on a fresh seed.
    const resolvedAges = lab4Tickets.filter((t) => t.path.includes("RESOLVED")).map((t) => t.daysAgo ?? 5);
    expect(resolvedAges.some((d) => d < 7)).toBe(true);
    expect(resolvedAges.some((d) => d > 7)).toBe(true);
    for (const t of await prisma.ticket.findMany({ where: lab4TicketWhere })) {
      expect(t.ticketNumber.slice(4, 12)).toBe(t.ticketDate.toISOString().slice(0, 10).replaceAll("-", ""));
    }
  });

  it("DB-03c seed covers every status, priority, ownership and 0/1/many Actions", async () => {
    const tickets = await prisma.ticket.findMany({
      where: lab4TicketWhere,
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

  it("DB-03d resolved tickets satisfy the resolution gate and carry lastResolvedAt", async () => {
    const resolved = await prisma.ticket.findMany({
      where: { ...lab4TicketWhere, currentStatus: { in: ["RESOLVED", "CLOSED"] } },
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

  it("DB-03e status events follow the matrix and end at the current status", async () => {
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
      where: lab4TicketWhere,
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

  it("DB-03f every Action has one matching creation revision and a stable mutation id", async () => {
    const actions = await prisma.actionTaken.findMany({
      where: { ticket: lab4TicketWhere },
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

  it("DB-03g dashboard fixtures: a Requester and Staff user with no work", async () => {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: emptyRequesterSeed.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: emptyStaffSeed.email } });
    expect(await prisma.ticket.count({ where: { requesterId: requester.id } })).toBe(0);
    expect(await prisma.ticket.count({ where: { ownerId: staff.id } })).toBe(0);
    expect(await prisma.actionTaken.count({ where: { OR: [{ assigneeId: staff.id }, { performedById: staff.id }] } })).toBe(0);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { seedLab3Data } from "../../prisma/seed.js";

const prisma = getPrisma();

describe("Lab 3 seed", () => {
  beforeAll(async () => {
    await seedLab3Data(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds every role, active/inactive split, workflow data, and safe password state", async () => {
    const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
    expect(users.filter((user) => user.role === "REQUESTER" && user.isActive)).toHaveLength(4);
    expect(users.filter((user) => user.role === "REQUESTER" && !user.isActive)).toHaveLength(1);
    expect(users.filter((user) => user.role === "IT_STAFF" && user.isActive)).toHaveLength(3);
    expect(users.filter((user) => user.role === "IT_STAFF" && !user.isActive)).toHaveLength(1);
    expect(users.filter((user) => user.role === "ADMINISTRATOR" && user.isActive)).toHaveLength(1);
    expect(users.every((user) => user.passwordHash && !user.passwordHash.includes("LocalPassword123"))).toBe(true);

    expect(await prisma.ticket.count()).toBeGreaterThanOrEqual(2);
    expect(await prisma.publicComment.count()).toBeGreaterThanOrEqual(2);
    expect(await prisma.internalNote.count()).toBeGreaterThanOrEqual(2);
  });

  it("is safe to run repeatedly without creating duplicate seed records", async () => {
    const before = await Promise.all([
      prisma.user.count(),
      prisma.ticket.count(),
      prisma.publicComment.count(),
      prisma.internalNote.count(),
    ]);

    await seedLab3Data(prisma);
    await seedLab3Data(prisma);

    const after = await Promise.all([
      prisma.user.count(),
      prisma.ticket.count(),
      prisma.publicComment.count(),
      prisma.internalNote.count(),
    ]);
    expect(after).toEqual(before);
    expect(await prisma.ticket.findMany({ where: { ticketNumber: { in: ["TKT-20260919-900001", "TKT-20260919-900002"] } } })).toHaveLength(2);
  });
});

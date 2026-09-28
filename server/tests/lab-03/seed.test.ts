import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import {
  administratorSeed,
  requesterSeeds,
  seedLab3Data,
  staffSeeds,
} from "../../prisma/seed.js";

const prisma = getPrisma();
const seedPassword = "Lab3SeedTestPassword123";
const seedTicketNumbers = ["TKT-20260919-900001", "TKT-20260919-900002"];
const seedEmails = [
  ...requesterSeeds.map(({ email }) => email),
  ...staffSeeds.map(({ email }) => email),
  administratorSeed.email,
];

describe("Lab 3 seed", () => {
  beforeAll(async () => {
    process.env.LAB3_SEED_INITIAL_PASSWORD = seedPassword;
    await seedLab3Data(prisma);
  });

  afterAll(async () => {
    delete process.env.LAB3_SEED_INITIAL_PASSWORD;
    await prisma.$disconnect();
  });

  it("seeds every role, active/inactive split, workflow data, and safe password state", async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: seedEmails } },
      orderBy: { id: "asc" },
    });
    expect(users.filter((user) => user.role === "REQUESTER" && user.isActive)).toHaveLength(4);
    expect(users.filter((user) => user.role === "REQUESTER" && !user.isActive)).toHaveLength(1);
    expect(users.filter((user) => user.role === "IT_STAFF" && user.isActive)).toHaveLength(3);
    expect(users.filter((user) => user.role === "IT_STAFF" && !user.isActive)).toHaveLength(1);
    expect(users.filter((user) => user.role === "ADMINISTRATOR" && user.isActive)).toHaveLength(1);
    expect(users.every((user) => /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(user.passwordHash))).toBe(true);
    expect(new Set(users.map(({ passwordHash }) => passwordHash)).size).toBe(users.length);

    expect(await prisma.ticket.count({ where: { ticketNumber: { in: seedTicketNumbers } } })).toBe(2);
    expect(await prisma.publicComment.count({ where: { ticket: { ticketNumber: { in: seedTicketNumbers } } } })).toBe(2);
    expect(await prisma.internalNote.count({ where: { ticket: { ticketNumber: { in: seedTicketNumbers } } } })).toBe(2);
  });

  it("is safe to run repeatedly without creating duplicate seed records", async () => {
    const seededCounts = async () => {
      const tickets = await prisma.ticket.findMany({
        where: { ticketNumber: { in: seedTicketNumbers } },
        select: { id: true },
      });
      const ticketIds = tickets.map(({ id }) => id);
      return Promise.all([
        prisma.user.count({ where: { email: { in: seedEmails } } }),
        prisma.ticket.count({ where: { id: { in: ticketIds } } }),
        prisma.publicComment.count({ where: { ticketId: { in: ticketIds } } }),
        prisma.internalNote.count({ where: { ticketId: { in: ticketIds } } }),
      ]);
    };

    const before = await seededCounts();

    await seedLab3Data(prisma);
    await seedLab3Data(prisma);

    const after = await seededCounts();
    expect(after).toEqual(before);
    expect(await prisma.ticket.findMany({ where: { ticketNumber: { in: seedTicketNumbers } } })).toHaveLength(2);
  });
});

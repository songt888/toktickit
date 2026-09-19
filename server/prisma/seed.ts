import type { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import { getPrisma } from "../src/prisma.js";
import {
  hashPassword,
  MIGRATION_PLACEHOLDER_HASH,
} from "../src/password.js";
import {
  categoryNames,
  inactiveCategoryNames,
  seedCategories,
  seedInactiveCategories,
} from "../src/categorySeed.js";

export const relatedSystemNames = [
  "Email and Collaboration",
  "Network and Internet",
  "Laptop and Desktop",
  "Printer and Peripheral",
  "Business Application",
  "Identity and Access",
] as const;

export const inactiveRelatedSystemNames = ["Legacy System"] as const;

export const requesterSeeds = [
  { name: "Ari Suksan", email: "ari.suksan@example.com", isActive: true },
  { name: "Ben Chaiyo", email: "ben.chaiyo@example.com", isActive: true },
  { name: "Mali Prasert", email: "mali.prasert@example.com", isActive: true },
  { name: "Narin Wattan", email: "narin.wattan@example.com", isActive: true },
  { name: "Ploy Inactive", email: "ploy.inactive@example.com", isActive: false },
] as const;

export const staffSeeds = [
  { name: "Nattakit Support", email: "nattakit.support@example.com", isActive: true },
  { name: "Suda Service Desk", email: "suda.servicedesk@example.com", isActive: true },
  { name: "Korn Infrastructure", email: "korn.infrastructure@example.com", isActive: true },
  { name: "Mek Inactive Staff", email: "mek.inactive@example.com", isActive: false },
] as const;

export const administratorSeed = {
  name: "Lab Administrator",
  email: "lab.admin@example.com",
  isActive: true,
} as const;

type ReferenceSeedClient = Pick<PrismaClient, "category" | "relatedSystem" | "user">;
type Lab3SeedClient = ReferenceSeedClient &
  Pick<PrismaClient, "ticket" | "publicComment" | "internalNote">;

function configuredInitialPassword(): string | undefined {
  const password = process.env.LAB3_SEED_INITIAL_PASSWORD?.trim();
  return password || undefined;
}

async function upsertUser(
  database: ReferenceSeedClient,
  seed: { name: string; email: string; isActive: boolean },
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR",
  initialPassword: string | undefined,
) {
  const email = seed.email.trim().toLowerCase();
  const existing = await database.user.findUnique({ where: { email } });
  const resetInitialPassword = existing?.passwordHash === MIGRATION_PLACEHOLDER_HASH;

  if (existing) {
    return database.user.update({
      where: { id: existing.id },
      data: {
        name: seed.name,
        role,
        isActive: seed.isActive,
        ...(resetInitialPassword
          ? {
              passwordHash: initialPassword
                ? hashPassword(initialPassword)
                : MIGRATION_PLACEHOLDER_HASH,
              mustChangePassword: true,
              passwordChangedAt: null,
            }
          : {}),
      },
    });
  }

  return database.user.create({
    data: {
      name: seed.name,
      email,
      role,
      isActive: seed.isActive,
      passwordHash: initialPassword
        ? hashPassword(initialPassword)
        : MIGRATION_PLACEHOLDER_HASH,
      mustChangePassword: true,
    },
  });
}

// Lab 2 reference data remains a separate helper so the existing Lab 2 tests
// can seed only requester fixtures while the application seed adds Lab 3 data.
export async function seedLab2Data(database: ReferenceSeedClient) {
  await seedCategories(database);
  await seedInactiveCategories(database);

  for (const name of relatedSystemNames) {
    await database.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const name of inactiveRelatedSystemNames) {
    await database.relatedSystem.upsert({
      where: { name },
      update: { isActive: false },
      create: { name, isActive: false },
    });
  }

  const initialPassword = configuredInitialPassword();
  for (const requester of requesterSeeds) {
    await upsertUser(database, requester, "REQUESTER", initialPassword);
  }

  console.log(
    `Seeded ${categoryNames.length + inactiveCategoryNames.length} categories, ${relatedSystemNames.length + inactiveRelatedSystemNames.length} related systems, and ${requesterSeeds.length} requesters.`,
  );
}

async function upsertLab3Users(database: ReferenceSeedClient) {
  const initialPassword = configuredInitialPassword();
  for (const staff of staffSeeds) {
    await upsertUser(database, staff, "IT_STAFF", initialPassword);
  }
  await upsertUser(database, administratorSeed, "ADMINISTRATOR", initialPassword);
}

async function upsertTicket(
  database: Lab3SeedClient,
  input: {
    ticketNumber: string;
    requesterId: number;
    ownerId: number | null;
    categoryId: number;
    relatedSystemId: number;
    summary: string;
    description: string;
    requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    currentStatus: "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
    problemAppearsResolved?: boolean;
  },
) {
  return database.ticket.upsert({
    where: { ticketNumber: input.ticketNumber },
    update: {
      requesterId: input.requesterId,
      ownerId: input.ownerId,
      categoryId: input.categoryId,
      relatedSystemId: input.relatedSystemId,
      summary: input.summary,
      description: input.description,
      requestedPriority: input.requestedPriority,
      itPriority: input.requestedPriority,
      currentStatus: input.currentStatus,
      problemAppearsResolved: input.problemAppearsResolved ?? false,
    },
    create: {
      ticketNumber: input.ticketNumber,
      requesterId: input.requesterId,
      ownerId: input.ownerId,
      categoryId: input.categoryId,
      relatedSystemId: input.relatedSystemId,
      summary: input.summary,
      description: input.description,
      requestedPriority: input.requestedPriority,
      itPriority: input.requestedPriority,
      currentStatus: input.currentStatus,
      problemAppearsResolved: input.problemAppearsResolved ?? false,
    },
  });
}

async function ensureComment(
  database: Lab3SeedClient,
  ticketId: number,
  authorId: number,
  content: string,
) {
  const existing = await database.publicComment.findFirst({
    where: { ticketId, authorId, content },
  });
  if (existing) return existing;
  return database.publicComment.create({ data: { ticketId, authorId, content } });
}

async function ensureInternalNote(
  database: Lab3SeedClient,
  ticketId: number,
  authorId: number,
  content: string,
) {
  const existing = await database.internalNote.findFirst({
    where: { ticketId, authorId, content },
  });
  if (existing) return existing;
  return database.internalNote.create({ data: { ticketId, authorId, content } });
}

export async function seedLab3Data(database: Lab3SeedClient) {
  await seedLab2Data(database);
  await upsertLab3Users(database);

  const [ari, ben, staff, admin, category, system] = await Promise.all([
    database.user.findUnique({ where: { email: "ari.suksan@example.com" } }),
    database.user.findUnique({ where: { email: "ben.chaiyo@example.com" } }),
    database.user.findUnique({ where: { email: "nattakit.support@example.com" } }),
    database.user.findUnique({ where: { email: "lab.admin@example.com" } }),
    database.category.findFirst({ where: { name: "Hardware" } }),
    database.relatedSystem.findFirst({ where: { name: "Laptop and Desktop" } }),
  ]);

  if (!ari || !ben || !staff || !admin || !category || !system) {
    throw new Error("Lab 3 seed references are missing");
  }

  const firstTicket = await upsertTicket(database, {
    ticketNumber: "TKT-20260919-900001",
    requesterId: ari.id,
    ownerId: staff.id,
    categoryId: category.id,
    relatedSystemId: system.id,
    summary: "Laptop battery drains quickly",
    description: "The battery falls below 20 percent after a short session.",
    requestedPriority: "HIGH",
    currentStatus: "IN_PROGRESS",
  });
  const secondTicket = await upsertTicket(database, {
    ticketNumber: "TKT-20260919-900002",
    requesterId: ben.id,
    ownerId: null,
    categoryId: category.id,
    relatedSystemId: system.id,
    summary: "External monitor is not detected",
    description: "The monitor is connected but does not appear in display settings.",
    requestedPriority: "MEDIUM",
    currentStatus: "NEW",
    problemAppearsResolved: true,
  });

  await ensureComment(database, firstTicket.id, ari.id, "The issue started after the latest update.");
  await ensureComment(database, secondTicket.id, ben.id, "I can reproduce this after reconnecting the cable.");
  await ensureInternalNote(database, firstTicket.id, staff.id, "Checked device inventory; replacement is available.");
  await ensureInternalNote(database, secondTicket.id, admin.id, "Seeded operational note for staff review.");

  console.log("Seeded Lab 3 users, realistic tickets, comments, and internal notes.");
}

async function main() {
  await seedLab3Data(getPrisma());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await getPrisma().$disconnect();
    });
}

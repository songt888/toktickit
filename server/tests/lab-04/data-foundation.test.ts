import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { seedLab3Data } from "../../prisma/seed.js";
import { seedLab4Data } from "../../prisma/seedLab4.js";

const prisma = getPrisma();

async function sqlRejects(run: () => Promise<unknown>, message: RegExp) {
  await expect(run()).rejects.toThrow(message);
}

describe("Lab 4 database guards (DB-01)", () => {
  beforeAll(async () => {
    process.env.LAB3_SEED_INITIAL_PASSWORD = "Lab4SeedTestPassword123";
    await seedLab3Data(prisma);
    await seedLab4Data(prisma);
  });
  afterAll(async () => {
    delete process.env.LAB3_SEED_INITIAL_PASSWORD;
    await prisma.$disconnect();
  });

  it("DB-01a revisions and status events are append-only, even through raw SQL", async () => {
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTakenRevision" SET "requestHash" = repeat('0', 64)`, /append-only/);
    await sqlRejects(() => prisma.$executeRaw`DELETE FROM "ActionTakenRevision"`, /append-only/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "TicketStatusEvent" SET "toStatus" = 'NEW'`, /append-only/);
    await sqlRejects(() => prisma.$executeRaw`DELETE FROM "TicketStatusEvent"`, /append-only/);
  });

  it("DB-01b database checks reject invalid Action rows", async () => {
    const a = await prisma.actionTaken.findFirstOrThrow({ where: { status: "COMPLETED", followUpRequired: false } });
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "description" = '  ', "version" = "version" + 1 WHERE id = ${a.id}`, /description_check/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "followUpRequired" = true, "version" = "version" + 1 WHERE id = ${a.id}`, /followUp_check/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "followUpNote" = 'x', "version" = "version" + 1 WHERE id = ${a.id}`, /followUp_check/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "result" = '', "version" = "version" + 1 WHERE id = ${a.id}`, /result_check/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "cancellationReason" = 'reason text', "version" = "version" + 1 WHERE id = ${a.id}`, /cancellation_check/);
  });

  it("DB-01c Action identity is immutable and versions increase by one", async () => {
    const a = await prisma.actionTaken.findFirstOrThrow({ orderBy: { id: "asc" } });
    const other = await prisma.ticket.findFirstOrThrow({ where: { id: { not: a.ticketId } } });
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "ticketId" = ${other.id}, "version" = "version" + 1 WHERE id = ${a.id}`, /immutable/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "createdAt" = now(), "version" = "version" + 1 WHERE id = ${a.id}`, /immutable/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "description" = 'edited' WHERE id = ${a.id}`, /version must increase/);
    await sqlRejects(() => prisma.$executeRaw`UPDATE "ActionTaken" SET "version" = "version" + 2 WHERE id = ${a.id}`, /version must increase/);
  });

  it("DB-01d a projection-only write cannot commit without a matching revision", async () => {
    const a = await prisma.actionTaken.findFirstOrThrow({ where: { status: "PLANNED" } });
    await sqlRejects(
      () => prisma.$executeRaw`UPDATE "ActionTaken" SET "description" = 'sneaky edit', "version" = "version" + 1 WHERE id = ${a.id}`,
      /no matching revision/,
    );
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: a.id } })).description).toBe(a.description);
  });

  it("DB-01e a revision whose snapshot differs from the Action never commits", async () => {
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

  it("DB-01f foreign keys and unique versions or mutation ids reject bad rows", async () => {
    const a = await prisma.actionTaken.findFirstOrThrow({ orderBy: { id: "asc" } });
    const rev = await prisma.actionTakenRevision.findFirstOrThrow({ where: { actionId: a.id } });
    await sqlRejects(
      () => prisma.$executeRaw`INSERT INTO "ActionTaken" ("ticketId","performedById","assigneeId","actionAt","description","updatedAt") VALUES (-1, ${a.performedById}, ${a.assigneeId}, now(), 'x', now())`,
      /foreign key/i,
    );
    await sqlRejects(
      () => prisma.$executeRaw`INSERT INTO "ActionTakenRevision" ("actionId","version","actorId","operation","mutationId","requestHash","snapshot","ticketUpdatedAt") VALUES (${a.id}, ${rev.version}, ${a.performedById}, 'EDIT', '00000000-0000-4000-8000-0000000000aa', repeat('0',64), '{}', now())`,
      /already exists/i,
    );
    await sqlRejects(
      () => prisma.$executeRaw`INSERT INTO "ActionTakenRevision" ("actionId","version","actorId","operation","mutationId","requestHash","snapshot","ticketUpdatedAt") VALUES (${a.id}, ${rev.version + 1}, ${rev.actorId}, 'EDIT', ${rev.mutationId}::uuid, repeat('0',64), '{}', now())`,
      /already exists/i,
    );
  });
});

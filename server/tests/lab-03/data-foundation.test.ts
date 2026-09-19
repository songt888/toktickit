import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { seedLab3Data } from "../../prisma/seed.js";

const prisma = getPrisma();
let preservationAttachmentId: number | undefined;

describe("Lab 3 database foundation", () => {
  beforeAll(async () => {
    process.env.LAB3_SEED_INITIAL_PASSWORD = "Lab3PreserveTestPassword123";
    await seedLab3Data(prisma);
  });

  afterAll(async () => {
    if (preservationAttachmentId) {
      await prisma.attachment.delete({ where: { id: preservationAttachmentId } });
    }
    delete process.env.LAB3_SEED_INITIAL_PASSWORD;
    await prisma.$disconnect();
  });

  it("creates the role-based user model and preserves ticket data structures", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'User', 'Category', 'RelatedSystem', 'Ticket', 'Attachment',
          'PublicComment', 'InternalNote', 'AuthSession'
        )
      ORDER BY table_name
    `;

    expect(tables.map(({ table_name }) => table_name)).toEqual([
      "Attachment",
      "AuthSession",
      "Category",
      "InternalNote",
      "PublicComment",
      "RelatedSystem",
      "Ticket",
      "User",
    ]);

    const columns = await prisma.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'User' AND column_name IN ('email', 'passwordHash', 'role', 'isActive', 'mustChangePassword'))
          OR (table_name = 'Ticket' AND column_name IN ('requesterId', 'ownerId', 'itPriority', 'currentStatus', 'problemAppearsResolved', 'problemAppearsResolvedAt'))
          OR (table_name = 'PublicComment' AND column_name IN ('ticketId', 'authorId', 'content'))
          OR (table_name = 'InternalNote' AND column_name IN ('ticketId', 'authorId', 'content'))
          OR (table_name = 'AuthSession' AND column_name IN ('userId', 'tokenHash', 'expiresAt', 'revokedAt'))
        )
      ORDER BY table_name, column_name
    `;

    expect(columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`)).toEqual([
      "AuthSession.expiresAt",
      "AuthSession.revokedAt",
      "AuthSession.tokenHash",
      "AuthSession.userId",
      "InternalNote.authorId",
      "InternalNote.content",
      "InternalNote.ticketId",
      "PublicComment.authorId",
      "PublicComment.content",
      "PublicComment.ticketId",
      "Ticket.currentStatus",
      "Ticket.itPriority",
      "Ticket.ownerId",
      "Ticket.problemAppearsResolved",
      "Ticket.problemAppearsResolvedAt",
      "Ticket.requesterId",
      "User.email",
      "User.isActive",
      "User.mustChangePassword",
      "User.passwordHash",
      "User.role",
    ]);

    const uniqueIndexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'User_email_key', 'Ticket_ticketNumber_key',
          'Attachment_storedName_key', 'AuthSession_tokenHash_key'
        )
      ORDER BY indexname
    `;

    expect(uniqueIndexes.map(({ indexname }) => indexname)).toEqual([
      "Attachment_storedName_key",
      "AuthSession_tokenHash_key",
      "Ticket_ticketNumber_key",
      "User_email_key",
    ]);

    const legacyIndexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'Ticket_requesterId_categoryId_idx',
          'Ticket_requesterId_currentStatus_idx',
          'Ticket_requesterId_requestedPriority_idx'
        )
      ORDER BY indexname
    `;
    expect(legacyIndexes).toEqual([]);

    const constraints = await prisma.$queryRaw<
      Array<{ conname: string; definition: string }>
    >`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname IN ('User_pkey', 'AuthSession_userId_fkey')
      ORDER BY conname
    `;
    expect(constraints).toEqual([
      {
        conname: "AuthSession_userId_fkey",
        definition: 'FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE RESTRICT',
      },
      {
        conname: "User_pkey",
        definition: "PRIMARY KEY (id)",
      },
    ]);

    const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname
      FROM pg_type
      WHERE typname IN ('UserRole', 'TicketPriority', 'TicketStatus')
      ORDER BY typname
    `;
    expect(enums.map(({ typname }) => typname)).toEqual([
      "TicketPriority",
      "TicketStatus",
      "UserRole",
    ]);

    const sequences = await prisma.$queryRaw<Array<{ relname: string }>>`
      SELECT relname
      FROM pg_class
      WHERE relkind = 'S' AND relname = 'ticket_number_seq'
    `;
    expect(sequences).toEqual([{ relname: "ticket_number_seq" }]);
  });

  it("preserves seeded user IDs, ticket ownership, attachments, and real hashes across reseeding", async () => {
    const ari = await prisma.user.findUnique({
      where: { email: "ari.suksan@example.com" },
      select: { id: true, passwordHash: true },
    });
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: "TKT-20260919-900001" },
      select: { id: true, requesterId: true, ownerId: true },
    });
    if (!ari || !ticket) throw new Error("Lab 3 preservation fixtures are missing");
    expect(ari.passwordHash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);

    const attachment = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        originalName: "preservation-fixture.png",
        storedName: `lab3-preservation-${Date.now()}.png`,
        mimeType: "image/png",
        sizeBytes: 128,
      },
    });
    preservationAttachmentId = attachment.id;

    await seedLab3Data(prisma);

    const [preservedUser, preservedTicket, preservedAttachment] = await Promise.all([
      prisma.user.findUnique({
        where: { email: "ari.suksan@example.com" },
        select: { id: true, passwordHash: true },
      }),
      prisma.ticket.findUnique({
        where: { ticketNumber: "TKT-20260919-900001" },
        select: { id: true, requesterId: true, ownerId: true },
      }),
      prisma.attachment.findUnique({ where: { id: attachment.id }, select: { id: true, ticketId: true } }),
    ]);

    expect(preservedUser).toEqual(ari);
    expect(preservedTicket).toEqual(ticket);
    expect(preservedAttachment).toEqual({ id: attachment.id, ticketId: ticket.id });
  });
});

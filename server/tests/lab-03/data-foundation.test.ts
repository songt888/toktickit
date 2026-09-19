import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

describe("Lab 3 database foundation", () => {
  afterAll(async () => {
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
});

import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

describe("Lab 2 database foundation", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates the required tables, columns, unique constraints, and ticket sequence", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('Category', 'User', 'RelatedSystem', 'Ticket', 'Attachment')
      ORDER BY table_name
    `;

    expect(tables.map(({ table_name }) => table_name)).toEqual([
      "Attachment",
      "Category",
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
          (table_name = 'Category' AND column_name IN ('isActive', 'updatedAt'))
          OR (table_name = 'User' AND column_name IN ('email', 'isActive'))
          OR (table_name = 'RelatedSystem' AND column_name IN ('isActive'))
          OR (table_name = 'Ticket' AND column_name IN ('ticketNumber', 'currentStatus', 'requesterId', 'categoryId', 'relatedSystemId'))
          OR (table_name = 'Attachment' AND column_name IN ('storedName', 'removedAt', 'removalReason'))
        )
      ORDER BY table_name, column_name
    `;

    const columnKeys = columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`);
    expect(columnKeys).toEqual([
      "Attachment.removalReason",
      "Attachment.removedAt",
      "Attachment.storedName",
      "Category.isActive",
      "Category.updatedAt",
      "RelatedSystem.isActive",
      "Ticket.categoryId",
      "Ticket.currentStatus",
      "Ticket.relatedSystemId",
      "Ticket.requesterId",
      "Ticket.ticketNumber",
      "User.email",
      "User.isActive",
    ]);

    const uniqueIndexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('User_email_key', 'Ticket_ticketNumber_key', 'Attachment_storedName_key')
      ORDER BY indexname
    `;

    expect(uniqueIndexes.map(({ indexname }) => indexname)).toEqual([
      "Attachment_storedName_key",
      "Ticket_ticketNumber_key",
      "User_email_key",
    ]);

    const sequences = await prisma.$queryRaw<Array<{ relname: string }>>`
      SELECT relname
      FROM pg_class
      WHERE relkind = 'S' AND relname = 'ticket_number_seq'
    `;

    expect(sequences).toEqual([{ relname: "ticket_number_seq" }]);
  });
});

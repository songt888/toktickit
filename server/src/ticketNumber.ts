import type { Prisma } from "@prisma/client";

export function formatTicketNumber(sequenceValue: bigint | number, date: Date): string {
  const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = String(sequenceValue).padStart(6, "0");
  return `TKT-${datePart}-${suffix}`;
}

export async function getNextTicketNumber(
  database: Prisma.TransactionClient,
  date = new Date(),
): Promise<string> {
  const rows = await database.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('ticket_number_seq') AS value
  `;

  const sequenceValue = rows[0]?.value;
  if (sequenceValue === undefined) {
    throw new Error("Ticket number sequence returned no value");
  }

  return formatTicketNumber(sequenceValue, date);
}

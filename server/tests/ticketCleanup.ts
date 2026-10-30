import type { Prisma } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";

// Lab 4 made status events append-only, so earlier suites remove their own fixture Tickets'
// events with triggers bypassed (needs a superuser such as the local Docker role); the Tickets
// themselves are then deleted normally, with foreign keys still enforced.
export async function deleteTestTickets(where: Prisma.TicketWhereInput) {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
    await tx.ticketStatusEvent.deleteMany({ where: { ticket: where } });
  });
  await prisma.ticket.deleteMany({ where });
}

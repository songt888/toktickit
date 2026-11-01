import type { TicketStatus } from "@prisma/client";

// Independent copy of the approved matrix (specification BR-12), not the code's own table.
export const allowed = new Set([
  "NEW>OPEN", "NEW>IN_PROGRESS", "NEW>CANCELLED",
  "OPEN>IN_PROGRESS", "OPEN>WAITING_FOR_REQUESTER", "OPEN>CANCELLED",
  "IN_PROGRESS>WAITING_FOR_REQUESTER", "IN_PROGRESS>RESOLVED", "IN_PROGRESS>CANCELLED",
  "WAITING_FOR_REQUESTER>IN_PROGRESS", "WAITING_FOR_REQUESTER>REOPENED", "WAITING_FOR_REQUESTER>CANCELLED",
  "RESOLVED>CLOSED", "RESOLVED>REOPENED",
  "CLOSED>REOPENED",
  "REOPENED>IN_PROGRESS", "REOPENED>WAITING_FOR_REQUESTER", "REOPENED>CANCELLED",
  "CANCELLED>REOPENED",
]);
export const ticketStatuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
export const isAllowed = (from: TicketStatus, to: TicketStatus) => allowed.has(`${from}>${to}`);

import type { TicketStatus } from "@prisma/client";

export const permittedStatusTransitions: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "REOPENED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  CANCELLED: ["REOPENED"],
};

export function isPermittedStatusTransition(
  current: TicketStatus,
  next: TicketStatus,
): boolean {
  return permittedStatusTransitions[current].includes(next);
}

export function statusTransitionNeedsConfirmation(status: TicketStatus): boolean {
  return status === "CLOSED" || status === "CANCELLED";
}

import type { TicketStatus } from "./api.js";

// One badge colour per Ticket status on every screen; the status text is always shown too.
export function statusBadgeClass(status: TicketStatus): string {
  switch (status) {
    case "NEW": return "bg-success-subtle text-success-emphasis border border-success-subtle";
    case "IN_PROGRESS": return "text-bg-warning text-dark";
    case "RESOLVED": return "text-bg-success";
    case "CLOSED": return "text-bg-dark";
    case "CANCELLED": return "text-bg-danger";
    default: return "text-bg-secondary";
  }
}

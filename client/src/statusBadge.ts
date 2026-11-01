import type { TicketPriority, TicketStatus } from "./api.js";

// One badge per Ticket status on every screen (all eight differ); the status text is always shown too.
export function statusBadgeClass(status: TicketStatus): string {
  switch (status) {
    case "NEW": return "bg-success-subtle text-success-emphasis border border-success-subtle";
    case "OPEN": return "bg-info-subtle text-info-emphasis border border-info-subtle";
    case "IN_PROGRESS": return "text-bg-warning text-dark";
    case "WAITING_FOR_REQUESTER": return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
    case "RESOLVED": return "text-bg-success";
    case "CLOSED": return "text-bg-dark";
    case "REOPENED": return "bg-danger-subtle text-danger-emphasis border border-danger-subtle";
    case "CANCELLED": return "text-bg-danger";
  }
}

// One badge per priority, for both Requested and IT priority, on every screen.
export function priorityBadgeClass(priority: TicketPriority): string {
  switch (priority) {
    case "LOW": return "text-bg-secondary";
    case "MEDIUM": return "text-bg-info";
    case "HIGH": return "text-bg-warning text-dark";
    case "URGENT": return "text-bg-danger";
  }
}

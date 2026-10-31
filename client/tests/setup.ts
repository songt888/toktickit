import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";
import * as api from "../src/api.js";

// Both Ticket Detail screens now load Actions Taken; earlier-lab tests don't care, so default to an empty list.
beforeEach(() => {
  vi.spyOn(api, "getActionsTaken").mockResolvedValue({
    items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 }, ticketUpdatedAt: "2026-10-30T00:00:00.000Z",
  });
});

beforeEach(() => {
  vi.spyOn(api, "getRequesterDashboard").mockResolvedValue({
    asOf: "2026-10-30T00:00:00.000Z", recentFrom: "2026-10-23T00:00:00.000Z", displayTimeZone: "Asia/Bangkok",
    metrics: { openTickets: 0, waitingForRequester: 0, recentlyResolved: 0 }, recentTickets: [],
  });
});

beforeEach(() => {
  const zero = { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 };
  vi.spyOn(api, "getStaffDashboard").mockResolvedValue({
    asOf: "2026-10-30T00:00:00.000Z", recentFrom: "2026-10-23T00:00:00.000Z", displayTimeZone: "Asia/Bangkok",
    metrics: { unassignedTickets: 0, myTickets: 0, myActions: 0, byStatus: zero, byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 } },
    myActions: [], recentTickets: [], urgentTickets: [],
  });
});

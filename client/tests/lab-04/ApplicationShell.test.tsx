import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { action, list, mockList } from "./actionFixtures.js";

afterEach(() => vi.restoreAllMocks());

const asOf = "2026-10-30T05:00:00.000Z";
const recentFrom = "2026-10-23T05:00:00.000Z";
const recent: api.DashboardTicket = {
  id: 801, ticketNumber: "TKT-20261030-000801", summary: "Printer offline", currentStatus: "WAITING_FOR_REQUESTER",
  itPriority: "HIGH", owner: null, updatedAt: "2026-10-30T04:00:00.000Z", lastResolvedAt: null,
};
const snapshot = (): api.RequesterDashboardData => ({
  asOf, recentFrom, displayTimeZone: "Asia/Bangkok",
  metrics: { openTickets: 3, waitingForRequester: 1, recentlyResolved: 0 }, recentTickets: [recent],
});

describe("Requester application shell with the Dashboard (UI-07 Requester part, UI-05 drill-down)", () => {
  function mockRequesterApp() {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      user: { id: 41, name: "Ari Suksan", email: "ari@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false },
      requiresPasswordChange: false,
    });
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Printing" }]);
    vi.spyOn(api, "getRequesterDashboard").mockResolvedValue(snapshot());
    return vi.spyOn(api, "getMyTickets").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } });
  }

  it("starts on the Dashboard, opens My Tickets with the exact card filter, and clears it on request", async () => {
    const myTickets = mockRequesterApp();
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    for (const name of ["My Tickets", "Create Ticket"]) expect(screen.getByRole("link", { name })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "View Recently Resolved in My Tickets" }));
    expect(await screen.findByText("Recently Resolved (last 7 days)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(myTickets).toHaveBeenLastCalledWith(expect.objectContaining({ statusGroup: "resolved", resolvedFrom: recentFrom, resolvedTo: asOf, page: 1 })));
    expect(screen.getByText("No tickets match your search or filters.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Dashboard filter" }));
    await waitFor(() => expect(myTickets.mock.lastCall![0]).not.toHaveProperty("statusGroup"));
    expect(screen.queryByText("Showing Dashboard filter:", { exact: false })).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Dashboard" }));
    await user.click(await screen.findByRole("button", { name: "View Waiting for You in My Tickets" }));
    expect(await screen.findByRole("combobox", { name: "Status" })).toHaveValue("WAITING_FOR_REQUESTER");
    await waitFor(() => expect(myTickets).toHaveBeenLastCalledWith(expect.objectContaining({ currentStatus: "WAITING_FOR_REQUESTER" })));
  });

  it("returns from a Ticket opened on the Dashboard to the Dashboard, with Dashboard still active", async () => {
    mockRequesterApp();
    vi.spyOn(api, "getTicketDetail").mockResolvedValue({
      id: 801, ticketNumber: recent.ticketNumber, ticketDate: "2026-10-30T01:00:00.000Z", requesterId: 41, categoryId: 1, relatedSystemId: 2,
      summary: recent.summary, description: "The printer does not respond.", requestedPriority: "MEDIUM", currentStatus: "WAITING_FOR_REQUESTER",
      problemAppearsResolved: false, problemAppearsResolvedAt: null, requester: { id: 41, name: "Ari Suksan", email: "ari@example.com" },
      category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Printing" }, createdAt: "2026-10-30T01:00:00.000Z",
      updatedAt: recent.updatedAt, attachments: [],
    });
    vi.spyOn(api, "getTicketComments").mockResolvedValue([]);
    vi.spyOn(api, "getTicketAttachments").mockResolvedValue([]);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: `Open Detail for ${recent.ticketNumber}` }));
    expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My Tickets" })).not.toHaveAttribute("aria-current");
    await user.click(screen.getByRole("button", { name: "Back to Dashboard" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

    // Opening from My Tickets still returns to My Tickets.
    vi.spyOn(api, "getMyTickets").mockResolvedValue({
      items: [{ id: 801, ticketNumber: recent.ticketNumber, ticketDate: "2026-10-30T01:00:00.000Z", summary: recent.summary, requestedPriority: "MEDIUM",
        currentStatus: "WAITING_FOR_REQUESTER", updatedAt: recent.updatedAt, category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Printing" } }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    await user.click(screen.getByRole("link", { name: "My Tickets" }));
    await user.click((await screen.findAllByRole("button", { name: "View details" }))[0]);
    await user.click(await screen.findByRole("button", { name: "Back to My Tickets" }));
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
  });
});

describe("Staff and Administrator application shell with the Dashboard (UI-07 Staff/Admin part, UI-06 drill-down)", () => {
  const zero = { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 };
  const staffSnapshot = (): api.StaffDashboardData => ({
    asOf, recentFrom, displayTimeZone: "Asia/Bangkok",
    metrics: { unassignedTickets: 4, myTickets: 2, myActions: 1, byStatus: { ...zero, OPEN: 6 }, byItPriority: { LOW: 0, MEDIUM: 6, HIGH: 0, URGENT: 0 } },
    myActions: [{ id: 501, ticketId: 701, ticketNumber: "TKT-20260924-900701", description: "Replace the toner", status: "PLANNED", updatedAt: "2026-10-30T03:00:00.000Z" }],
    recentTickets: [], urgentTickets: [],
  });
  const detail: api.StaffTicketDetailData = {
    id: 701, ticketNumber: "TKT-20260924-900701", ticketDate: "2026-09-24T01:00:00.000Z", requesterId: 41, categoryId: 1, relatedSystemId: 2,
    ownerId: 31, summary: "VPN is unavailable", description: "The client cannot reach the campus VPN.", requestedPriority: "HIGH", itPriority: "MEDIUM",
    currentStatus: "OPEN", updatedAt: "2026-10-30T02:00:00.000Z", createdAt: "2026-09-24T01:00:00.000Z", problemAppearsResolved: false,
    problemAppearsResolvedAt: null, requester: { id: 41, name: "Ari Suksan", email: "ari@example.com" }, owner: { id: 31, name: "Nattakit Support", email: "nattakit@example.com", role: "IT_STAFF" },
    category: { id: 1, name: "Network" }, relatedSystem: { id: 2, name: "Campus VPN" }, attachments: [], publicComments: [], internalNotes: [],
  };

  function mockStaffApp(role: "IT_STAFF" | "ADMINISTRATOR" = "IT_STAFF") {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      user: { id: 31, name: "Nattakit Support", email: "nattakit@example.com", role, isActive: true, mustChangePassword: false },
      requiresPasswordChange: false,
    });
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
    vi.spyOn(api, "getAdminUsers").mockResolvedValue([]);
    vi.spyOn(api, "getStaffDashboard").mockResolvedValue(staffSnapshot());
    vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue(detail);
    vi.spyOn(api, "getStaffAssignees").mockResolvedValue([]);
    mockList(list([action({ id: 501, ticketId: 701, description: "Replace the toner" })]));
    return vi.spyOn(api, "getStaffTickets").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } });
  }

  it("starts on the Dashboard and opens the Queue with the exact card filter, owner preselected, until cleared", async () => {
    const queue = mockStaffApp();
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "My Tickets" })).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "View Unassigned Tickets in the Ticket Queue" }));
    expect(await screen.findByText("Unassigned active Tickets")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("combobox", { name: "Owner" })).toHaveValue("unassigned");
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(expect.objectContaining({ statusGroup: "active", ownerId: "unassigned", page: 1 })));

    await user.click(screen.getByRole("button", { name: "Clear Dashboard filter" }));
    await waitFor(() => expect(queue.mock.lastCall![0]).not.toHaveProperty("statusGroup"));
    expect(screen.queryByText("Showing Dashboard filter:", { exact: false })).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Dashboard" }));
    await user.click(await screen.findByRole("button", { name: "View My Tickets in the Ticket Queue" }));
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(expect.objectContaining({ statusGroup: "active", ownerId: 31 })));
  });

  it("opens an Action from the Dashboard or My Pending Actions and goes back to where it came from", async () => {
    mockStaffApp();
    vi.spyOn(api, "getMyPendingActions").mockResolvedValue({ items: staffSnapshot().myActions, pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Open Action on TKT-20260924-900701" }));
    await waitFor(() => expect(screen.getByRole("listitem", { name: /Replace the toner/ })).toHaveFocus());
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ticket Queue" })).not.toHaveAttribute("aria-current");
    await user.click(screen.getByRole("button", { name: "Back to Dashboard" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "View all My Pending Actions" }));
    expect(await screen.findByRole("heading", { name: "My Pending Actions", level: 2 })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Action on TKT-20260924-900701" }));
    await user.click(await screen.findByRole("button", { name: "Back to My Pending Actions" }));
    expect(await screen.findByRole("heading", { name: "My Pending Actions", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("gives Administrators the same Dashboard with User Management still available", async () => {
    mockStaffApp("ADMINISTRATOR");
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("button", { name: "View Unassigned Tickets in the Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("link", { name: "User Management" }));
    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
  });
});

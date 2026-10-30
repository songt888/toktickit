import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

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

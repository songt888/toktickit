import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionsTaken from "../../src/ActionsTaken.js";
import MyPendingActions from "../../src/MyPendingActions.js";
import StaffDashboard from "../../src/StaffDashboard.js";
import * as api from "../../src/api.js";
import { action, deferred, list, mockList } from "./actionFixtures.js";

afterEach(() => vi.restoreAllMocks());

const asOf = "2026-10-30T05:00:00.000Z";
const recentFrom = "2026-10-23T05:00:00.000Z";
const zeroStatus = { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 };
const ticket = (id: number, overrides: Partial<api.DashboardTicket> = {}): api.DashboardTicket => ({
  id, ticketNumber: `TKT-20261030-000${id}`, summary: `Ticket ${id}`, currentStatus: "OPEN", itPriority: "URGENT",
  owner: null, updatedAt: "2026-10-30T04:00:00.000Z", lastResolvedAt: null, ...overrides,
});
function snapshot(overrides: Partial<api.StaffDashboardData> = {}): api.StaffDashboardData {
  return {
    asOf, recentFrom, displayTimeZone: "Asia/Bangkok",
    metrics: {
      unassignedTickets: 4, myTickets: 2, myActions: 7,
      byStatus: { ...zeroStatus, NEW: 3, OPEN: 5, CLOSED: 9 },
      byItPriority: { LOW: 1, MEDIUM: 0, HIGH: 2, URGENT: 6 },
    },
    myActions: [{ id: 501, ticketId: 801, ticketNumber: "TKT-20261030-000801", description: "Replace the toner", status: "IN_PROGRESS", updatedAt: "2026-10-30T03:00:00.000Z" }],
    urgentTickets: [ticket(802, { owner: { id: 31, name: "Nattakit Support" } })],
    recentTickets: [ticket(803, { currentStatus: "CLOSED", itPriority: "LOW", summary: "Mail fixed" })],
    ...overrides,
  };
}

function renderDashboard(props: Partial<Parameters<typeof StaffDashboard>[0]> = {}) {
  const handlers = { onViewQueue: vi.fn(), onOpenTicket: vi.fn(), onOpenAction: vi.fn(), onViewMyActions: vi.fn(), onSessionExpired: vi.fn() };
  const view = render(<StaffDashboard userId={31} visible {...handlers} {...props} />);
  return { ...handlers, view, user: userEvent.setup() };
}
// The card comes before the list section of the same name.
const card = (title: string) => screen.getAllByRole("heading", { name: title })[0].closest("section")!;

describe("Staff and Administrator Dashboard (UI-06)", () => {
  it("shows the three cards, captioned status and priority breakdowns, and the three lists", async () => {
    vi.spyOn(api, "getStaffDashboard").mockResolvedValue(snapshot());
    const { user, onOpenAction, onOpenTicket } = renderDashboard();
    await screen.findByText("Replace the toner");
    expect(within(card("Unassigned Tickets")).getByText("4")).toBeInTheDocument();
    expect(within(card("My Tickets")).getByText("2")).toBeInTheDocument();
    expect(within(card("My Pending Actions")).getByText("7")).toBeInTheDocument();
    expect(screen.getByText("All Tickets, including resolved, closed and cancelled.")).toBeInTheDocument();
    expect(screen.getByText("Active Tickets only.")).toBeInTheDocument();
    // Every bucket shows its number, zero included.
    expect(screen.getByRole("button", { name: "Closed: 9 Tickets, view in the Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelled: 0 Tickets, view in the Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Medium: 0 active Tickets, view in the Ticket Queue" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Tickets, view in the Ticket Queue$/ })).toHaveLength(12);
    expect(screen.getByText(/^As of .*\(Bangkok\)$/)).toBeInTheDocument();

    expect(screen.getByText("Replace the toner")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Action on TKT-20261030-000801" }));
    expect(onOpenAction).toHaveBeenCalledWith(801, 501);
    expect(screen.getByText(/Owner: Nattakit Support/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Detail for TKT-20261030-000803" }));
    expect(onOpenTicket).toHaveBeenCalledWith(803);
  });

  it("drills down with the exact Queue filters, the session user id and the returned dates", async () => {
    vi.spyOn(api, "getStaffDashboard").mockResolvedValue(snapshot());
    const { user, onViewQueue, onViewMyActions } = renderDashboard();
    await screen.findByText("Replace the toner");
    for (const name of [
      "View Unassigned Tickets in the Ticket Queue", "View My Tickets in the Ticket Queue",
      "Open: 5 Tickets, view in the Ticket Queue", "Urgent: 6 active Tickets, view in the Ticket Queue",
      "View all urgent", "View all recently updated",
    ]) await user.click(screen.getByRole("button", { name }));
    expect(onViewQueue.mock.calls.map(([scope]) => scope.filter)).toEqual([
      { statusGroup: "active", ownerId: "unassigned" },
      { statusGroup: "active", ownerId: 31 },
      { currentStatus: "OPEN" },
      { statusGroup: "active", itPriority: "URGENT" },
      { statusGroup: "active", itPriority: "URGENT" },
      { updatedFrom: recentFrom, updatedTo: asOf },
    ]);
    await user.click(screen.getByRole("button", { name: "View My Pending Actions" }));
    await user.click(screen.getByRole("button", { name: "View all My Pending Actions" }));
    expect(onViewMyActions).toHaveBeenCalledTimes(2);
  });

  it("separates loading, empty sections, failure with retry and a labelled older snapshot", async () => {
    const first = deferred<api.StaffDashboardData>();
    const load = vi.spyOn(api, "getStaffDashboard").mockReturnValueOnce(first.promise);
    const { user } = renderDashboard();
    expect(screen.getByText("Loading your Dashboard…")).toBeInTheDocument();
    await act(async () => first.reject(new api.ApiRequestError("boom", 500)));
    expect(screen.getByRole("alert")).toHaveTextContent("The Dashboard could not be loaded.");

    load.mockResolvedValueOnce(snapshot({ myActions: [], urgentTickets: [], recentTickets: [] }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No pending Actions assigned to you.")).toBeInTheDocument();
    expect(screen.getByText("No active urgent Tickets.")).toBeInTheDocument();
    expect(screen.getByText("No Tickets were updated in the last 7 days.")).toBeInTheDocument();

    load.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be refreshed. Showing older data from .*\(Bangkok\)/);
    expect(within(card("Unassigned Tickets")).getByText("4")).toBeInTheDocument();
  });

  it("shows no data for a forbidden role and hands a 401 to the app", async () => {
    vi.spyOn(api, "getStaffDashboard").mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new api.ApiRequestError("Forbidden", 403));
    const { user, view } = renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("only available to IT Staff and Administrators");
    expect(screen.queryByText("Replace the toner")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Unassigned Tickets" })).not.toBeInTheDocument();
    view.unmount();

    vi.spyOn(api, "getStaffDashboard").mockRejectedValueOnce(new api.ApiRequestError("Authentication required", 401));
    const { onSessionExpired } = renderDashboard({ userId: 32 });
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledOnce());
  });

  it("reloads on entry and ignores a slower response from an earlier visit", async () => {
    const early = deferred<api.StaffDashboardData>();
    const later = snapshot({ metrics: { ...snapshot().metrics, unassignedTickets: 9 } });
    const load = vi.spyOn(api, "getStaffDashboard").mockReturnValueOnce(early.promise).mockResolvedValueOnce(later);
    const { view, ...handlers } = renderDashboard();
    const props = { userId: 31, onViewQueue: handlers.onViewQueue, onOpenTicket: handlers.onOpenTicket, onOpenAction: handlers.onOpenAction, onViewMyActions: handlers.onViewMyActions, onSessionExpired: handlers.onSessionExpired };
    view.rerender(<StaffDashboard {...props} visible={false} />);
    view.rerender(<StaffDashboard {...props} visible />);
    expect(await within(await screen.findByRole("region", { name: "Unassigned Tickets" })).findByText("9")).toBeInTheDocument();
    await act(async () => early.resolve(snapshot()));
    expect(within(card("Unassigned Tickets")).getByText("9")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("My Pending Actions list (UI-06 paging)", () => {
  it("pages through the session user's pending Actions and opens one", async () => {
    const item = (id: number): api.ActionSummary => ({ id, ticketId: 900 + id, ticketNumber: `TKT-${id}`, description: `Action ${id}`, status: "PLANNED", updatedAt: "2026-10-30T03:00:00.000Z" });
    const load = vi.spyOn(api, "getMyPendingActions")
      .mockResolvedValueOnce({ items: [item(1)], pagination: { page: 1, pageSize: 10, totalItems: 11, totalPages: 2 } })
      .mockResolvedValueOnce({ items: [item(11)], pagination: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 } });
    const onOpenAction = vi.fn();
    const user = userEvent.setup();
    render(<MyPendingActions onBack={vi.fn()} onOpenAction={onOpenAction} onSessionExpired={vi.fn()} />);
    expect(await screen.findByText("Page 1 of 2 (11 Actions)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Action 11")).toBeInTheDocument();
    expect(load).toHaveBeenLastCalledWith(2);
    await user.click(screen.getByRole("button", { name: "Open Action on TKT-11" }));
    expect(onOpenAction).toHaveBeenCalledWith(911, 11);
  });

  it("shows the empty message", async () => {
    vi.spyOn(api, "getMyPendingActions").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } });
    render(<MyPendingActions onBack={vi.fn()} onOpenAction={vi.fn()} onSessionExpired={vi.fn()} />);
    expect(await screen.findByText("No pending Actions assigned to you.")).toBeInTheDocument();
  });
});

describe("Opening an Action from the Dashboard (UI-06 Open Action)", () => {
  it("finds the Action on a later page of Actions Taken and focuses it", async () => {
    const load = mockList(list([action({ id: 1, description: "First page" })], 1, 2), list([action({ id: 501, description: "Replace the toner" })], 2, 2));
    render(<ActionsTaken ticketId={801} ticketStatus="IN_PROGRESS" focusActionId={501} />);
    await waitFor(() => expect(screen.getByRole("listitem", { name: /Replace the toner/ })).toHaveFocus());
    expect(load.mock.calls.map(([, page]) => page)).toEqual([1, 2]);
  });
});

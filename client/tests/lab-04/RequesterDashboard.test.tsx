import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequesterDashboard from "../../src/RequesterDashboard.js";
import * as api from "../../src/api.js";
import { deferred } from "./actionFixtures.js";

afterEach(() => vi.restoreAllMocks());

const asOf = "2026-10-30T05:00:00.000Z";
const recentFrom = "2026-10-23T05:00:00.000Z";
function snapshot(overrides: Partial<api.RequesterDashboardData> = {}): api.RequesterDashboardData {
  return {
    asOf, recentFrom, displayTimeZone: "Asia/Bangkok",
    metrics: { openTickets: 3, waitingForRequester: 1, recentlyResolved: 0 },
    recentTickets: [{
      id: 801, ticketNumber: "TKT-20261030-000801", summary: "Printer offline", currentStatus: "WAITING_FOR_REQUESTER",
      itPriority: "HIGH", owner: null, updatedAt: "2026-10-30T04:00:00.000Z", lastResolvedAt: null,
    }],
    ...overrides,
  };
}

function renderDashboard(props: Partial<Parameters<typeof RequesterDashboard>[0]> = {}) {
  const handlers = { onViewTickets: vi.fn(), onOpenTicket: vi.fn(), onCreateTicket: vi.fn(), onSessionExpired: vi.fn() };
  const view = render(<RequesterDashboard requesterId={41} visible {...handlers} {...props} />);
  return { ...handlers, view, user: userEvent.setup() };
}
const card = (title: string) => screen.getByRole("heading", { name: title }).closest("section")!;

describe("Requester Dashboard (UI-05)", () => {
  it("shows three labelled cards with numbers including zero, the snapshot time and the recent list", async () => {
    vi.spyOn(api, "getRequesterDashboard").mockResolvedValue(snapshot());
    const { user, onOpenTicket, onCreateTicket } = renderDashboard();
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(within(card("Open Tickets")).getByText("3")).toBeInTheDocument();
    expect(within(card("Waiting for You")).getByText("1")).toBeInTheDocument();
    expect(within(card("Recently Resolved")).getByText("0")).toBeInTheDocument();
    expect(within(card("Recently Resolved")).getByText(/last 7 days. Older Tickets with an unknown resolution date are not counted/)).toBeInTheDocument();
    expect(screen.getByText(/^As of .*\(Bangkok\)$/)).toBeInTheDocument();
    expect(screen.getByText("Printer offline")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Detail for TKT-20261030-000801" }));
    expect(onOpenTicket).toHaveBeenCalledWith(801);
    await user.click(screen.getByRole("button", { name: "Create Ticket" }));
    expect(onCreateTicket).toHaveBeenCalled();
  });

  it("drills down with the exact filters and the returned asOf/recentFrom, never browser-made dates", async () => {
    vi.spyOn(api, "getRequesterDashboard").mockResolvedValue(snapshot());
    const { user, onViewTickets } = renderDashboard();
    await screen.findByText("Printer offline");
    await user.click(screen.getByRole("button", { name: "View Open Tickets in My Tickets" }));
    await user.click(screen.getByRole("button", { name: "View Waiting for You in My Tickets" }));
    await user.click(screen.getByRole("button", { name: "View Recently Resolved in My Tickets" }));
    await user.click(screen.getByRole("button", { name: "View all recently updated" }));
    expect(onViewTickets.mock.calls.map(([scope]) => scope.filter)).toEqual([
      { statusGroup: "active" },
      { currentStatus: "WAITING_FOR_REQUESTER" },
      { statusGroup: "resolved", resolvedFrom: recentFrom, resolvedTo: asOf },
      { updatedFrom: recentFrom, updatedTo: asOf },
    ]);
  });

  it("separates loading, empty, failure with retry, and a labelled older snapshot after a failed refresh", async () => {
    const first = deferred<api.RequesterDashboardData>();
    const load = vi.spyOn(api, "getRequesterDashboard").mockReturnValueOnce(first.promise);
    const { user } = renderDashboard();
    expect(screen.getByText("Loading your Dashboard…")).toBeInTheDocument();
    await act(async () => first.reject(new api.ApiRequestError("boom", 500)));
    expect(screen.getByRole("alert")).toHaveTextContent("The Dashboard could not be loaded.");

    load.mockResolvedValueOnce(snapshot({ metrics: { openTickets: 0, waitingForRequester: 0, recentlyResolved: 0 }, recentTickets: [] }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("None of your Tickets were updated in the last 7 days.")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(3);

    load.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be refreshed. Showing older data from .*\(Bangkok\)/);
    expect(screen.getAllByText("0")).toHaveLength(3);
  });

  it("shows no data for a forbidden role and hands a 401 to the app", async () => {
    vi.spyOn(api, "getRequesterDashboard").mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new api.ApiRequestError("Forbidden", 403));
    const { user, view } = renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("only available to Requesters");
    expect(screen.queryByText("Printer offline")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Open Tickets" })).not.toBeInTheDocument();
    view.unmount();

    vi.spyOn(api, "getRequesterDashboard").mockRejectedValueOnce(new api.ApiRequestError("Authentication required", 401));
    const { onSessionExpired } = renderDashboard({ requesterId: 42 });
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledOnce());
  });

  it("reloads on entry and ignores a slower response from an earlier visit", async () => {
    const early = deferred<api.RequesterDashboardData>();
    const load = vi.spyOn(api, "getRequesterDashboard").mockReturnValueOnce(early.promise).mockResolvedValueOnce(snapshot({ metrics: { openTickets: 9, waitingForRequester: 0, recentlyResolved: 0 } }));
    const { view, onViewTickets, onOpenTicket, onCreateTicket, onSessionExpired } = renderDashboard();
    const props = { requesterId: 41, onViewTickets, onOpenTicket, onCreateTicket, onSessionExpired };
    view.rerender(<RequesterDashboard {...props} visible={false} />);
    view.rerender(<RequesterDashboard {...props} visible />);
    expect(await screen.findByText("9")).toBeInTheDocument();
    await act(async () => early.resolve(snapshot({ metrics: { openTickets: 4, waitingForRequester: 0, recentlyResolved: 0 } })));
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.queryByText("4")).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionsTaken from "../../src/ActionsTaken.js";
import TicketDetail from "../../src/TicketDetail.js";
import * as api from "../../src/api.js";
import { action, deferred, list, mockList } from "./actionFixtures.js";

afterEach(() => vi.restoreAllMocks());

const revisions = {
  items: [
    { version: 1, operation: "CREATE" as const, actor: { id: 32, name: "Pim Admin" }, createdAt: "2026-10-30T01:31:00.000Z", snapshot: action() },
    { version: 2, operation: "STATUS" as const, actor: { id: 31, name: "Nattakit Support" }, createdAt: "2026-10-30T02:31:00.000Z", snapshot: action({ status: "COMPLETED", result: "Fixed", version: 2 }) },
  ],
  pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
};

describe("Requester Actions Taken (UI-02)", () => {
  it("shows all Actions read-only, with history but no write controls", async () => {
    mockList(list([action({ status: "COMPLETED", result: "Fixed" }), action({ id: 502, description: "Order toner", status: "CANCELLED", cancellationReason: "Not needed" })]));
    const history = vi.spyOn(api, "getActionRevisions").mockResolvedValue(revisions);
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={801} ticketStatus="IN_PROGRESS" />);
    const section = (await screen.findByRole("heading", { name: "Actions Taken" })).closest("section")!;
    await screen.findByText("Order toner");
    expect(within(section).getByText(/This list is read-only/)).toBeInTheDocument();
    expect(within(section).getAllByRole("button").map((button) => button.textContent)).toEqual(["View History", "View History"]);
    expect(within(section).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(section).queryByText(/Internal Notes/)).not.toBeInTheDocument();

    const toggle = within(screen.getByRole("listitem", { name: "Action: Restarted the print spooler" })).getByRole("button", { name: "View History" });
    await user.click(toggle);
    expect(history).toHaveBeenCalledWith(801, 501, 1);
    expect(await screen.findByText(/Version 2: STATUS/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "History for this Action" })).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Close History" }));
    expect(toggle).toHaveFocus();
  });

  it("separates loading, empty and failure states, with a retry", async () => {
    const spy = vi.spyOn(api, "getActionsTaken").mockRejectedValueOnce(new api.ApiRequestError("boom", 500)).mockResolvedValue(list([]));
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={801} ticketStatus="NEW" />);
    expect(screen.getByText("Loading Actions Taken…")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Actions Taken could not be loaded.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No Actions have been recorded yet.")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("pages in stable order and moves focus to the list heading", async () => {
    const spy = mockList(list([action()], 1, 2), list([action({ id: 511, description: "Later work" })], 2, 2));
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={801} ticketStatus="IN_PROGRESS" />);
    await user.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText("Later work")).toBeInTheDocument();
    expect(spy).toHaveBeenLastCalledWith(801, 2);
    expect(screen.getByText("Page 2 of 2 (1 Actions)")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Actions Taken" })).toHaveFocus());
  });

  it("never shows the previous Ticket's late list after switching Tickets (remount)", async () => {
    const late = deferred<api.ActionListResponse>();
    vi.spyOn(api, "getActionsTaken").mockImplementation((ticketId) =>
      ticketId === 801 ? late.promise : Promise.resolve(list([action({ id: 900, ticketId: 802, description: "Work on the second Ticket" })])));
    const { rerender } = render(<ActionsTaken key={801} ticketId={801} ticketStatus="NEW" />);
    rerender(<ActionsTaken key={802} ticketId={802} ticketStatus="NEW" />);
    expect(await screen.findByText("Work on the second Ticket")).toBeInTheDocument();
    late.resolve(list([action({ description: "Old Ticket work" })]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Old Ticket work")).not.toBeInTheDocument();
  });

  it("appears in the Requester Ticket Detail beside the existing sections", async () => {
    vi.spyOn(api, "getTicketDetail").mockResolvedValue({
      id: 801, ticketNumber: "TKT-20261030-000801", ticketDate: "2026-10-30T01:00:00.000Z", requesterId: 41, categoryId: 1, relatedSystemId: 2,
      summary: "Printer offline", description: "The printer does not respond.", requestedPriority: "MEDIUM", currentStatus: "IN_PROGRESS",
      problemAppearsResolved: false, problemAppearsResolvedAt: null, requester: { id: 41, name: "Ari Suksan", email: "ari@example.com" },
      category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Printing" }, createdAt: "2026-10-30T01:00:00.000Z",
      updatedAt: "2026-10-30T02:00:00.000Z", attachments: [],
    });
    vi.spyOn(api, "getTicketComments").mockResolvedValue([]);
    vi.spyOn(api, "getTicketAttachments").mockResolvedValue([]);
    mockList(list([action({ status: "IN_PROGRESS" })]));
    render(<TicketDetail ticketId={801} onBack={vi.fn()} />);
    expect(await screen.findByText("Restarted the print spooler")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public Comments" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
  });
});

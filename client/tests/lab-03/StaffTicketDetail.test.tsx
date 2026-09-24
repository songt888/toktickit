import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const staff: api.StaffUser = {
  id: 31,
  name: "Nattakit Support",
  email: "nattakit.support@example.com",
  role: "IT_STAFF",
};
const administrator: api.StaffUser = {
  id: 32,
  name: "Lab Administrator",
  email: "lab.admin@example.com",
  role: "ADMINISTRATOR",
};
const ticket: api.StaffTicketDetailData = {
  id: 701,
  ticketNumber: "TKT-20260924-900701",
  ticketDate: "2026-09-24T01:00:00.000Z",
  requesterId: 41,
  categoryId: 1,
  relatedSystemId: 2,
  ownerId: null,
  summary: "VPN is unavailable",
  description: "The client cannot reach the campus VPN.",
  requestedPriority: "HIGH",
  itPriority: "MEDIUM",
  currentStatus: "NEW",
  updatedAt: "2026-09-24T02:00:00.000Z",
  createdAt: "2026-09-24T01:00:00.000Z",
  problemAppearsResolved: false,
  problemAppearsResolvedAt: null,
  requester: { id: 41, name: "Ari Suksan", email: "ari@example.com" },
  owner: null,
  category: { id: 1, name: "Network" },
  relatedSystem: { id: 2, name: "Campus VPN" },
  attachments: [],
  publicComments: [],
  internalNotes: [],
};

function updated(overrides: Partial<api.StaffTicketMutationResponse> = {}): api.StaffTicketMutationResponse {
  return {
    id: ticket.id,
    ownerId: null,
    owner: null,
    itPriority: ticket.itPriority,
    currentStatus: ticket.currentStatus,
    problemAppearsResolved: false,
    updatedAt: "2026-09-24T02:01:00.000Z",
    ...overrides,
  };
}

function setup(detail = ticket) {
  vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue(detail);
  vi.spyOn(api, "getStaffAssignees").mockResolvedValue([staff, administrator]);
}

afterEach(() => vi.restoreAllMocks());

describe("Staff Ticket Detail operational controls", () => {
  it("claims the Ticket as the signed-in user and keeps Requested Priority read-only", async () => {
    setup();
    const mutation = vi.spyOn(api, "updateStaffTicketOwner").mockResolvedValue(updated({
      ownerId: staff.id,
      owner: staff,
      updatedAt: "2026-09-24T02:02:00.000Z",
    }));
    const user = userEvent.setup();

    render(<StaffTicketDetail ticketId={ticket.id} currentUserId={staff.id} onBack={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Operational Ticket Detail" })).toBeInTheDocument();
    const assigneeSelect = screen.getByRole("combobox", { name: "Assign to" });
    expect(within(assigneeSelect).getByRole("option", { name: /Nattakit Support/ })).toBeInTheDocument();
    expect(within(assigneeSelect).getByRole("option", { name: /Lab Administrator/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Claim Ticket" }));
    expect(mutation).toHaveBeenCalledWith(ticket.id, staff.id, ticket.updatedAt);
    expect(await screen.findByText("You claimed this Ticket.")).toBeInTheDocument();
    const ticketInformation = screen.getByRole("region", { name: "Ticket Information" });
    expect(within(ticketInformation).getByText("Requested Priority").parentElement).toHaveTextContent("HIGH");
    expect(within(ticketInformation).getByText("IT Priority").parentElement).toHaveTextContent("MEDIUM");
  });

  it("assigns to an eligible user, updates IT Priority, and saves a permitted status", async () => {
    setup();
    const ownerMutation = vi.spyOn(api, "updateStaffTicketOwner").mockResolvedValue(updated({
      ownerId: administrator.id,
      owner: administrator,
    }));
    const priorityMutation = vi.spyOn(api, "updateStaffTicketPriority").mockResolvedValue(updated({
      ownerId: administrator.id,
      owner: administrator,
      itPriority: "URGENT",
      updatedAt: "2026-09-24T02:03:00.000Z",
    }));
    const statusMutation = vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue(updated({
      ownerId: administrator.id,
      owner: administrator,
      itPriority: "URGENT",
      currentStatus: "OPEN",
      updatedAt: "2026-09-24T02:04:00.000Z",
    }));
    const user = userEvent.setup();

    render(<StaffTicketDetail ticketId={ticket.id} currentUserId={staff.id} onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "Operational Ticket Detail" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Assign to" }), String(administrator.id));
    await user.click(screen.getByRole("button", { name: "Assign Ticket" }));
    await screen.findByText("Ticket assigned.");
    expect(ownerMutation).toHaveBeenCalledWith(ticket.id, administrator.id, ticket.updatedAt);

    await user.selectOptions(screen.getByRole("combobox", { name: "IT Priority" }), "URGENT");
    await user.click(screen.getByRole("button", { name: "Save IT Priority" }));
    await waitFor(() => expect(priorityMutation).toHaveBeenCalledWith(
      ticket.id,
      "URGENT",
      "2026-09-24T02:01:00.000Z",
    ));
    const ticketInformation = screen.getByRole("region", { name: "Ticket Information" });
    expect(within(ticketInformation).getByText("Requested Priority").parentElement).toHaveTextContent("HIGH");

    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "OPEN");
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(statusMutation).toHaveBeenCalledWith(
      ticket.id,
      "OPEN",
      false,
      "2026-09-24T02:03:00.000Z",
    ));
  });

  it("requires confirmation before moving a Ticket to Closed", async () => {
    const resolvedTicket = { ...ticket, currentStatus: "RESOLVED" as const };
    setup(resolvedTicket);
    const statusMutation = vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue(updated({ currentStatus: "CLOSED" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();

    render(<StaffTicketDetail ticketId={ticket.id} currentUserId={staff.id} onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "Operational Ticket Detail" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "CLOSED");
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(statusMutation).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(statusMutation).toHaveBeenCalledWith(
      ticket.id,
      "CLOSED",
      true,
      resolvedTicket.updatedAt,
    ));

  });

  it("offers a refresh when the server rejects a stale update", async () => {
    setup();
    vi.spyOn(api, "updateStaffTicketPriority").mockRejectedValue(new api.ApiRequestError("Ticket changed", 409));
    const retryUser = userEvent.setup();
    render(<StaffTicketDetail ticketId={ticket.id} currentUserId={staff.id} onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "Operational Ticket Detail" });
    await retryUser.selectOptions(screen.getByRole("combobox", { name: "IT Priority" }), "URGENT");
    await retryUser.click(screen.getByRole("button", { name: "Save IT Priority" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This Ticket changed after you opened it.");
    await retryUser.click(screen.getByRole("button", { name: "Refresh Ticket" }));
    await waitFor(() => expect(api.getStaffTicketDetail).toHaveBeenCalledTimes(2));
  });
});

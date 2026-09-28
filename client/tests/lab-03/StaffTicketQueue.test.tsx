import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketQueue from "../../src/StaffTicketQueue.js";
import * as api from "../../src/api.js";

const ticket: api.StaffTicketListItem = {
  id: 601,
  ticketNumber: "TKT-20260919-900601",
  ticketDate: "2026-09-19T01:00:00.000Z",
  summary: "External monitor is not detected",
  requestedPriority: "HIGH",
  itPriority: "URGENT",
  currentStatus: "IN_PROGRESS",
  updatedAt: "2026-09-19T02:00:00.000Z",
  requester: { id: 11, name: "Ari Suksan", email: "ari.suksan@example.com" },
  owner: { id: 21, name: "Nattakit Support", email: "nattakit.support@example.com", role: "IT_STAFF" },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 2, name: "Laptop and Desktop" },
};

const pagination = { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 };

afterEach(() => vi.restoreAllMocks());

function mockReferenceData() {
  vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Laptop and Desktop" }]);
}

describe("Staff Ticket Queue UI", () => {
  it("shows operational fields, ownership, badges, and opens Ticket Detail", async () => {
    mockReferenceData();
    vi.spyOn(api, "getStaffTickets").mockResolvedValue({ items: [ticket], pagination });
    const onOpenTicket = vi.fn();
    const user = userEvent.setup();

    render(<StaffTicketQueue onOpenTicket={onOpenTicket} />);

    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText(ticket.ticketNumber)).toBeInTheDocument();
    expect(within(table).getByText(ticket.summary)).toBeInTheDocument();
    expect(within(table).getByText("Ari Suksan")).toBeInTheDocument();
    expect(within(table).getByText("Nattakit Support")).toBeInTheDocument();
    expect(within(table).getByText("HIGH")).toBeInTheDocument();
    expect(within(table).getByText("URGENT")).toBeInTheDocument();
    expect(within(table).getByText("IN_PROGRESS")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Open Detail" })[0]);
    expect(onOpenTicket).toHaveBeenCalledWith(ticket.id);
  });

  it("sends search, filter, sort, and pagination options to the API", async () => {
    mockReferenceData();
    const getStaffTickets = vi.spyOn(api, "getStaffTickets").mockResolvedValue({ items: [ticket], pagination });
    const user = userEvent.setup();

    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    await screen.findByRole("table");

    await user.type(screen.getByRole("textbox", { name: "Search Queue" }), "monitor");
    await user.selectOptions(screen.getByLabelText("IT Priority"), "URGENT");
    await user.selectOptions(screen.getByLabelText("Sort by"), "ticketNumber");
    await user.selectOptions(screen.getByLabelText("Order"), "asc");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(getStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({
      search: "monitor",
      itPriority: "URGENT",
      sort: "ticketNumber",
      order: "asc",
      page: 1,
    })));
  });

  it("shows no-results and retryable failure states", async () => {
    mockReferenceData();
    const getStaffTickets = vi.spyOn(api, "getStaffTickets")
      .mockRejectedValueOnce(new api.ApiRequestError("Unable to load the staff ticket queue.", 500))
      .mockResolvedValueOnce({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } });
    const user = userEvent.setup();

    render(<StaffTicketQueue onOpenTicket={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load the staff ticket queue.");

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No tickets are currently in the operational queue.")).toBeInTheDocument();
    expect(getStaffTickets).toHaveBeenCalledTimes(2);
  });
});

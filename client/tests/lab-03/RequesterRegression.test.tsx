import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester: api.AuthUser = {
  id: 7,
  name: "Ari Suksan",
  email: "ari.suksan@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};
const category = { id: 1, name: "Hardware" };
const relatedSystem = { id: 1, name: "Campus Wi-Fi" };
const ticket: api.TicketListItem = {
  id: 101,
  ticketNumber: "TKT-20260919-000101",
  ticketDate: "2026-09-19T00:00:00.000Z",
  summary: "Session-owned ticket",
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
  updatedAt: "2026-09-19T00:00:00.000Z",
  category,
  relatedSystem,
};
const detail: api.TicketDetail = {
  ...ticket,
  requesterId: requester.id,
  categoryId: category.id,
  relatedSystemId: relatedSystem.id,
  description: "Ticket detail owned by the authenticated requester.",
  createdAt: ticket.ticketDate,
  requester: { id: requester.id, name: requester.name, email: requester.email },
  category,
  relatedSystem,
  attachments: [],
  problemAppearsResolved: false,
  problemAppearsResolvedAt: null,
};

afterEach(() => vi.restoreAllMocks());

function mockSessionWorkflow() {
  vi.spyOn(api, "getCurrentUser").mockResolvedValue({
    user: requester,
    requiresPasswordChange: false,
  });
  vi.spyOn(api, "getCategories").mockResolvedValue([category]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([relatedSystem]);
  vi.spyOn(api, "getTicketComments").mockResolvedValue([]);
}

describe("Requester authenticated-session regression", () => {
  it("renders identity from auth/me and does not expose the old requester selector", async () => {
    const getTickets = vi.spyOn(api, "getMyTickets").mockResolvedValue({
      items: [ticket],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    mockSessionWorkflow();

    render(<App />);

    expect(await screen.findByText("Tickets created by Ari Suksan.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Choose a Development Requester/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
    expect(getTickets.mock.calls[0]).toHaveLength(1);
    expect(window.localStorage.length).toBe(0);
  });

  it("passes only ticket identifiers to the detail API after authenticated list navigation", async () => {
    mockSessionWorkflow();
    vi.spyOn(api, "getMyTickets").mockResolvedValue({
      items: [ticket],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    const getDetail = vi.spyOn(api, "getTicketDetail").mockResolvedValue(detail);
    const user = userEvent.setup();

    render(<App />);
    await user.click((await screen.findAllByRole("button", { name: "View details" }))[0]);

    expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
    expect(getDetail).toHaveBeenCalledWith(ticket.id);
  });

  it("lets the authenticated requester add a public comment and mark the problem resolved", async () => {
    mockSessionWorkflow();
    vi.spyOn(api, "getMyTickets").mockResolvedValue({
      items: [ticket],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(detail);
    const addComment = vi.spyOn(api, "addPublicComment").mockResolvedValue({
      id: 502,
      content: "The issue is still happening.",
      createdAt: "2026-09-19T01:00:00.000Z",
      author: requester,
    });
    const setResolution = vi.spyOn(api, "setProblemAppearsResolved").mockResolvedValue({
      id: ticket.id,
      problemAppearsResolved: true,
      problemAppearsResolvedAt: "2026-09-19T01:01:00.000Z",
      currentStatus: "NEW",
      updatedAt: "2026-09-19T01:01:00.000Z",
    });
    const user = userEvent.setup();

    render(<App />);
    await user.click((await screen.findAllByRole("button", { name: "View details" }))[0]);
    await screen.findByRole("heading", { name: "Public Comments" });

    await user.type(
      screen.getByRole("textbox", { name: "Add Public Comment" }),
      "The issue is still happening.",
    );
    await user.click(screen.getByRole("button", { name: "Add Public Comment" }));
    expect(addComment).toHaveBeenCalledWith(ticket.id, "The issue is still happening.");

    await user.click(screen.getByRole("button", { name: "Mark problem as resolved" }));
    expect(setResolution).toHaveBeenCalledWith(ticket.id, true);
    expect(await screen.findByText(/Ticket status was not changed/)).toBeInTheDocument();
  });
});

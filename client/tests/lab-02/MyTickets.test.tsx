import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requesterA = { id: 1, name: "Ari Suksan", email: "ari.suksan@example.com" };
const requesterB = { id: 2, name: "Ben Chaiyo", email: "ben.chaiyo@example.com" };
const categories = [{ id: 1, name: "Hardware" }];
const relatedSystems = [{ id: 1, name: "Campus Wi-Fi" }];

const ariTicket: api.TicketListItem = {
  id: 101,
  ticketNumber: "TKT-20260829-000101",
  ticketDate: "2026-08-29T00:00:00.000Z",
  summary: "Laptop battery drains quickly",
  requestedPriority: "HIGH",
  currentStatus: "NEW",
  updatedAt: "2026-08-29T00:00:00.000Z",
  category: categories[0],
  relatedSystem: relatedSystems[0],
};

const benTicket: api.TicketListItem = {
  ...ariTicket,
  id: 202,
  ticketNumber: "TKT-20260829-000202",
  summary: "VPN access request",
  requestedPriority: "LOW",
};

const ariTicketDetail: api.TicketDetail = {
  ...ariTicket,
  requesterId: requesterA.id,
  categoryId: categories[0].id,
  relatedSystemId: relatedSystems[0].id,
  createdAt: ariTicket.ticketDate,
  description: "A ticket detail fixture for navigation testing.",
  requester: requesterA,
  category: categories[0],
  relatedSystem: relatedSystems[0],
  attachments: [],
};

function listResponse(items: api.TicketListItem[], totalItems = items.length, totalPages = 1): api.TicketListResponse {
  return {
    items,
    pagination: { page: 1, pageSize: 10, totalItems, totalPages },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function mockReferences() {
  vi.spyOn(api, "getRequesters").mockResolvedValue([requesterA, requesterB]);
  vi.spyOn(api, "getCategories").mockResolvedValue(categories);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue(relatedSystems);
}

async function openMyTickets() {
  const user = userEvent.setup();
  mockReferences();

  render(<App />);
  const requesterSelect = await screen.findByLabelText(/Choose a Development Requester/);
  await user.selectOptions(requesterSelect, String(requesterA.id));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("link", { name: "My Tickets" }));
  await screen.findByRole("heading", { name: "My Tickets" });

  return user;
}

describe("My Tickets UI", () => {
  it("shows API-backed ticket fields and the Create Ticket action", async () => {
    vi.spyOn(api, "getMyTickets").mockResolvedValue(listResponse([ariTicket]));
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ariTicketDetail);
    const user = await openMyTickets();

    expect((await screen.findAllByText("TKT-20260829-000101")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Laptop battery drains quickly")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Hardware")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Campus Wi-Fi")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("HIGH", { selector: "span.badge.text-bg-warning" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("NEW", { selector: "span.badge.text-bg-primary" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Create Ticket" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "View details" })[0]);
    expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to My Tickets" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Ticket" }));
    expect(await screen.findByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
  });

  it("preserves list query state and active navigation after returning from detail", async () => {
    const getTickets = vi.spyOn(api, "getMyTickets").mockImplementation(async (_requesterId, options = {}) => ({
      items: [ariTicket],
      pagination: {
        page: options.page ?? 1,
        pageSize: options.pageSize ?? 10,
        totalItems: 21,
        totalPages: 3,
      },
    }));
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(ariTicketDetail);
    const user = await openMyTickets();

    await user.type(screen.getByLabelText("Search Tickets"), "battery");
    await user.selectOptions(screen.getByLabelText("Category"), String(categories[0].id));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(getTickets).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Showing page 2 of 3 (21 tickets)")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "View details" })[0]);
    expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "Back to My Tickets" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search Tickets")).toHaveValue("battery");
    expect(screen.getByLabelText("Category")).toHaveValue(String(categories[0].id));
    expect(screen.getByText("Showing page 2 of 3 (21 tickets)")).toBeInTheDocument();
  });

  it("applies search, filter, sorting, page size, and pagination controls", async () => {
    const getTickets = vi.spyOn(api, "getMyTickets").mockResolvedValue(
      listResponse([ariTicket], 11, 2),
    );
    const user = await openMyTickets();

    await user.type(screen.getByLabelText("Search Tickets"), "battery");
    await user.selectOptions(screen.getByLabelText("Requested Priority"), "HIGH");
    await user.selectOptions(screen.getByLabelText("Sort by"), "ticketNumber");
    await user.selectOptions(screen.getByLabelText("Order"), "asc");
    await user.selectOptions(screen.getByLabelText("Page size"), "25");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(getTickets).toHaveBeenCalledTimes(2));
    expect(getTickets.mock.calls[1]).toEqual([
      requesterA.id,
      {
        search: "battery",
        requestedPriority: "HIGH",
        sort: "ticketNumber",
        order: "asc",
        page: 1,
        pageSize: 25,
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(getTickets).toHaveBeenCalledTimes(3));
    expect(getTickets.mock.calls[2][1]).toEqual(
      expect.objectContaining({ search: "battery", page: 2, pageSize: 25 }),
    );
  });

  it("distinguishes an empty list from a filtered no-results state", async () => {
    vi.spyOn(api, "getMyTickets").mockResolvedValue(listResponse([]));
    const user = await openMyTickets();

    expect(await screen.findByText("No tickets yet. Create your first ticket.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search Tickets"), "missing");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(await screen.findByText("No tickets match your search or filters.")).toBeInTheDocument();
  });

  it("shows a failure state and can retry the API request", async () => {
    vi.spyOn(api, "getMyTickets")
      .mockRejectedValueOnce(new Error("Ticket list request failed (500)"))
      .mockResolvedValue(listResponse([ariTicket]));
    const user = await openMyTickets();

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load My Tickets");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect((await screen.findAllByText("TKT-20260829-000101")).length).toBeGreaterThan(0);
  });

  it("shows only the newly selected requester's tickets after switching context", async () => {
    vi.spyOn(api, "getMyTickets").mockImplementation(async (requesterId) =>
      requesterId === requesterA.id ? listResponse([ariTicket]) : listResponse([benTicket]),
    );
    const user = await openMyTickets();

    expect((await screen.findAllByText("Laptop battery drains quickly")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Change Requester" }));
    await user.selectOptions(
      await screen.findByLabelText(/Choose a Development Requester/),
      String(requesterB.id),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("link", { name: "My Tickets" }));

    expect((await screen.findAllByText("VPN access request")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Laptop battery drains quickly")).toHaveLength(0);
  });

  it("ignores an older ticket response when a newer request finishes first", async () => {
    const firstRequest = deferred<api.TicketListResponse>();
    const secondRequest = deferred<api.TicketListResponse>();
    const getTickets = vi.spyOn(api, "getMyTickets")
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const user = await openMyTickets();

    await waitFor(() => expect(getTickets).toHaveBeenCalledTimes(1));
    await user.type(screen.getByLabelText("Search Tickets"), "vpn");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(getTickets).toHaveBeenCalledTimes(2));

    secondRequest.resolve(listResponse([benTicket]));
    expect((await screen.findAllByText("VPN access request")).length).toBeGreaterThan(0);

    firstRequest.resolve(listResponse([ariTicket]));
    await firstRequest.promise;
    await waitFor(() => expect(screen.queryAllByText("Laptop battery drains quickly")).toHaveLength(0));
  });
});

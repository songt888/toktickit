import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketDetail from "../../src/TicketDetail.js";
import * as api from "../../src/api.js";

const detail: api.TicketDetail = {
  id: 301,
  ticketNumber: "TKT-20260831-000301",
  ticketDate: "2026-08-31T00:00:00.000Z",
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 1,
  summary: "VPN access request",
  description: "The requester cannot connect to the company VPN from home.",
  requestedPriority: "HIGH",
  currentStatus: "NEW",
  createdAt: "2026-08-31T01:00:00.000Z",
  updatedAt: "2026-08-31T02:00:00.000Z",
  requester: { id: 1, name: "Ari Suksan", email: "ari.suksan@example.com" },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 1, name: "Campus Wi-Fi" },
  attachments: [
    {
      id: 401,
      originalName: "network-log.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      createdAt: "2026-08-31T02:30:00.000Z",
      removedAt: null,
      removalReason: null,
    },
    {
      id: 402,
      originalName: "old-log.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096,
      createdAt: "2026-08-31T02:31:00.000Z",
      removedAt: "2026-08-31T03:00:00.000Z",
      removalReason: "No longer needed",
    },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Ticket Detail UI", () => {
  it("shows read-only ticket fields and separated attachment metadata", async () => {
    const onBack = vi.fn();
    vi.spyOn(api, "getTicketDetail").mockResolvedValue(detail);
    const user = userEvent.setup();

    render(<TicketDetail requesterId={1} ticketId={detail.id} onBack={onBack} />);

    expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
    expect(screen.getByText(detail.ticketNumber)).toBeInTheDocument();
    expect(screen.getByText(detail.summary)).toBeInTheDocument();
    expect(screen.getByText(detail.description)).toBeInTheDocument();
    expect(screen.getByText("Ari Suksan (ari.suksan@example.com)")).toBeInTheDocument();
    expect(screen.getByText("network-log.png")).toBeInTheDocument();
    expect(screen.getByText("old-log.pdf")).toBeInTheDocument();
    expect(screen.getByText(/No longer needed/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to My Tickets" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows a loading state while the detail request is pending", async () => {
    const pendingRequest = deferred<api.TicketDetail>();
    vi.spyOn(api, "getTicketDetail").mockReturnValue(pendingRequest.promise);

    render(<TicketDetail requesterId={1} ticketId={detail.id} onBack={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading Ticket Detail");
    pendingRequest.resolve(detail);
    expect(await screen.findByText(detail.ticketNumber)).toBeInTheDocument();
  });

  it("shows a not-found failure and can retry", async () => {
    vi.spyOn(api, "getTicketDetail")
      .mockRejectedValueOnce(new api.ApiRequestError("The API returned a not-found response.", 404))
      .mockResolvedValue(detail);
    const user = userEvent.setup();

    render(<TicketDetail requesterId={1} ticketId={detail.id} onBack={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket not found or you do not have access.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(detail.ticketNumber)).toBeInTheDocument();
  });
});

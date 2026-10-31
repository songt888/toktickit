import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketStatusHistory from "../../src/TicketStatusHistory.js";
import * as api from "../../src/api.js";
import { deferred, staff, stamp } from "./actionFixtures.js";

afterEach(() => vi.restoreAllMocks());

// UI-02 / AC-07: the shared Ticket Status History area on Requester and Staff Ticket Detail.
describe("Ticket Status History (UI-02, AC-07)", () => {
  it("lists ordered from/to events with actor and time, and says when none are recorded", async () => {
    const history = vi.spyOn(api, "getTicketStatusHistory")
      .mockResolvedValueOnce({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } })
      .mockResolvedValueOnce({ items: [
        { id: 1, fromStatus: null, toStatus: "NEW", createdAt: stamp, actor: { id: 41, name: "Ari Suksan" } },
        { id: 2, fromStatus: "NEW", toStatus: "IN_PROGRESS", createdAt: stamp, actor: staff },
      ], pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 } });
    const { rerender } = render(<TicketStatusHistory ticketId={801} refreshKey="a" />);
    expect(await screen.findByText("No status changes recorded yet.")).toBeInTheDocument();
    expect(screen.getByText(/Changes made before Lab 4 were not recorded/)).toBeInTheDocument();
    // A Ticket change (new updatedAt) reloads the history.
    rerender(<TicketStatusHistory ticketId={801} refreshKey="b" />);
    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => row.querySelector("strong")!.textContent)).toEqual(["Created → NEW", "NEW → IN_PROGRESS"]);
    expect(rows[1]).toHaveTextContent(`by ${staff.name}`);
    expect(history).toHaveBeenCalledTimes(2);
  });

  const event = (id: number, fromStatus: api.TicketStatus | null, toStatus: api.TicketStatus): api.TicketStatusEvent =>
    ({ id, fromStatus, toStatus, createdAt: stamp, actor: staff });

  it("retries after a failed load", async () => {
    const history = vi.spyOn(api, "getTicketStatusHistory")
      .mockRejectedValueOnce(new api.ApiRequestError("Down", 500))
      .mockResolvedValueOnce({ items: [event(1, "NEW", "OPEN")], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } });
    const user = userEvent.setup();
    render(<TicketStatusHistory ticketId={801} refreshKey="a" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The status history could not be loaded.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("NEW → OPEN")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(history).toHaveBeenCalledTimes(2);
  });

  it("pages through earlier and later changes, disabling the end buttons", async () => {
    const history = vi.spyOn(api, "getTicketStatusHistory").mockImplementation(async (_ticketId, page = 1) => ({
      items: page === 1 ? [event(1, "NEW", "OPEN")] : [event(11, "OPEN", "IN_PROGRESS")],
      pagination: { page, pageSize: 10, totalItems: 11, totalPages: 2 },
    }));
    const user = userEvent.setup();
    render(<TicketStatusHistory ticketId={801} refreshKey="a" />);
    expect(await screen.findByText("NEW → OPEN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Earlier changes" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Later changes" }));
    expect(await screen.findByText("OPEN → IN_PROGRESS")).toBeInTheDocument();
    expect(history).toHaveBeenLastCalledWith(801, 2);
    expect(screen.getByRole("button", { name: "Later changes" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Earlier changes" }));
    expect(await screen.findByText("NEW → OPEN")).toBeInTheDocument();
    expect(history).toHaveBeenLastCalledWith(801, 1);
  });

  it("tells the user to sign in again on 401 instead of offering Retry", async () => {
    vi.spyOn(api, "getTicketStatusHistory").mockRejectedValue(new api.ApiRequestError("Expired", 401));
    render(<TicketStatusHistory ticketId={801} refreshKey="a" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your session has ended. Sign in again");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
  it("never shows a late answer from an earlier load over a newer one", async () => {
    const page = (items: api.TicketStatusEvent[]) => ({ items, pagination: { page: 1, pageSize: 10, totalItems: items.length, totalPages: 1 } });
    const late = deferred<Awaited<ReturnType<typeof api.getTicketStatusHistory>>>();
    vi.spyOn(api, "getTicketStatusHistory").mockReturnValueOnce(late.promise)
      .mockResolvedValueOnce(page([event(2, "OPEN", "RESOLVED")]));
    const { rerender } = render(<TicketStatusHistory ticketId={801} refreshKey="a" />);
    // The Ticket changed before the first load answered.
    rerender(<TicketStatusHistory ticketId={801} refreshKey="b" />);
    expect(await screen.findByText("OPEN → RESOLVED")).toBeInTheDocument();
    await act(async () => late.resolve(page([event(1, "NEW", "OPEN")])));
    expect(screen.getByText("OPEN → RESOLVED")).toBeInTheDocument();
    expect(screen.queryByText("NEW → OPEN")).not.toBeInTheDocument();
  });
});


import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const staff: api.StaffUser = { id: 31, name: "Nattakit Support", email: "nattakit.support@example.com", role: "IT_STAFF" };
const blocked: api.ResolutionGate = { canResolve: false, completedActions: 1, pendingActions: 2, unsettledFollowUpActions: 1 };
const open: api.ResolutionGate = { canResolve: true, completedActions: 2, pendingActions: 0, unsettledFollowUpActions: 0 };

function detail(overrides: Partial<api.StaffTicketDetailData> = {}): api.StaffTicketDetailData {
  return {
    id: 801, ticketNumber: "TKT-20261030-000801", ticketDate: "2026-10-30T01:00:00.000Z", requesterId: 41, categoryId: 1, relatedSystemId: 2,
    ownerId: staff.id, summary: "Printer offline", description: "The printer does not respond.", requestedPriority: "MEDIUM", itPriority: "HIGH",
    currentStatus: "IN_PROGRESS", updatedAt: "2026-10-30T02:00:00.000Z", createdAt: "2026-10-30T01:00:00.000Z",
    problemAppearsResolved: false, problemAppearsResolvedAt: null, lastResolvedAt: null, resolutionGate: blocked,
    requester: { id: 41, name: "Ari Suksan", email: "ari@example.com" }, owner: staff,
    category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Printing" },
    attachments: [], publicComments: [], internalNotes: [],
    ...overrides,
  };
}

async function open_(ticket: api.StaffTicketDetailData) {
  vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue(ticket);
  vi.spyOn(api, "getStaffAssignees").mockResolvedValue([staff]);
  const user = userEvent.setup();
  render(<StaffTicketDetail ticketId={ticket.id} currentUserId={staff.id} onBack={vi.fn()} />);
  await screen.findByRole("heading", { name: "Operational Ticket Detail" });
  return user;
}
const statusSelect = () => screen.getByRole("combobox", { name: "Status" });
const optionLabels = () => within(statusSelect()).getAllByRole("option").map((option) => option.textContent);

afterEach(() => vi.restoreAllMocks());

describe("Ticket workflow controls (UI-03)", () => {
  it("offers only the matrix moves for the current status", async () => {
    await open_(detail({ currentStatus: "NEW", resolutionGate: open }));
    expect(optionLabels()).toEqual(["NEW (current)", "OPEN", "IN_PROGRESS", "CANCELLED"]);
  });

  it("explains the gate and disables Resolved while work is incomplete, even if the Requester says it looks resolved", async () => {
    await open_(detail({ problemAppearsResolved: true }));
    const resolved = within(statusSelect()).getByRole("option", { name: "RESOLVED (work not complete)" });
    expect(resolved).toBeDisabled();
    const help = "To resolve this Ticket, finish or cancel 2 pending Actions; settle the follow-up on 1 completed Action.";
    expect(screen.getByText(help)).toBeInTheDocument();
    expect(statusSelect()).toHaveAccessibleDescription(help);
    const readiness = screen.getByText("Resolution readiness").parentElement!;
    expect(within(readiness).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Completed Actions: 1", "Pending Actions: 2", "Unsettled follow-up: 1",
    ]);
  });

  it("shows readiness counts when the gate is met too", async () => {
    await open_(detail({ resolutionGate: open }));
    expect(screen.getByText("Completed Actions: 2")).toBeInTheDocument();
    expect(screen.getByText("Ready to resolve.")).toBeInTheDocument();
  });

  it("resolves when the gate is met and refreshes status and last-resolved time", async () => {
    const user = await open_(detail({ resolutionGate: open }));
    expect(within(statusSelect()).getByRole("option", { name: "RESOLVED" })).toBeEnabled();
    const resolvedAt = "2026-10-30T03:00:00.000Z";
    const save = vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue({
      id: 801, ownerId: staff.id, owner: staff, itPriority: "HIGH", currentStatus: "RESOLVED",
      problemAppearsResolved: false, lastResolvedAt: resolvedAt, updatedAt: resolvedAt,
    });
    await user.selectOptions(statusSelect(), "RESOLVED");
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(save).toHaveBeenCalledWith(801, "RESOLVED", false, "2026-10-30T02:00:00.000Z");
    expect(await screen.findByText("Ticket status was updated to RESOLVED.")).toBeInTheDocument();
    expect(screen.getAllByText("RESOLVED").some((node) => node.classList.contains("badge"))).toBe(true);
    expect(screen.getByText("Last Resolved").nextElementSibling).toHaveTextContent(new Date(resolvedAt).toLocaleString());
    expect(optionLabels()).toEqual(["RESOLVED (current)", "CLOSED", "REOPENED"]);
  });

  it("shows the server's gate when it rejects a Resolve that looked allowed", async () => {
    const user = await open_(detail({ resolutionGate: open }));
    vi.spyOn(api, "updateStaffTicketStatus").mockRejectedValue(new api.ApiRequestError(
      "Complete the recorded work and settle required follow-up before resolving.", 409, "RESOLUTION_GATE_FAILED",
      { resolutionGate: { canResolve: false, completedActions: 0, pendingActions: 1, unsettledFollowUpActions: 0 } },
    ));
    await user.selectOptions(statusSelect(), "RESOLVED");
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Complete the recorded work and settle required follow-up before resolving. To resolve this Ticket, complete at least one Action; finish or cancel 1 pending Action.",
    );
    expect(within(statusSelect()).getByRole("option", { name: "RESOLVED (work not complete)" })).toBeDisabled();
    expect(statusSelect()).toHaveValue("IN_PROGRESS");
    expect(screen.getByRole("button", { name: "Update Status" })).toBeDisabled();
    expect(screen.getByText("Pending Actions: 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh Ticket" })).not.toBeInTheDocument();
  });

  it("keeps the stale-update review for other conflicts", async () => {
    const user = await open_(detail({ resolutionGate: open }));
    vi.spyOn(api, "updateStaffTicketStatus").mockRejectedValue(new api.ApiRequestError("Ticket changed", 409, "STALE_STATE"));
    await user.selectOptions(statusSelect(), "WAITING_FOR_REQUESTER");
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This Ticket changed after you opened it.");
    expect(screen.getByRole("button", { name: "Refresh Ticket" })).toBeInTheDocument();
  });

  it("asks for confirmation before Closed and asks again after a conflict", async () => {
    const user = await open_(detail({ currentStatus: "RESOLVED", resolutionGate: open, lastResolvedAt: "2026-10-30T01:30:00.000Z" }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const save = vi.spyOn(api, "updateStaffTicketStatus")
      .mockRejectedValueOnce(new api.ApiRequestError("Ticket changed", 409, "STALE_STATE"))
      .mockResolvedValueOnce({
        id: 801, ownerId: staff.id, owner: staff, itPriority: "HIGH", currentStatus: "CLOSED",
        problemAppearsResolved: false, lastResolvedAt: "2026-10-30T01:30:00.000Z", updatedAt: "2026-10-30T04:00:00.000Z",
      });
    await user.selectOptions(statusSelect(), "CLOSED");
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(save).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(save).toHaveBeenLastCalledWith(801, "CLOSED", true, "2026-10-30T02:00:00.000Z");
    expect(await screen.findByRole("alert")).toHaveTextContent("This Ticket changed after you opened it.");

    // The earlier confirmation does not carry over: the retry asks again.
    await user.click(screen.getByRole("button", { name: "Update Status" }));
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(await screen.findByText("Ticket status was updated to CLOSED.")).toBeInTheDocument();
    expect(optionLabels()).toEqual(["CLOSED (current)", "REOPENED"]);
  });
});

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionsTaken from "../../src/ActionsTaken.js";
import StaffDashboard from "../../src/StaffDashboard.js";
import * as api from "../../src/api.js";
import { action, admin, list, mockList, staff, stamp } from "./actionFixtures.js";

afterEach(() => vi.restoreAllMocks());
// Vitest runs from the client folder.
const source = (path: string) => readFileSync(`${process.cwd()}/src/${path}`, "utf8");

describe("Zen Green style contract (STYLE-01)", () => {
  it("defines the four Zen Green tokens and loads them after Bootstrap so they win", () => {
    const theme = source("theme.css");
    for (const token of ["--tt-primary: #006B3C", "--tt-secondary: #0B7A46", "--tt-pale: #EAF6EF", "--tt-page: #F5F7F6"]) expect(theme).toContain(token);
    expect(theme).toMatch(/--bs-success: var\(--tt-primary\)/);
    const main = source("main.tsx");
    expect(main.indexOf('import "./theme.css"')).toBeGreaterThan(main.indexOf('import "bootstrap/dist/css/bootstrap.min.css"'));
  });

  it("labels every metric and state with text, never colour alone", async () => {
    const zero = { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 };
    vi.spyOn(api, "getStaffDashboard").mockResolvedValue({
      asOf: stamp, recentFrom: stamp, displayTimeZone: "Asia/Bangkok",
      metrics: { unassignedTickets: 1, myTickets: 0, myActions: 1, byStatus: { ...zero, CANCELLED: 2 }, byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 3 } },
      myActions: [{ id: 1, ticketId: 2, ticketNumber: "TKT-1", description: "Swap cable", status: "IN_PROGRESS", updatedAt: stamp }],
      recentTickets: [], urgentTickets: [{ id: 2, ticketNumber: "TKT-2", summary: "Core switch down", currentStatus: "OPEN", itPriority: "URGENT", owner: null, updatedAt: stamp, lastResolvedAt: null }],
    });
    render(<StaffDashboard userId={31} visible onViewQueue={vi.fn()} onOpenTicket={vi.fn()} onOpenAction={vi.fn()} onViewMyActions={vi.fn()} onSessionExpired={vi.fn()} />);
    const urgent = (await screen.findByText("Core switch down")).closest("li")!;
    // Status, IT priority and owner each carry words, not just a badge colour.
    expect(within(urgent).getByText("Open")).toBeInTheDocument();
    expect(within(urgent).getByText("IT priority: Urgent")).toBeInTheDocument();
    expect(within(urgent).getByText(/Owner: Unassigned/)).toBeInTheDocument();
    expect(within(screen.getByText("Swap cable").closest("li")!).getByText("In Progress")).toBeInTheDocument();
    // Metric buttons say what they count and where they lead.
    expect(screen.getByRole("button", { name: "Cancelled: 2 Tickets, view in the Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Urgent: 3 active Tickets, view in the Ticket Queue" })).toBeInTheDocument();
  });

  it("marks required fields, ties errors to their field, and shows read-only history as text", async () => {
    mockList(list([action({ status: "COMPLETED", result: "Spooler restarted" })]));
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={801} ticketStatus="IN_PROGRESS" editable={{ currentUserId: staff.id, ticketUpdatedAt: stamp, assignees: [staff, admin], assigneesError: "", onRetryAssignees: vi.fn(), onChanged: vi.fn() }} />);
    expect(await screen.findByText("Completed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add Action/ }));
    const description = screen.getByRole("textbox", { name: /Description/ });
    expect(description).toHaveAttribute("aria-required", "true");
    expect(screen.getByRole("textbox", { name: /Attachment Notes/ })).not.toHaveAttribute("aria-required");
    await user.clear(description);
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description.getAttribute("aria-describedby")).toContain("action-description-error");
    expect(document.getElementById("action-description-error")).toHaveTextContent(/\S/);
  });
});

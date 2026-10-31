import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync } from "node:fs";
import ActionsTaken from "../../src/ActionsTaken.js";
import CreateTicket from "../../src/CreateTicket.js";
import { statusBadgeClass } from "../../src/statusBadge.js";
import RequesterDashboard from "../../src/RequesterDashboard.js";
import TicketDetail from "../../src/TicketDetail.js";
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

  it("leaves no Bootstrap blue primary class anywhere in the app", () => {
    for (const file of readdirSync(`${process.cwd()}/src`).filter((name) => name.endsWith(".tsx"))) {
      expect(source(file), file).not.toMatch(/\b(?:text-bg|btn|btn-outline|border|bg|text)-primary\b/);
    }
  });

  it("gives each Ticket status its own badge on every screen, and greens Bootstrap's focus and checked colours", () => {
    const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
    expect(statusBadgeClass("CANCELLED")).not.toBe(statusBadgeClass("RESOLVED"));
    expect(new Set(statuses.map(statusBadgeClass)).size).toBeGreaterThanOrEqual(5);
    for (const file of ["TicketDetail.tsx", "MyTickets.tsx", "StaffTicketDetail.tsx", "StaffTicketQueue.tsx"]) {
      expect(source(file), file).toMatch(/badge \$\{statusBadgeClass\(ticket\.currentStatus\)\}/);
    }
    const theme = source("theme.css");
    for (const selector of [".form-control:focus", ".form-select:focus", ".form-check-input:focus", ".form-check-input:checked", ".nav-link:focus-visible"]) {
      expect(theme, selector).toContain(selector);
    }
    expect(theme).toContain("--bs-focus-ring-color: rgba(0, 107, 60, 0.25)");
  });

  it("renders each Ticket status with its own badge on the Dashboards and Requester Detail", async () => {
    // The class names on screen, not the source text: CANCELLED must not look like RESOLVED anywhere.
    const badgeOf = (text: string) => screen.getAllByText(text).find((el) => el.classList.contains("badge"))!;
    const classesOf = (status: api.TicketStatus) => statusBadgeClass(status).split(" ");
    const ticket = (id: number, currentStatus: api.TicketStatus): api.DashboardTicket => ({
      id, ticketNumber: `TKT-${id}`, summary: `Ticket ${id}`, currentStatus, itPriority: "URGENT", owner: null, updatedAt: stamp, lastResolvedAt: null,
    });
    vi.spyOn(api, "getRequesterDashboard").mockResolvedValue({
      asOf: stamp, recentFrom: stamp, displayTimeZone: "Asia/Bangkok",
      metrics: { openTickets: 0, waitingForRequester: 0, recentlyResolved: 0 }, recentTickets: [ticket(1, "CANCELLED"), ticket(2, "RESOLVED")],
    });
    const view = render(<RequesterDashboard requesterId={41} visible onViewTickets={vi.fn()} onOpenTicket={vi.fn()} onCreateTicket={vi.fn()} onSessionExpired={vi.fn()} />);
    await screen.findByText("Ticket 1");
    expect(badgeOf("CANCELLED")).toHaveClass(...classesOf("CANCELLED"));
    expect(badgeOf("RESOLVED")).toHaveClass(...classesOf("RESOLVED"));
    expect(badgeOf("CANCELLED")).not.toHaveClass("text-bg-success");
    view.unmount();

    const zero = { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 };
    vi.spyOn(api, "getStaffDashboard").mockResolvedValue({
      asOf: stamp, recentFrom: stamp, displayTimeZone: "Asia/Bangkok",
      metrics: { unassignedTickets: 0, myTickets: 0, myActions: 0, byStatus: zero, byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 } },
      myActions: [], recentTickets: [], urgentTickets: [ticket(3, "IN_PROGRESS"), ticket(4, "NEW")],
    });
    const staffView = render(<StaffDashboard userId={31} visible onViewQueue={vi.fn()} onOpenTicket={vi.fn()} onOpenAction={vi.fn()} onViewMyActions={vi.fn()} onSessionExpired={vi.fn()} />);
    await screen.findByText("Ticket 3");
    expect(badgeOf("In Progress")).toHaveClass(...classesOf("IN_PROGRESS"));
    expect(badgeOf("New")).toHaveClass(...classesOf("NEW"));
    staffView.unmount();

    vi.spyOn(api, "getTicketDetail").mockResolvedValue({
      id: 5, ticketNumber: "TKT-5", ticketDate: stamp, requesterId: 41, categoryId: 1, relatedSystemId: 2, summary: "Cancelled ticket", description: "Gone.",
      requestedPriority: "LOW", currentStatus: "CANCELLED", problemAppearsResolved: false, problemAppearsResolvedAt: null, createdAt: stamp, updatedAt: stamp,
      requester: { id: 41, name: "Ari Suksan", email: "ari@example.com" }, category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Printing" }, attachments: [],
    } as api.TicketDetail);
    vi.spyOn(api, "getTicketComments").mockResolvedValue([]);
    render(<TicketDetail ticketId={5} onBack={vi.fn()} />);
    await screen.findByText("Cancelled ticket");
    expect(badgeOf("CANCELLED")).toHaveClass(...classesOf("CANCELLED"));
  });

  it("announces Result as required when editing a completed Action, and the cancel confirmation as required", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockList(list([action({ status: "COMPLETED", result: "Spooler restarted" }), action({ id: 502, description: "Second", version: 1 })]));
    const user = userEvent.setup();
    render(<ActionsTaken ticketId={801} ticketStatus="IN_PROGRESS" editable={{ currentUserId: staff.id, ticketUpdatedAt: stamp, assignees: [staff, admin], assigneesError: "", onRetryAssignees: vi.fn(), onChanged: vi.fn() }} />);
    expect(await screen.findByText("Completed")).toBeInTheDocument();
    const [completed, pending] = screen.getAllByRole("listitem").filter((item) => item.getAttribute("aria-label")?.startsWith("Action: "));
    await user.click(within(completed).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: /^Result/ })).toHaveAttribute("aria-required", "true");
    await user.click(screen.getByRole("button", { name: "Discard form" }));
    await user.click(within(pending).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: /^Result/ })).not.toHaveAttribute("aria-required");
    await user.click(screen.getByRole("button", { name: "Discard form" }));
    await user.click(within(pending).getByRole("button", { name: "Cancel Action" }));
    expect(screen.getByRole("checkbox", { name: /I confirm cancelling this Action/ })).toHaveAttribute("aria-required", "true");
  });

  it("announces every Create Ticket field marked * as required", async () => {
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 2, name: "Printing" }]);
    const { container } = render(<CreateTicket requester={{ name: "Ari Suksan", email: "ari@example.com" } as never} />);
    await screen.findByRole("option", { name: "Hardware" });
    const starred = [...container.querySelectorAll("label")].filter((label) => label.querySelector(".text-danger"));
    expect(starred.length).toBe(5);
    for (const label of starred) expect(document.getElementById(label.htmlFor), label.textContent!).toHaveAttribute("aria-required", "true");
  });
});

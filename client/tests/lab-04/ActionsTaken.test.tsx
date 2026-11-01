import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionsTaken from "../../src/ActionsTaken.js";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";
import { action, admin, deferred, list, mockList, staff, stamp } from "./actionFixtures.js";

afterEach(() => vi.restoreAllMocks());

function renderStaff(items: api.ActionTaken[], options: { ticketStatus?: api.TicketStatus; assignees?: api.StaffUser[]; assigneesError?: string } = {}) {
  mockList(list(items));
  const onChanged = vi.fn();
  const onRetryAssignees = vi.fn();
  const user = userEvent.setup();
  const props = {
    ticketId: 801,
    ticketStatus: options.ticketStatus ?? ("IN_PROGRESS" as api.TicketStatus),
    editable: {
      currentUserId: staff.id, ticketUpdatedAt: stamp, assignees: options.assignees ?? [staff, admin],
      assigneesError: options.assigneesError ?? "", onRetryAssignees, onChanged,
    },
  };
  const view = render(<ActionsTaken {...props} />);
  return { user, onChanged, onRetryAssignees, props, view };
}

const saved = (overrides: Partial<api.ActionTaken> = {}, replayed = false): api.ActionWriteResponse =>
  ({ action: action(overrides), ticketUpdatedAt: "2026-10-30T03:00:00.000Z", replayed });
const card = (description: string) => screen.getByRole("listitem", { name: `Action: ${description}` });
const buttonsIn = (element: HTMLElement) => within(element).getAllByRole("button").map((button) => button.textContent);

describe("Actions Taken for Staff and Administrators (UI-01)", () => {
  it("shows every Action field, keeps performer, assignee and statuses distinct, and supports several Actions", async () => {
    renderStaff([
      action({ result: "Spooler running", status: "COMPLETED", followUpRequired: true, followUpNote: "Check tomorrow", attachmentNotes: "See error.png", version: 3 }),
      action({ id: 502, description: "Replace toner", status: "IN_PROGRESS" }),
      action({ id: 503, description: "Order a spare", status: "CANCELLED", cancellationReason: "Toner was enough" }),
    ]);
    const first = await screen.findByRole("listitem", { name: "Action: Restarted the print spooler" });
    expect(within(first).getByText("Completed")).toHaveClass("badge");
    expect(within(first).getByText("Performed by").nextElementSibling).toHaveTextContent(admin.name);
    expect(within(first).getByText("Assigned to").nextElementSibling).toHaveTextContent(staff.name);
    expect(within(first).getByText("Spooler running")).toBeInTheDocument();
    expect(within(first).getByText("Yes: Check tomorrow")).toBeInTheDocument();
    expect(within(first).getByText("See error.png")).toBeInTheDocument();
    expect(within(first).getByText("Version 3")).toBeInTheDocument();
    expect(within(first).getByText("Action Date/Time").nextElementSibling).toHaveTextContent("(Bangkok)");
    expect(within(card("Replace toner")).getByText("In progress")).toBeInTheDocument();
    expect(within(card("Order a spare")).getByText("Toner was enough")).toBeInTheDocument();
  });

  it("offers only the permitted lifecycle controls for each Action status", async () => {
    renderStaff([
      action({ description: "Planned work" }),
      action({ id: 502, description: "Started work", status: "IN_PROGRESS" }),
      action({ id: 503, description: "Done work", status: "COMPLETED", result: "Fixed" }),
      action({ id: 504, description: "Dropped work", status: "CANCELLED", cancellationReason: "Duplicate" }),
    ]);
    await screen.findByText("Planned work");
    expect(buttonsIn(card("Planned work"))).toEqual(["View History", "Edit", "Reassign", "Start", "Complete", "Cancel Action"]);
    expect(buttonsIn(card("Started work"))).toEqual(["View History", "Edit", "Reassign", "Complete", "Cancel Action"]);
    expect(buttonsIn(card("Done work"))).toEqual(["View History", "Edit", "Reassign"]);
    expect(buttonsIn(card("Dropped work"))).toEqual(["View History"]);
  });

  it("disables every Action change on a resolved, closed or cancelled Ticket and says to reopen", async () => {
    renderStaff([action()], { ticketStatus: "CLOSED" });
    await screen.findByText("Restarted the print spooler");
    expect(screen.getByText(/Actions cannot change while the Ticket is CLOSED. Reopen the Ticket first/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
    expect(buttonsIn(card("Restarted the print spooler"))).toEqual(["View History"]);
  });

  it("creates an Action with the current user as default assignee and a Bangkok-offset date", async () => {
    const { user, onChanged } = renderStaff([]);
    await screen.findByText("No Actions have been recorded yet.");
    const write = vi.spyOn(api, "writeActionTaken").mockResolvedValue(saved({ id: 600, description: "Checked cabling" }));
    await user.click(screen.getByRole("button", { name: "Add Action" }));
    expect(screen.getByRole("combobox", { name: "Assigned to" })).toHaveValue(String(staff.id));
    expect(screen.getByLabelText(/^Action Date\/Time \(Bangkok\)/)).not.toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(write).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveAccessibleDescription("Describe the action.");

    await user.type(screen.getByRole("textbox", { name: "Description" }), "Checked cabling");
    await user.selectOptions(screen.getByRole("combobox", { name: "Assigned to" }), String(admin.id));
    await user.clear(screen.getByLabelText(/^Action Date\/Time \(Bangkok\)/));
    await user.type(screen.getByLabelText(/^Action Date\/Time \(Bangkok\)/), "2026-10-30T08:45:00");
    await user.type(screen.getByRole("textbox", { name: "Attachment Notes" }), "See photo.jpg");
    await user.click(screen.getByRole("button", { name: "Save Action" }));

    expect(write).toHaveBeenCalledWith("POST", "/api/tickets/801/actions-taken", expect.objectContaining({
      ticketUpdatedAt: stamp, actionAt: "2026-10-30T08:45:00+07:00", description: "Checked cabling", assigneeId: admin.id,
      followUpRequired: false, followUpNote: null, attachmentNotes: "See photo.jpg",
    }));
    expect(write.mock.calls[0][2].mutationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText("Action added.")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledWith("2026-10-30T03:00:00.000Z");
    expect(screen.queryByRole("button", { name: "Save Action" })).not.toBeInTheDocument();
  });

  it("requires a follow-up note when follow-up is on and asks before discarding a written note", async () => {
    const { user } = renderStaff([]);
    await user.click(await screen.findByRole("button", { name: "Add Action" }));
    await user.click(screen.getByRole("checkbox", { name: "Follow-Up Required?" }));
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Swap cable");
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(screen.getByRole("textbox", { name: "Follow-up Note" })).toHaveAccessibleDescription("Describe the required follow-up.");

    await user.type(screen.getByRole("textbox", { name: "Follow-up Note" }), "Call the user");
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await user.click(screen.getByRole("checkbox", { name: "Follow-Up Required?" }));
    expect(screen.getByRole("textbox", { name: "Follow-up Note" })).toHaveValue("Call the user");
    await user.click(screen.getByRole("checkbox", { name: "Follow-Up Required?" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("textbox", { name: "Follow-up Note" })).not.toBeInTheDocument();
  });

  it("completes with a required result and cancels with a reason and explicit confirmation", async () => {
    const { user } = renderStaff([action({ version: 2 })]);
    const write = vi.spyOn(api, "writeActionTaken").mockResolvedValue(saved({ status: "COMPLETED", result: "Fixed", version: 3 }));
    await user.click(await screen.findByRole("button", { name: "Complete" }));
    await user.click(screen.getByRole("button", { name: "Complete Action" }));
    expect(screen.getByRole("textbox", { name: "Result (required to complete)" })).toHaveAccessibleDescription("Record the result before completing.");
    await user.type(screen.getByRole("textbox", { name: "Result (required to complete)" }), "Fixed");
    await user.click(screen.getByRole("button", { name: "Complete Action" }));
    expect(write).toHaveBeenLastCalledWith("PATCH", "/api/tickets/801/actions-taken/501/status", expect.objectContaining({
      ticketUpdatedAt: stamp, version: 2, status: "COMPLETED", result: "Fixed", followUpRequired: false, followUpNote: null,
    }));

    await screen.findByText("Action completed.");
    await user.click(screen.getByRole("button", { name: "Cancel Action" }));
    expect(screen.getByRole("heading", { name: /^Cancel Action:/ })).toHaveFocus();
    await user.type(screen.getByRole("textbox", { name: "Cancellation Reason" }), "No");
    await user.click(screen.getByRole("button", { name: "Cancel this Action" }));
    expect(screen.getByRole("textbox", { name: "Cancellation Reason" })).toHaveAccessibleDescription("Give a reason of 5 to 500 characters.");
    expect(screen.getByRole("checkbox", { name: /I confirm cancelling this Action/ })).toHaveAccessibleDescription("Confirm that you want to cancel this Action.");
    await user.type(screen.getByRole("textbox", { name: "Cancellation Reason" }), "t needed any more");
    await user.click(screen.getByRole("checkbox", { name: /I confirm cancelling this Action/ }));
    await user.click(screen.getByRole("button", { name: "Cancel this Action" }));
    expect(write).toHaveBeenLastCalledWith("PATCH", "/api/tickets/801/actions-taken/501/status", expect.objectContaining({
      status: "CANCELLED", confirm: true, cancellationReason: "Not needed any more",
    }));
  });

  it("edits only the changed fields, keeps status read-only and allows clearing settled follow-up on completed work", async () => {
    const done = action({ status: "COMPLETED", result: "Fixed", followUpRequired: true, followUpNote: "Recheck", version: 4 });
    const { user } = renderStaff([done]);
    const write = vi.spyOn(api, "writeActionTaken").mockResolvedValue(saved({ ...done, followUpRequired: false, followUpNote: null, version: 5 }));
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByText(/status Completed \(read-only here\)/)).toBeInTheDocument();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("checkbox", { name: "Follow-Up Required?" }));
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    const body = write.mock.calls[0][2];
    expect(Object.keys(body).sort()).toEqual(["followUpNote", "followUpRequired", "mutationId", "ticketUpdatedAt", "version"]);
    expect(body).toMatchObject({ version: 4, followUpRequired: false, followUpNote: null });
  });

  it("flags an inactive assignee, allows only reassign and cancel, and shows a server assignee rejection beside the field", async () => {
    const inactive = action({ assignee: { id: 77, name: "Former Staff", role: "IT_STAFF", isActive: false } });
    const { user } = renderStaff([inactive]);
    const item = await screen.findByRole("listitem", { name: "Action: Restarted the print spooler" });
    expect(within(item).getByText("Not eligible: reassign first")).toBeInTheDocument();
    for (const name of ["Edit", "Start", "Complete"]) expect(within(item).getByRole("button", { name })).toBeDisabled();
    for (const name of ["Reassign", "Cancel Action"]) expect(within(item).getByRole("button", { name })).toBeEnabled();

    await user.click(within(item).getByRole("button", { name: "Reassign" }));
    const picker = screen.getByRole("combobox", { name: "Assigned to" });
    expect(within(picker).getByRole("option", { name: "Former Staff (not eligible)" })).toBeDisabled();
    await user.selectOptions(picker, String(admin.id));
    vi.spyOn(api, "writeActionTaken").mockRejectedValue(new api.ApiRequestError("Validation failed", 400, "VALIDATION_FAILED", {
      fieldErrors: { assigneeId: "Choose an active IT Staff member or Administrator." },
    }));
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByText(/The Action was not saved/)).toBeInTheDocument();
    expect(picker).toHaveAccessibleDescription("Choose an active IT Staff member or Administrator.");
    expect(picker).toHaveValue(String(admin.id));
  });

  it("gives the assignee list its own retry state and blocks saving an incomplete create form", async () => {
    const { user, onRetryAssignees } = renderStaff([], { assignees: [], assigneesError: "failed" });
    await user.click(await screen.findByRole("button", { name: "Add Action" }));
    expect(screen.getByText(/Eligible assignees could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Action" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry loading assignees" }));
    expect(onRetryAssignees).toHaveBeenCalledOnce();
  });
});

describe("Actions Taken write safety (UI-04)", () => {
  async function openEdit() {
    const env = renderStaff([action()]);
    await env.user.click(await screen.findByRole("button", { name: "Edit" }));
    await env.user.type(screen.getByRole("textbox", { name: "Description" }), " again");
    return env;
  }

  it("sends one request for a double click while saving", async () => {
    const { user } = await openEdit();
    const pending = deferred<api.ActionWriteResponse>();
    const write = vi.spyOn(api, "writeActionTaken").mockReturnValue(pending.promise);
    const save = screen.getByRole("button", { name: "Save Action" });
    await user.dblClick(save);
    expect(write).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    pending.resolve(saved({ description: "Restarted the print spooler again", version: 2 }));
    expect(await screen.findByText("Action updated.")).toBeInTheDocument();
  });

  it("keeps the draft and request id across a network retry, and uses a new id once the draft changes", async () => {
    const { user } = await openEdit();
    const write = vi.spyOn(api, "writeActionTaken").mockRejectedValue(new TypeError("Failed to fetch"));
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByText(/network or server problem. Your draft is kept/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Restarted the print spooler again");
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(write.mock.calls[1][2].mutationId).toBe(write.mock.calls[0][2].mutationId);

    await user.type(screen.getByRole("textbox", { name: "Description" }), "!");
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(3));
    expect(write.mock.calls[2][2].mutationId).not.toBe(write.mock.calls[0][2].mutationId);
  });

  it("keeps a draft and its text after a server error", async () => {
    const { user } = await openEdit();
    vi.spyOn(api, "writeActionTaken").mockRejectedValue(new api.ApiRequestError("Unable to process the Action request", 500));
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your draft is kept");
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("Restarted the print spooler again");
  });

  it("on a stale conflict keeps the draft, clears the cancel confirmation and only resubmits after Load Latest and review", async () => {
    const { user, onChanged } = renderStaff([action()]);
    await user.click(await screen.findByRole("button", { name: "Cancel Action" }));
    await user.type(screen.getByRole("textbox", { name: "Cancellation Reason" }), "Duplicate request");
    await user.click(screen.getByRole("checkbox", { name: /I confirm/ }));
    const write = vi.spyOn(api, "writeActionTaken").mockRejectedValueOnce(
      new api.ApiRequestError("This Ticket or Action changed since it was loaded.", 409, "STALE_STATE"),
    );
    await user.click(screen.getByRole("button", { name: "Cancel this Action" }));
    expect(await screen.findByText(/changed after you loaded it. Your draft is kept/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Cancellation Reason" })).toHaveValue("Duplicate request");
    expect(screen.getByRole("checkbox", { name: /I confirm/ })).not.toBeChecked();

    mockList(list([action({ version: 2, description: "Restarted the print spooler (edited by someone else)" })]));
    await user.click(screen.getByRole("button", { name: "Load Latest" }));
    expect(await screen.findByText("Restarted the print spooler (edited by someone else)")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
    expect(write).toHaveBeenCalledOnce();

    write.mockResolvedValue(saved({ status: "CANCELLED", version: 3, cancellationReason: "Duplicate request" }));
    await user.click(screen.getByRole("checkbox", { name: /I confirm/ }));
    await user.click(screen.getByRole("button", { name: "Cancel this Action" }));
    expect(write.mock.calls[1][2]).toMatchObject({ version: 2, cancellationReason: "Duplicate request" });
    expect(write.mock.calls[1][2].mutationId).not.toBe(write.mock.calls[0][2].mutationId);
  });

  it("treats a replayed save as already done and reloads the latest values", async () => {
    const { user } = await openEdit();
    const reload = mockList(list([action({ description: "Restarted the print spooler again", version: 2 })]));
    vi.spyOn(api, "writeActionTaken").mockResolvedValue(saved({ version: 2 }, true));
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByText("This change had already been saved. The latest values are shown.")).toBeInTheDocument();
    expect(reload).toHaveBeenCalled();
    await waitFor(() => expect(card("Restarted the print spooler again")).toHaveFocus());
  });

  it("refreshes the Ticket timestamp and resolution readiness after an Action is saved", async () => {
    const gateBefore = { canResolve: false, completedActions: 0, pendingActions: 1, unsettledFollowUpActions: 0 };
    const ticket = {
      id: 801, ticketNumber: "TKT-20261030-000801", ticketDate: "2026-10-30T01:00:00.000Z", requesterId: 41, categoryId: 1, relatedSystemId: 2,
      ownerId: staff.id, summary: "Printer offline", description: "The printer does not respond.", requestedPriority: "MEDIUM", itPriority: "HIGH",
      currentStatus: "IN_PROGRESS", updatedAt: stamp, createdAt: "2026-10-30T01:00:00.000Z", problemAppearsResolved: false, problemAppearsResolvedAt: null,
      lastResolvedAt: null, resolutionGate: gateBefore, requester: { id: 41, name: "Ari Suksan", email: "ari@example.com" }, owner: staff,
      category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Printing" }, attachments: [], publicComments: [], internalNotes: [],
    } satisfies api.StaffTicketDetailData;
    vi.spyOn(api, "getStaffTicketDetail")
      .mockResolvedValueOnce(ticket)
      .mockResolvedValue({ ...ticket, updatedAt: "2026-10-30T03:00:00.000Z", resolutionGate: { ...gateBefore, canResolve: true, completedActions: 1, pendingActions: 0 } });
    vi.spyOn(api, "getStaffAssignees").mockResolvedValue([staff]);
    mockList(list([action()]));
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketId={801} currentUserId={staff.id} onBack={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Complete" }));
    await user.type(screen.getByRole("textbox", { name: "Result (required to complete)" }), "Fixed");
    vi.spyOn(api, "writeActionTaken").mockResolvedValue(saved({ status: "COMPLETED", result: "Fixed", version: 2 }));
    await user.click(screen.getByRole("button", { name: "Complete Action" }));
    expect(await screen.findByText("Ready to resolve.")).toBeInTheDocument();
    expect(screen.getByText("Completed Actions: 1")).toBeInTheDocument();
  });

  it("after Load Latest, Edit sends only the user's own change, so another user's newer value survives", async () => {
    const { user } = renderStaff([action({ result: "" })]);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.type(screen.getByRole("textbox", { name: "Attachment Notes" }), "See cable.jpg");
    const write = vi.spyOn(api, "writeActionTaken").mockRejectedValueOnce(new api.ApiRequestError("changed", 409, "STALE_STATE"));
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    await screen.findByRole("button", { name: "Load Latest" });

    mockList(list([action({ description: "Restarted spooler and cleared queue", result: "Queue empty", version: 2 })]));
    await user.click(screen.getByRole("button", { name: "Load Latest" }));
    expect(await screen.findByText("Restarted spooler and cleared queue")).toBeInTheDocument();
    write.mockResolvedValue(saved({ version: 3 }));
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    const body = write.mock.calls[1][2];
    expect(Object.keys(body).sort()).toEqual(["attachmentNotes", "mutationId", "ticketUpdatedAt", "version"]);
    expect(body).toMatchObject({ version: 2, attachmentNotes: "See cable.jpg" });
  });

  it("ignores a write that finishes after the user switched to another Ticket", async () => {
    const { user, onChanged, props, view } = renderStaff([action()]);
    const pending = deferred<api.ActionWriteResponse>();
    vi.spyOn(api, "writeActionTaken").mockReturnValue(pending.promise);
    await user.click(await screen.findByRole("button", { name: "Start" }));
    mockList(list([action({ id: 900, ticketId: 802, description: "Second Ticket work" })]));
    view.rerender(<ActionsTaken key={802} {...props} ticketId={802} />);
    expect(await screen.findByText("Second Ticket work")).toBeInTheDocument();
    pending.resolve(saved({ status: "IN_PROGRESS", version: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.queryByText("Action started.")).not.toBeInTheDocument();
  });

  it("shows only the history that was asked for last when an earlier history request returns late", async () => {
    const { user } = renderStaff([action(), action({ id: 502, description: "Replace toner" })]);
    const late = deferred<{ items: api.ActionRevision[]; pagination: api.Pagination }>();
    const revision = (description: string) => ({
      version: 1, operation: "CREATE" as const, actor: { id: admin.id, name: admin.name }, createdAt: stamp, snapshot: action({ description }),
    });
    vi.spyOn(api, "getActionRevisions").mockImplementation((_ticketId, actionId) => actionId === 501
      ? late.promise
      : Promise.resolve({ items: [revision("Toner history")], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } }));
    await user.click(within(await screen.findByRole("listitem", { name: "Action: Restarted the print spooler" })).getByRole("button", { name: "View History" }));
    await user.click(within(card("Replace toner")).getByRole("button", { name: "View History" }));
    expect(await screen.findByText(/Toner history/)).toBeInTheDocument();
    await act(async () => late.resolve({ items: [revision("Spooler history")], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } }));
    expect(screen.queryByText(/Spooler history/)).not.toBeInTheDocument();
    expect(within(card("Replace toner")).getByRole("heading", { name: "History for this Action" })).toBeInTheDocument();
  });

  it("keeps the newest Ticket timestamp when an older detail refresh lands late", async () => {
    const base = {
      id: 801, ticketNumber: "TKT-20261030-000801", ticketDate: "2026-10-30T01:00:00.000Z", requesterId: 41, categoryId: 1, relatedSystemId: 2,
      ownerId: staff.id, summary: "Printer offline", description: "The printer does not respond.", requestedPriority: "MEDIUM", itPriority: "HIGH",
      currentStatus: "IN_PROGRESS", updatedAt: stamp, createdAt: "2026-10-30T01:00:00.000Z", problemAppearsResolved: false, problemAppearsResolvedAt: null,
      lastResolvedAt: null, requester: { id: 41, name: "Ari Suksan", email: "ari@example.com" }, owner: staff,
      category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Printing" }, attachments: [], publicComments: [], internalNotes: [],
    } satisfies api.StaffTicketDetailData;
    const first = deferred<api.StaffTicketDetailData>();
    vi.spyOn(api, "getStaffTicketDetail")
      .mockResolvedValueOnce(base)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue({ ...base, updatedAt: "2026-10-30T05:00:00.000Z" });
    vi.spyOn(api, "getStaffAssignees").mockResolvedValue([staff]);
    mockList(list([action()]));
    const write = vi.spyOn(api, "writeActionTaken")
      .mockResolvedValueOnce({ ...saved(), ticketUpdatedAt: "2026-10-30T04:00:00.000Z" })
      .mockResolvedValue({ ...saved(), ticketUpdatedAt: "2026-10-30T05:00:00.000Z" });
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketId={801} currentUserId={staff.id} onBack={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Start" }));
    await screen.findByText("Action started.");
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("Last Updated").nextElementSibling).toHaveTextContent(new Date("2026-10-30T05:00:00.000Z").toLocaleString()));
    first.resolve({ ...base, updatedAt: "2026-10-30T04:00:00.000Z" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(3));
    expect(write.mock.calls[2][2].ticketUpdatedAt).toBe("2026-10-30T05:00:00.000Z");
  });

  it.each(["Ticket save", "public comment", "internal note"])("restarts an Action refresh that was in flight during a %s: no rollback, and the new gate still arrives", async (change) => {
    const blocked = { canResolve: false, completedActions: 0, pendingActions: 1, unsettledFollowUpActions: 0 };
    const ready = { canResolve: true, completedActions: 1, pendingActions: 0, unsettledFollowUpActions: 0 };
    const savedAt = "2026-10-30T06:00:00.000Z";
    const author = { id: staff.id, name: staff.name, email: staff.email };
    const base = {
      id: 801, ticketNumber: "TKT-20261030-000801", ticketDate: "2026-10-30T01:00:00.000Z", requesterId: 41, categoryId: 1, relatedSystemId: 2,
      ownerId: staff.id, summary: "Printer offline", description: "The printer does not respond.", requestedPriority: "MEDIUM", itPriority: "HIGH",
      currentStatus: "IN_PROGRESS", updatedAt: stamp, createdAt: "2026-10-30T01:00:00.000Z", problemAppearsResolved: false, problemAppearsResolvedAt: null,
      lastResolvedAt: null, resolutionGate: blocked, requester: { id: 41, name: "Ari Suksan", email: "ari@example.com" }, owner: staff,
      category: { id: 1, name: "Hardware" }, relatedSystem: { id: 2, name: "Printing" }, attachments: [], publicComments: [], internalNotes: [],
    } satisfies api.StaffTicketDetailData;
    const comment = { id: 70, content: "On my way", createdAt: savedAt, author };
    // What the server holds after the Action write, then after the save/comment/note.
    const afterAction = { ...base, updatedAt: "2026-10-30T04:00:00.000Z", resolutionGate: ready };
    const afterChange = {
      ...afterAction,
      ...(change === "Ticket save" ? { itPriority: "URGENT" as const, updatedAt: savedAt } : {}),
      ...(change === "public comment" ? { publicComments: [comment] } : {}),
      ...(change === "internal note" ? { internalNotes: [comment] } : {}),
    };
    const inFlight = deferred<api.StaffTicketDetailData>();
    const detail = vi.spyOn(api, "getStaffTicketDetail").mockResolvedValueOnce(base).mockReturnValueOnce(inFlight.promise).mockResolvedValue(afterChange);
    vi.spyOn(api, "getStaffAssignees").mockResolvedValue([staff]);
    mockList(list([action()]));
    const write = vi.spyOn(api, "writeActionTaken").mockResolvedValue({ ...saved(), ticketUpdatedAt: afterAction.updatedAt });
    vi.spyOn(api, "updateStaffTicketPriority").mockResolvedValue({
      id: 801, ownerId: staff.id, owner: staff, itPriority: "URGENT", currentStatus: "IN_PROGRESS", problemAppearsResolved: false, updatedAt: savedAt,
    });
    vi.spyOn(api, "addPublicComment").mockResolvedValue(comment);
    vi.spyOn(api, "addInternalNote").mockResolvedValue(comment);
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketId={801} currentUserId={staff.id} onBack={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Start" }));
    await screen.findByText("Action started.");
    if (change === "Ticket save") {
      await user.selectOptions(screen.getByRole("combobox", { name: "IT Priority" }), "URGENT");
      await user.click(screen.getByRole("button", { name: "Save IT Priority" }));
      await screen.findByText("IT Priority was updated.");
    } else if (change === "public comment") {
      await user.type(screen.getByRole("textbox", { name: "Add a public comment" }), "On my way");
      await user.click(screen.getByRole("button", { name: "Post Public Comment" }));
      await screen.findByText("Public comment posted.");
    } else {
      await user.type(screen.getByRole("textbox", { name: "Add an internal note" }), "On my way");
      await user.click(screen.getByRole("button", { name: "Post Internal Note" }));
      await screen.findByText("Internal note posted.");
    }
    expect(await screen.findByText("Ready to resolve.")).toBeInTheDocument();
    expect(detail).toHaveBeenCalledTimes(3);

    // The refresh that started before the change now lands with older values and must be ignored.
    await act(async () => inFlight.resolve({ ...afterAction, resolutionGate: blocked, updatedAt: "2026-10-30T03:00:00.000Z" }));
    expect(screen.getByText("Ready to resolve.")).toBeInTheDocument();
    if (change !== "Ticket save") expect(screen.getByText("On my way")).toBeInTheDocument();
    const expectedStamp = change === "Ticket save" ? savedAt : afterAction.updatedAt;
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(write.mock.calls[1][2].ticketUpdatedAt).toBe(expectedStamp);
  });
});

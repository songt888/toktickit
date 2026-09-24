import { useEffect, useRef, useState } from "react";
import {
  ApiRequestError,
  getStaffAssignees,
  getStaffTicketDetail,
  StaffTicketDetailData,
  StaffUser,
  TicketPriority,
  TicketStatus,
  updateStaffTicketOwner,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
} from "./api.js";

type DetailState = "loading" | "success" | "error";
type Feedback = { kind: "success" | "error"; message: string; refresh?: boolean };

export interface StaffTicketDetailProps {
  ticketId: number;
  currentUserId: number;
  onBack: () => void;
}

const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const permittedNextStatuses: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "REOPENED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  CANCELLED: ["REOPENED"],
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function priorityBadgeClass(priority: TicketPriority): string {
  switch (priority) {
    case "LOW": return "text-bg-secondary";
    case "MEDIUM": return "text-bg-info";
    case "HIGH": return "text-bg-warning text-dark";
    case "URGENT": return "text-bg-danger";
  }
}

function statusBadgeClass(status: TicketStatus): string {
  switch (status) {
    case "NEW": return "text-bg-primary";
    case "IN_PROGRESS": return "text-bg-warning text-dark";
    case "RESOLVED": return "text-bg-success";
    case "CLOSED": return "text-bg-dark";
    case "CANCELLED": return "text-bg-danger";
    default: return "text-bg-secondary";
  }
}

function errorFeedback(error: unknown): Feedback {
  if (error instanceof ApiRequestError && error.status === 409) {
    return {
      kind: "error",
      message: "This Ticket changed after you opened it. Refresh the details before making another change.",
      refresh: true,
    };
  }
  return {
    kind: "error",
    message: error instanceof Error ? error.message : "Unable to update this Ticket.",
  };
}

export default function StaffTicketDetail({ ticketId, currentUserId, onBack }: StaffTicketDetailProps) {
  const requestSequence = useRef(0);
  const [ticket, setTicket] = useState<StaffTicketDetailData | null>(null);
  const [assignees, setAssignees] = useState<StaffUser[]>([]);
  const [assigneesError, setAssigneesError] = useState("");
  const [state, setState] = useState<DetailState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority | "">("");
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadDetail() {
    const sequence = ++requestSequence.current;
    setState("loading");
    setErrorMessage("");
    setErrorStatus(null);
    setFeedback(null);

    const [detailResult, assigneeResult] = await Promise.allSettled([
      getStaffTicketDetail(ticketId),
      getStaffAssignees(),
    ]);
    if (sequence !== requestSequence.current) return;

    if (detailResult.status === "rejected") {
      const error = detailResult.reason;
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load operational ticket detail.");
      setErrorStatus(error instanceof ApiRequestError ? error.status : null);
      return;
    }

    const loadedTicket = detailResult.value;
    setTicket(loadedTicket);
    setSelectedOwnerId(loadedTicket.ownerId === null ? "" : String(loadedTicket.ownerId));
    setSelectedPriority(loadedTicket.itPriority);
    setSelectedStatus(loadedTicket.currentStatus);
    if (assigneeResult.status === "fulfilled") {
      setAssignees(assigneeResult.value);
      setAssigneesError("");
    } else {
      setAssignees([]);
      setAssigneesError("Eligible assignees could not be loaded. You can still claim or unassign this Ticket.");
    }
    setState("success");
  }

  useEffect(() => {
    void loadDetail();
    return () => {
      requestSequence.current += 1;
    };
  }, [ticketId]);

  async function saveMutation(
    operation: () => ReturnType<typeof updateStaffTicketOwner>,
    successMessage: string,
  ) {
    if (!ticket) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await operation();
      setTicket((current) => current ? { ...current, ...updated } : current);
      setSelectedOwnerId(updated.ownerId === null ? "" : String(updated.ownerId));
      setSelectedPriority(updated.itPriority);
      setSelectedStatus(updated.currentStatus);
      setFeedback({ kind: "success", message: successMessage });
    } catch (error) {
      setFeedback(errorFeedback(error));
    } finally {
      setSaving(false);
    }
  }

  function changeOwner(ownerId: number | null, message: string) {
    if (!ticket) return;
    void saveMutation(
      () => updateStaffTicketOwner(ticket.id, ownerId, ticket.updatedAt),
      message,
    );
  }

  function changePriority() {
    if (!ticket || !selectedPriority || selectedPriority === ticket.itPriority) return;
    void saveMutation(
      () => updateStaffTicketPriority(ticket.id, selectedPriority, ticket.updatedAt),
      "IT Priority was updated.",
    );
  }

  function changeStatus() {
    if (!ticket || !selectedStatus || selectedStatus === ticket.currentStatus) return;
    const confirm = selectedStatus === "CLOSED" || selectedStatus === "CANCELLED";
    if (confirm && !window.confirm(`Confirm changing this Ticket to ${selectedStatus}?`)) return;
    void saveMutation(
      () => updateStaffTicketStatus(ticket.id, selectedStatus, confirm, ticket.updatedAt),
      `Ticket status was updated to ${selectedStatus}.`,
    );
  }

  const currentOwnerIsListed = ticket?.owner && assignees.some((user) => user.id === ticket.owner?.id);

  return (
    <section id="staff-ticket-detail" className="card border-0 shadow-sm mb-4" aria-labelledby="staff-ticket-detail-title">
      <div className="card-body">
        <button className="btn btn-outline-secondary mb-3" type="button" onClick={onBack}>
          Back to Ticket Queue
        </button>
        <h2 id="staff-ticket-detail-title" className="h4 mb-3">Operational Ticket Detail</h2>

        {state === "loading" && <p role="status">Loading Operational Ticket Detail…</p>}

        {state === "error" && (
          <div className="alert alert-danger" role="alert">
            <p className="mb-2">
              {errorStatus === 403
                ? "You do not have permission to view this Ticket."
                : errorStatus === 404
                  ? "Ticket not found."
                  : errorMessage}
            </p>
            <button className="btn btn-outline-danger" type="button" onClick={() => void loadDetail()}>
              Try again
            </button>
          </div>
        )}

        {state === "success" && ticket && (
          <>
            {feedback && (
              <div className={`alert ${feedback.kind === "success" ? "alert-success" : "alert-danger"}`} role={feedback.kind === "success" ? "status" : "alert"}>
                <span>{feedback.message}</span>
                {feedback.refresh && (
                  <button className="btn btn-sm btn-outline-danger ms-2" type="button" onClick={() => void loadDetail()}>
                    Refresh Ticket
                  </button>
                )}
              </div>
            )}

            <section className="border rounded p-3 mb-4" aria-labelledby="staff-ticket-information-title">
              <h3 id="staff-ticket-information-title" className="h5 mb-3">Ticket Information</h3>
              <dl className="row mb-0">
                <dt className="col-sm-4">Ticket Number</dt>
                <dd className="col-sm-8">{ticket.ticketNumber}</dd>
                <dt className="col-sm-4">Created</dt>
                <dd className="col-sm-8">{formatDate(ticket.ticketDate)}</dd>
                <dt className="col-sm-4">Requester</dt>
                <dd className="col-sm-8">{ticket.requester.name} ({ticket.requester.email})</dd>
                <dt className="col-sm-4">Category</dt>
                <dd className="col-sm-8">{ticket.category.name}</dd>
                <dt className="col-sm-4">Related System</dt>
                <dd className="col-sm-8">{ticket.relatedSystem.name}</dd>
                <dt className="col-sm-4">Owner</dt>
                <dd className="col-sm-8">{ticket.owner?.name ?? "Unassigned"}</dd>
                <dt className="col-sm-4">Requested Priority</dt>
                <dd className="col-sm-8"><span className={`badge ${priorityBadgeClass(ticket.requestedPriority)}`}>{ticket.requestedPriority}</span></dd>
                <dt className="col-sm-4">IT Priority</dt>
                <dd className="col-sm-8"><span className={`badge ${priorityBadgeClass(ticket.itPriority)}`}>{ticket.itPriority}</span></dd>
                <dt className="col-sm-4">Current Status</dt>
                <dd className="col-sm-8"><span className={`badge ${statusBadgeClass(ticket.currentStatus)}`}>{ticket.currentStatus}</span></dd>
                <dt className="col-sm-4">Problem Appears Resolved</dt>
                <dd className="col-sm-8">{ticket.problemAppearsResolved ? "Yes" : "No"}</dd>
                <dt className="col-sm-4">Summary</dt>
                <dd className="col-sm-8">{ticket.summary}</dd>
                <dt className="col-sm-4">Description</dt>
                <dd className="col-sm-8" style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</dd>
                <dt className="col-sm-4">Last Updated</dt>
                <dd className="col-sm-8">{formatDate(ticket.updatedAt)}</dd>
              </dl>
            </section>

            <section className="border rounded p-3 mb-4" aria-labelledby="staff-ticket-controls-title">
              <h3 id="staff-ticket-controls-title" className="h5 mb-3">Operational Controls</h3>
              <div className="row g-3 align-items-end">
                <div className="col-12 col-lg-7">
                  <label className="form-label fw-semibold" htmlFor="staff-assignee">Assign to</label>
                  <select
                    id="staff-assignee"
                    className="form-select"
                    value={selectedOwnerId}
                    disabled={saving || Boolean(assigneesError)}
                    onChange={(event) => setSelectedOwnerId(event.target.value)}
                  >
                    <option value="">Choose an active Staff or Administrator</option>
                    {ticket.owner && !currentOwnerIsListed && (
                      <option value={ticket.owner.id} disabled>{ticket.owner.name} (not eligible)</option>
                    )}
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>{assignee.name} — {assignee.role}</option>
                    ))}
                  </select>
                  {assigneesError && <p className="form-text text-danger mb-0" role="status">{assigneesError}</p>}
                </div>
                <div className="col-12 col-lg-5 d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-success"
                    type="button"
                    disabled={saving || !selectedOwnerId || Number(selectedOwnerId) === ticket.ownerId}
                    onClick={() => changeOwner(Number(selectedOwnerId), ticket.ownerId === null ? "Ticket assigned." : "Ticket reassigned.")}
                  >
                    {ticket.ownerId === null ? "Assign Ticket" : "Reassign Ticket"}
                  </button>
                  {ticket.ownerId === null && (
                    <button className="btn btn-outline-success" type="button" disabled={saving} onClick={() => changeOwner(currentUserId, "You claimed this Ticket.")}>
                      Claim Ticket
                    </button>
                  )}
                  {ticket.ownerId !== null && (
                    <button className="btn btn-outline-secondary" type="button" disabled={saving} onClick={() => changeOwner(null, "Ticket unassigned.")}>
                      Unassign
                    </button>
                  )}
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="staff-ticket-priority">IT Priority</label>
                  <select
                    id="staff-ticket-priority"
                    className="form-select"
                    value={selectedPriority}
                    disabled={saving}
                    onChange={(event) => setSelectedPriority(event.target.value as TicketPriority)}
                  >
                    {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                  <button className="btn btn-outline-success mt-2" type="button" disabled={saving || selectedPriority === ticket.itPriority} onClick={changePriority}>
                    Save IT Priority
                  </button>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="staff-ticket-status">Status</label>
                  <select
                    id="staff-ticket-status"
                    className="form-select"
                    value={selectedStatus}
                    disabled={saving}
                    onChange={(event) => setSelectedStatus(event.target.value as TicketStatus)}
                  >
                    <option value={ticket.currentStatus}>{ticket.currentStatus} (current)</option>
                    {permittedNextStatuses[ticket.currentStatus].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button className="btn btn-outline-success mt-2" type="button" disabled={saving || selectedStatus === ticket.currentStatus} onClick={changeStatus}>
                    Update Status
                  </button>
                </div>
              </div>
              {saving && <p className="small text-secondary mt-3 mb-0" role="status">Saving Ticket changes…</p>}
            </section>

            <section className="border rounded p-3 mb-4" aria-labelledby="staff-public-comments-title">
              <h3 id="staff-public-comments-title" className="h5">Public Comments</h3>
              {ticket.publicComments.length === 0
                ? <p className="alert alert-info" role="status">No public comments yet.</p>
                : (
                  <ol className="list-group list-group-numbered">
                    {ticket.publicComments.map((comment) => (
                      <li className="list-group-item" key={comment.id}>
                        <strong>{comment.author.name}</strong>
                        <time className="small text-secondary ms-2" dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                        <p className="mb-0 mt-2" style={{ whiteSpace: "pre-wrap" }}>{comment.content}</p>
                      </li>
                    ))}
                  </ol>
                )}
            </section>

            <section className="border rounded p-3 mb-4" aria-labelledby="staff-internal-notes-title">
              <h3 id="staff-internal-notes-title" className="h5">Internal Notes</h3>
              {ticket.internalNotes.length === 0
                ? <p className="alert alert-info" role="status">No internal notes yet.</p>
                : (
                  <ol className="list-group list-group-numbered">
                    {ticket.internalNotes.map((note) => (
                      <li className="list-group-item" key={note.id}>
                        <strong>{note.author.name}</strong>
                        <time className="small text-secondary ms-2" dateTime={note.createdAt}>{formatDate(note.createdAt)}</time>
                        <p className="mb-0 mt-2" style={{ whiteSpace: "pre-wrap" }}>{note.content}</p>
                      </li>
                    ))}
                  </ol>
                )}
            </section>

            <section className="border rounded p-3" aria-labelledby="staff-attachments-title">
              <h3 id="staff-attachments-title" className="h5">Attachments</h3>
              {ticket.attachments.length === 0
                ? <p className="alert alert-info" role="status">No attachments for this Ticket.</p>
                : (
                  <ul className="list-group">
                    {ticket.attachments.map((attachment) => (
                      <li className="list-group-item d-flex flex-wrap justify-content-between gap-2" key={attachment.id}>
                        <span>{attachment.originalName}</span>
                        <span className="small text-secondary">
                          {attachment.removedAt ? "Removed" : "Active"} · {attachment.sizeBytes} bytes
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          </>
        )}
      </div>
    </section>
  );
}

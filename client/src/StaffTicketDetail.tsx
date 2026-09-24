import { useEffect, useState } from "react";
import { ApiRequestError, getStaffTicketDetail, StaffTicketDetailData, TicketPriority, TicketStatus } from "./api.js";

type DetailState = "loading" | "success" | "error";

export interface StaffTicketDetailProps {
  ticketId: number;
  onBack: () => void;
}

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

export default function StaffTicketDetail({ ticketId, onBack }: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<StaffTicketDetailData | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  async function loadDetail() {
    setState("loading");
    setErrorMessage("");
    setErrorStatus(null);

    try {
      const loadedTicket = await getStaffTicketDetail(ticketId);
      setTicket(loadedTicket);
      setState("success");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load operational ticket detail.");
      setErrorStatus(error instanceof ApiRequestError ? error.status : null);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [ticketId]);

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

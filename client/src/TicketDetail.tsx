import { useEffect, useRef, useState } from "react";
import { ApiRequestError, getTicketDetail } from "./api.js";
import type { TicketDetail as TicketDetailData, TicketPriority } from "./api.js";
import AttachmentSection from "./AttachmentSection.js";

type DetailState = "loading" | "success" | "error";

export interface TicketDetailProps {
  requesterId: number;
  ticketId: number;
  onBack: () => void;
}

function formatDateTime(value: string): string {
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

export default function TicketDetail({ requesterId, ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const requestSequence = useRef(0);

  async function loadDetail() {
    const sequence = ++requestSequence.current;
    setState("loading");
    setErrorMessage("");
    setErrorStatus(null);

    try {
      const loadedTicket = await getTicketDetail(requesterId, ticketId);
      if (sequence !== requestSequence.current) return;
      setTicket(loadedTicket);
      setState("success");
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load Ticket Detail.");
      setErrorStatus(error instanceof ApiRequestError ? error.status : null);
    }
  }

  useEffect(() => {
    void loadDetail();

    return () => {
      requestSequence.current += 1;
    };
  }, [requesterId, ticketId]);

  const notFound = errorStatus === 404;

  return (
    <section id="ticket-detail" className="card border-0 shadow-sm mb-4" aria-labelledby="ticket-detail-title">
      <div className="card-body">
        <button className="btn btn-outline-secondary mb-3" type="button" onClick={onBack}>
          Back to My Tickets
        </button>

        <h2 id="ticket-detail-title" className="h4 mb-3">Ticket Detail</h2>

        {state === "loading" && <p role="status">Loading Ticket Detail…</p>}

        {state === "error" && (
          <div className="alert alert-danger" role="alert">
            <p className="mb-2">Unable to load Ticket Detail.</p>
            <p className="small mb-3">
              {notFound ? "Ticket not found or you do not have access." : errorMessage}
            </p>
            <button className="btn btn-outline-danger" type="button" onClick={() => void loadDetail()}>
              Try again
            </button>
          </div>
        )}

        {state === "success" && ticket && (
          <>
            <section className="border rounded p-3 mb-4" aria-labelledby="ticket-information-title">
              <h3 id="ticket-information-title" className="h5 mb-3">Ticket Information</h3>
              <dl className="row mb-0">
                <dt className="col-sm-4">Ticket Number</dt>
                <dd className="col-sm-8">{ticket.ticketNumber}</dd>
                <dt className="col-sm-4">Ticket Date</dt>
                <dd className="col-sm-8">{formatDateTime(ticket.ticketDate)}</dd>
                <dt className="col-sm-4">Requester</dt>
                <dd className="col-sm-8">{ticket.requester.name} ({ticket.requester.email})</dd>
                <dt className="col-sm-4">Category</dt>
                <dd className="col-sm-8">{ticket.category.name}</dd>
                <dt className="col-sm-4">Related System</dt>
                <dd className="col-sm-8">{ticket.relatedSystem.name}</dd>
                <dt className="col-sm-4">Requested Priority</dt>
                <dd className="col-sm-8">
                  <span className={`badge ${priorityBadgeClass(ticket.requestedPriority)}`}>
                    {ticket.requestedPriority}
                  </span>
                </dd>
                <dt className="col-sm-4">Current Status</dt>
                <dd className="col-sm-8"><span className="badge text-bg-primary">{ticket.currentStatus}</span></dd>
                <dt className="col-sm-4">Summary</dt>
                <dd className="col-sm-8">{ticket.summary}</dd>
                <dt className="col-sm-4">Description</dt>
                <dd className="col-sm-8" style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</dd>
                <dt className="col-sm-4">Created</dt>
                <dd className="col-sm-8">{formatDateTime(ticket.createdAt)}</dd>
                <dt className="col-sm-4">Last Updated</dt>
                <dd className="col-sm-8">{formatDateTime(ticket.updatedAt)}</dd>
              </dl>
            </section>

            <AttachmentSection
              requesterId={requesterId}
              ticketId={ticket.id}
              initialAttachments={ticket.attachments}
            />
          </>
        )}
      </div>
    </section>
  );
}

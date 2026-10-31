import { useEffect, useState } from "react";
import { formatBangkok } from "./ActionsTaken.js";
import { ApiRequestError, getTicketStatusHistory, type Pagination, type TicketStatusEvent } from "./api.js";

// Shared by Requester and Staff detail: ordered from/to status events only, never Internal Notes.
export default function TicketStatusHistory({ ticketId, refreshKey }: { ticketId: number; refreshKey: string }) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TicketStatusEvent[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error" | "ended">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState("loading");
    getTicketStatusHistory(ticketId, page).then(
      (response) => {
        if (!alive) return;
        setItems(response.items);
        setPagination(response.pagination);
        setState("success");
      },
      // An ended session cannot be fixed by retrying, so say so instead of offering Retry.
      (error) => alive && setState(error instanceof ApiRequestError && error.status === 401 ? "ended" : "error"),
    );
    return () => {
      alive = false;
    };
  }, [ticketId, page, refreshKey, attempt]);

  return (
    <section className="border rounded p-3 mb-4 bg-white" aria-labelledby="status-history-title">
      <h3 id="status-history-title" className="h5">Ticket Status History</h3>
      <p className="small text-secondary">Status changes in the order they happened. Changes made before Lab 4 were not recorded, so older Tickets may show none.</p>
      {state === "loading" && <p role="status" className="small mb-0">Loading status history…</p>}
      {state === "error" && (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          The status history could not be loaded.
          <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </div>
      )}
      {state === "ended" && <p className="alert alert-warning py-2 mb-0" role="alert">Your session has ended. Sign in again to see the status history.</p>}
      {state === "success" && items.length === 0 && <p className="small mb-0">No status changes recorded yet.</p>}
      {state === "success" && items.length > 0 && (
        <ol className="list-unstyled mb-0" aria-label="Ticket status changes">
          {items.map((event) => (
            <li key={event.id} className="border-bottom py-2">
              <strong>{event.fromStatus ?? "Created"} → {event.toStatus}</strong>
              <div className="small text-secondary">by {event.actor.name} · {formatBangkok(event.createdAt)}</div>
            </li>
          ))}
        </ol>
      )}
      {pagination && pagination.totalPages > 1 && (
        <div className="d-flex gap-2 mt-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Earlier changes</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Later changes</button>
        </div>
      )}
    </section>
  );
}

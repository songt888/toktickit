import { useEffect, useRef, useState } from "react";
import { formatBangkok } from "./ActionsTaken.js";
import { ApiRequestError, getMyPendingActions, type ActionSummary, type Pagination } from "./api.js";

export interface MyPendingActionsProps {
  onBack: () => void;
  onOpenAction: (ticketId: number, actionId: number) => void;
  onSessionExpired: () => void;
}

// The exact myActions drill-down: Actions assigned to the session user, pending, on active Tickets.
export default function MyPendingActions({ onBack, onOpenAction, onSessionExpired }: MyPendingActionsProps) {
  const sequence = useRef(0);
  const [result, setResult] = useState<{ items: ActionSummary[]; pagination: Pagination } | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");

  async function load(page: number) {
    const current = ++sequence.current;
    setState("loading");
    try {
      const loaded = await getMyPendingActions(page);
      if (current !== sequence.current) return;
      setResult(loaded);
      setState("success");
    } catch (error) {
      if (current !== sequence.current) return;
      if (error instanceof ApiRequestError && error.status === 401) return onSessionExpired();
      setState("error");
    }
  }

  useEffect(() => {
    void load(1);
    return () => {
      sequence.current += 1;
    };
  }, []);

  const pagination = result?.pagination;
  return (
    <section className="card border-0 shadow-sm mb-4" aria-labelledby="my-pending-actions-title">
      <div className="card-body">
        <button type="button" className="btn btn-outline-secondary mb-3" onClick={onBack}>Back to Dashboard</button>
        <h2 id="my-pending-actions-title" className="h4 mb-1">My Pending Actions</h2>
        <p className="text-secondary">Planned or in-progress Actions assigned to you on active Tickets, most recently updated first.</p>

        {state === "loading" && <p role="status">Loading your pending Actions…</p>}
        {state === "error" && (
          <div className="alert alert-danger" role="alert">
            Your pending Actions could not be loaded.
            <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => void load(pagination?.page ?? 1)}>Retry</button>
          </div>
        )}
        {state === "success" && result && result.items.length === 0 && <p className="alert alert-info" role="status">No pending Actions assigned to you.</p>}
        {state === "success" && result && result.items.length > 0 && (
          <ul className="list-group mb-3">
            {result.items.map((action) => (
              <li key={action.id} className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <strong>{action.ticketNumber}</strong> <span className="badge text-bg-secondary">{action.status === "PLANNED" ? "Planned" : "In Progress"}</span>
                  <div>{action.description}</div>
                  <div className="small text-secondary">Updated {formatBangkok(action.updatedAt)}</div>
                </div>
                <button type="button" className="btn btn-sm btn-outline-success" aria-label={`Open Action on ${action.ticketNumber}`} onClick={() => onOpenAction(action.ticketId, action.id)}>
                  Open Action
                </button>
              </li>
            ))}
          </ul>
        )}
        {pagination && pagination.totalPages > 1 && (
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={state === "loading" || pagination.page <= 1} onClick={() => void load(pagination.page - 1)}>Previous</button>
            <span className="small">Page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} Actions)</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={state === "loading" || pagination.page >= pagination.totalPages} onClick={() => void load(pagination.page + 1)}>Next</button>
          </div>
        )}
      </div>
    </section>
  );
}

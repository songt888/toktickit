import { useEffect, useRef, useState } from "react";
import { formatBangkok } from "./ActionsTaken.js";
import { ApiRequestError, getRequesterDashboard, type RequesterDashboardData, type TicketListOptions } from "./api.js";

// A Dashboard drill-down: the exact list filter for My Tickets plus a visible label.
export type TicketScope = { label: string; filter: TicketListOptions };

export interface RequesterDashboardProps {
  requesterId: number;
  visible: boolean;
  onViewTickets: (scope: TicketScope) => void;
  onOpenTicket: (ticketId: number) => void;
  onCreateTicket: () => void;
  onSessionExpired: () => void;
}

export default function RequesterDashboard({ requesterId, visible, onViewTickets, onOpenTicket, onCreateTicket, onSessionExpired }: RequesterDashboardProps) {
  const sequence = useRef(0);
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error" | "forbidden">("loading");

  async function load() {
    const current = ++sequence.current;
    setState("loading");
    try {
      const loaded = await getRequesterDashboard();
      if (current !== sequence.current) return;
      setData(loaded);
      setState("success");
    } catch (error) {
      if (current !== sequence.current) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        setData(null);
        onSessionExpired();
        return;
      }
      if (error instanceof ApiRequestError && error.status === 403) {
        setData(null);
        setState("forbidden");
        return;
      }
      // Keep the last good snapshot, labelled as older data below.
      setState("error");
    }
  }

  // Reload on every entry; leaving the screen drops any response still in flight.
  useEffect(() => {
    if (!visible) {
      sequence.current += 1;
      return;
    }
    void load();
    return () => {
      sequence.current += 1;
    };
  }, [requesterId, visible]);

  if (!visible) return null;

  const cards = data && [
    {
      id: "open", title: "Open Tickets", value: data.metrics.openTickets,
      caption: "New, open, in progress, waiting for you or reopened.",
      scope: { label: "Open Tickets", filter: { statusGroup: "active" } },
    },
    {
      id: "waiting", title: "Waiting for You", value: data.metrics.waitingForRequester,
      caption: "The support team needs your reply.",
      scope: { label: "Waiting for You", filter: { currentStatus: "WAITING_FOR_REQUESTER" } },
    },
    {
      id: "resolved", title: "Recently Resolved", value: data.metrics.recentlyResolved,
      caption: "Resolved or closed in the last 7 days. Older Tickets with an unknown resolution date are not counted.",
      scope: { label: "Recently Resolved (last 7 days)", filter: { statusGroup: "resolved", resolvedFrom: data.recentFrom, resolvedTo: data.asOf } },
    },
  ] satisfies Array<{ id: string; title: string; value: number; caption: string; scope: TicketScope }>;

  return (
    <section className="card border-0 shadow-sm mb-4" aria-labelledby="requester-dashboard-title">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 id="requester-dashboard-title" className="h4 mb-1">Dashboard</h2>
            {data && <p className="small text-secondary mb-0">As of {formatBangkok(data.asOf)}</p>}
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline-success" disabled={state === "loading"} onClick={() => void load()}>
              {state === "loading" ? "Refreshing…" : "Refresh"}
            </button>
            <button type="button" className="btn btn-success" onClick={onCreateTicket}>Create Ticket</button>
          </div>
        </div>

        {state === "loading" && !data && <p role="status">Loading your Dashboard…</p>}
        {state === "loading" && data && <p className="small text-secondary" role="status">Refreshing your Dashboard…</p>}
        {state === "forbidden" && <p className="alert alert-warning" role="alert">The Requester Dashboard is only available to Requesters.</p>}
        {state === "error" && (
          <div className="alert alert-danger" role="alert">
            {data
              ? `The Dashboard could not be refreshed. Showing older data from ${formatBangkok(data.asOf)}.`
              : "The Dashboard could not be loaded."}
            <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => void load()}>Retry</button>
          </div>
        )}

        {data && cards && (
          <>
            <div className="row g-3 mb-4">
              {cards.map((card) => (
                <div key={card.id} className="col-12 col-md-4">
                  <section className="border border-success rounded p-3 h-100 d-flex flex-column" aria-labelledby={`dashboard-${card.id}-title`}>
                    <h3 id={`dashboard-${card.id}-title`} className="h6 mb-1">{card.title}</h3>
                    <p className="display-6 fw-semibold text-success mb-1" aria-describedby={`dashboard-${card.id}-title`}>{card.value}</p>
                    <p className="small text-secondary flex-grow-1">{card.caption}</p>
                    <button type="button" className="btn btn-outline-success btn-sm align-self-start" aria-label={`View ${card.title} in My Tickets`}
                      onClick={() => onViewTickets(card.scope)}>
                      View Tickets
                    </button>
                  </section>
                </div>
              ))}
            </div>

            <section aria-labelledby="dashboard-recent-title">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h3 id="dashboard-recent-title" className="h5 mb-0">Recently Updated</h3>
                <button type="button" className="btn btn-sm btn-outline-success"
                  onClick={() => onViewTickets({ label: "Updated in the last 7 days", filter: { updatedFrom: data.recentFrom, updatedTo: data.asOf } })}>
                  View all recently updated
                </button>
              </div>
              <p className="small text-secondary">Up to five of your Tickets updated in the last 7 days, newest first.</p>
              {data.recentTickets.length === 0
                ? <p className="alert alert-info" role="status">None of your Tickets were updated in the last 7 days.</p>
                : (
                  <ul className="list-group">
                    {data.recentTickets.map((ticket) => (
                      <li key={ticket.id} className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                          <strong>{ticket.ticketNumber}</strong> <span className="badge text-bg-secondary">{ticket.currentStatus}</span>
                          <div>{ticket.summary}</div>
                          <div className="small text-secondary">Updated {formatBangkok(ticket.updatedAt)}</div>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline-success" aria-label={`Open Detail for ${ticket.ticketNumber}`} onClick={() => onOpenTicket(ticket.id)}>
                          Open Detail
                        </button>
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

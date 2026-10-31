import { useEffect, useRef, useState } from "react";
import { formatBangkok } from "./ActionsTaken.js";
import { ApiRequestError, getStaffDashboard, type DashboardTicket, type StaffDashboardData, type TicketPriority, type TicketStatus } from "./api.js";
import type { QueueScope } from "./StaffTicketQueue.js";

export interface StaffDashboardProps {
  userId: number;
  visible: boolean;
  onViewQueue: (scope: QueueScope) => void;
  onOpenTicket: (ticketId: number) => void;
  onOpenAction: (ticketId: number, actionId: number) => void;
  onViewMyActions: () => void;
  onSessionExpired: () => void;
}

const statusLabels: Record<TicketStatus, string> = {
  NEW: "New", OPEN: "Open", IN_PROGRESS: "In Progress", WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", CANCELLED: "Cancelled",
};
const priorityLabels: Record<TicketPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

export default function StaffDashboard({ userId, visible, onViewQueue, onOpenTicket, onOpenAction, onViewMyActions, onSessionExpired }: StaffDashboardProps) {
  const sequence = useRef(0);
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error" | "forbidden">("loading");

  async function load() {
    const current = ++sequence.current;
    setState("loading");
    try {
      const loaded = await getStaffDashboard();
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
  }, [userId, visible]);

  if (!visible) return null;

  const ticketList = (id: string, title: string, caption: string, empty: string, tickets: DashboardTicket[], viewAll: QueueScope, viewAllLabel: string) => (
    <section className="col-12 col-lg-6" aria-labelledby={`staff-dashboard-${id}-title`}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h3 id={`staff-dashboard-${id}-title`} className="h5 mb-0">{title}</h3>
        <button type="button" className="btn btn-sm btn-outline-success" onClick={() => onViewQueue(viewAll)}>{viewAllLabel}</button>
      </div>
      <p className="small text-secondary">{caption}</p>
      {tickets.length === 0
        ? <p className="alert alert-info" role="status">{empty}</p>
        : (
          <ul className="list-group">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <strong>{ticket.ticketNumber}</strong>{" "}
                  <span className="badge text-bg-secondary">{statusLabels[ticket.currentStatus]}</span>{" "}
                  <span className="badge text-bg-light border">IT priority: {priorityLabels[ticket.itPriority]}</span>
                  <div>{ticket.summary}</div>
                  <div className="small text-secondary">Owner: {ticket.owner?.name ?? "Unassigned"} · Updated {formatBangkok(ticket.updatedAt)}</div>
                </div>
                <button type="button" className="btn btn-sm btn-outline-success" aria-label={`Open Detail for ${ticket.ticketNumber}`} onClick={() => onOpenTicket(ticket.id)}>
                  Open Detail
                </button>
              </li>
            ))}
          </ul>
        )}
    </section>
  );

  return (
    <section className="card border-0 shadow-sm mb-4" aria-labelledby="staff-dashboard-title">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 id="staff-dashboard-title" className="h4 mb-1">Dashboard</h2>
            {data && <p className="small text-secondary mb-0">As of {formatBangkok(data.asOf)}</p>}
          </div>
          <button type="button" className="btn btn-outline-success" disabled={state === "loading"} onClick={() => void load()}>
            {state === "loading" ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {state === "loading" && !data && <p role="status">Loading your Dashboard…</p>}
        {state === "loading" && data && <p className="small text-secondary" role="status">Refreshing your Dashboard…</p>}
        {state === "forbidden" && <p className="alert alert-warning" role="alert">The operational Dashboard is only available to IT Staff and Administrators.</p>}
        {state === "error" && (
          <div className="alert alert-danger" role="alert">
            {data
              ? `The Dashboard could not be refreshed. Showing older data from ${formatBangkok(data.asOf)}.`
              : "The Dashboard could not be loaded."}
            <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => void load()}>Retry</button>
          </div>
        )}

        {data && (
          <>
            <div className="row g-3 mb-4">
              {[
                { id: "unassigned", title: "Unassigned Tickets", value: data.metrics.unassignedTickets, caption: "Active Tickets with no owner.",
                  open: () => onViewQueue({ label: "Unassigned active Tickets", filter: { statusGroup: "active", ownerId: "unassigned" } }), action: "in the Ticket Queue" },
                { id: "mine", title: "My Tickets", value: data.metrics.myTickets, caption: "Active Tickets you own.",
                  open: () => onViewQueue({ label: "Active Tickets you own", filter: { statusGroup: "active", ownerId: userId } }), action: "in the Ticket Queue" },
                { id: "actions", title: "My Pending Actions", value: data.metrics.myActions, caption: "Planned or in-progress Actions assigned to you on active Tickets.",
                  open: onViewMyActions, action: "" },
              ].map((card) => (
                <div key={card.id} className="col-12 col-md-4">
                  <section className="border border-success rounded p-3 h-100 d-flex flex-column" aria-labelledby={`staff-dashboard-${card.id}-card`}>
                    <h3 id={`staff-dashboard-${card.id}-card`} className="h6 mb-1">{card.title}</h3>
                    <p className="display-6 fw-semibold text-success mb-1">{card.value}</p>
                    <p className="small text-secondary flex-grow-1">{card.caption}</p>
                    <button type="button" className="btn btn-outline-success btn-sm align-self-start" aria-label={`View ${card.title}${card.action ? ` ${card.action}` : ""}`} onClick={card.open}>
                      View
                    </button>
                  </section>
                </div>
              ))}
            </div>

            <div className="row g-3 mb-4">
              <section className="col-12 col-lg-7" aria-labelledby="staff-dashboard-status-title">
                <h3 id="staff-dashboard-status-title" className="h6 mb-1">Tickets by status</h3>
                <p className="small text-secondary">All Tickets, including resolved, closed and cancelled.</p>
                <div className="d-flex flex-wrap gap-2">
                  {(Object.keys(statusLabels) as TicketStatus[]).map((status) => (
                    <button key={status} type="button" className="btn btn-sm btn-outline-secondary" aria-label={`${statusLabels[status]}: ${data.metrics.byStatus[status]} Tickets, view in the Ticket Queue`}
                      onClick={() => onViewQueue({ label: `Status: ${statusLabels[status]}`, filter: { currentStatus: status } })}>
                      {statusLabels[status]} <span className="badge text-bg-success ms-1">{data.metrics.byStatus[status]}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="col-12 col-lg-5" aria-labelledby="staff-dashboard-priority-title">
                <h3 id="staff-dashboard-priority-title" className="h6 mb-1">Active Tickets by IT priority</h3>
                <p className="small text-secondary">Active Tickets only.</p>
                <div className="d-flex flex-wrap gap-2">
                  {(Object.keys(priorityLabels) as TicketPriority[]).map((priority) => (
                    <button key={priority} type="button" className="btn btn-sm btn-outline-secondary" aria-label={`${priorityLabels[priority]}: ${data.metrics.byItPriority[priority]} active Tickets, view in the Ticket Queue`}
                      onClick={() => onViewQueue({ label: `Active, IT priority ${priorityLabels[priority]}`, filter: { statusGroup: "active", itPriority: priority } })}>
                      {priorityLabels[priority]} <span className="badge text-bg-success ms-1">{data.metrics.byItPriority[priority]}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <section className="mb-4" aria-labelledby="staff-dashboard-actions-title">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h3 id="staff-dashboard-actions-title" className="h5 mb-0">My Pending Actions</h3>
                <button type="button" className="btn btn-sm btn-outline-success" onClick={onViewMyActions}>View all My Pending Actions</button>
              </div>
              <p className="small text-secondary">Up to five Actions assigned to you, most recently updated first.</p>
              {data.myActions.length === 0
                ? <p className="alert alert-info" role="status">No pending Actions assigned to you.</p>
                : (
                  <ul className="list-group">
                    {data.myActions.map((action) => (
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
            </section>

            <div className="row g-3">
              {ticketList("urgent", "Urgent Tickets", "Up to five active Tickets with IT priority Urgent, most recently updated first.", "No active urgent Tickets.",
                data.urgentTickets, { label: "Active, IT priority Urgent", filter: { statusGroup: "active", itPriority: "URGENT" } }, "View all urgent")}
              {ticketList("recent", "Recently Updated", "Up to five Tickets updated in the last 7 days, newest first.", "No Tickets were updated in the last 7 days.",
                data.recentTickets, { label: "Updated in the last 7 days", filter: { updatedFrom: data.recentFrom, updatedTo: data.asOf } }, "View all recently updated")}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

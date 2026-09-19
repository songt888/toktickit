import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ApiRequestError,
  Category,
  getCategories,
  getRelatedSystems,
  getStaffTickets,
  RelatedSystem,
  StaffTicketListItem,
  StaffTicketListOptions,
  StaffTicketListResponse,
  TicketPriority,
  TicketStatus,
} from "./api.js";

type PageState = "loading" | "success" | "error";

type QueueDraft = {
  search: string;
  categoryId: string;
  relatedSystemId: string;
  requestedPriority: "" | TicketPriority;
  itPriority: "" | TicketPriority;
  currentStatus: "" | TicketStatus;
  ownerId: "" | "unassigned";
  sort: NonNullable<StaffTicketListOptions["sort"]>;
  order: NonNullable<StaffTicketListOptions["order"]>;
  pageSize: 10 | 25 | 50;
};

const defaultDraft: QueueDraft = {
  search: "",
  categoryId: "",
  relatedSystemId: "",
  requestedPriority: "",
  itPriority: "",
  currentStatus: "",
  ownerId: "",
  sort: "updatedAt",
  order: "desc",
  pageSize: 10,
};

const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const statuses: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

function optionsFromDraft(draft: QueueDraft, page = 1): StaffTicketListOptions {
  return {
    ...(draft.search.trim() ? { search: draft.search.trim() } : {}),
    ...(draft.categoryId ? { categoryId: Number(draft.categoryId) } : {}),
    ...(draft.relatedSystemId ? { relatedSystemId: Number(draft.relatedSystemId) } : {}),
    ...(draft.requestedPriority ? { requestedPriority: draft.requestedPriority } : {}),
    ...(draft.itPriority ? { itPriority: draft.itPriority } : {}),
    ...(draft.currentStatus ? { currentStatus: draft.currentStatus } : {}),
    ...(draft.ownerId ? { ownerId: draft.ownerId } : {}),
    sort: draft.sort,
    order: draft.order,
    page,
    pageSize: draft.pageSize,
  };
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

export interface StaffTicketQueueProps {
  onOpenTicket: (ticketId: number) => void;
  visible?: boolean;
}

export default function StaffTicketQueue({ onOpenTicket, visible = true }: StaffTicketQueueProps) {
  const [draft, setDraft] = useState<QueueDraft>(defaultDraft);
  const [filters, setFilters] = useState<StaffTicketListOptions>(optionsFromDraft(defaultDraft));
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [result, setResult] = useState<StaffTicketListResponse | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [referenceState, setReferenceState] = useState<PageState>("loading");
  const [referenceError, setReferenceError] = useState("");
  const queueRequestSequence = useRef(0);
  const referenceRequestSequence = useRef(0);

  async function loadReferences() {
    const sequence = ++referenceRequestSequence.current;
    setReferenceState("loading");
    setReferenceError("");

    try {
      const [loadedCategories, loadedSystems] = await Promise.all([
        getCategories(),
        getRelatedSystems(),
      ]);
      if (sequence !== referenceRequestSequence.current) return;
      setCategories(loadedCategories);
      setRelatedSystems(loadedSystems);
      setReferenceState("success");
    } catch (error) {
      if (sequence !== referenceRequestSequence.current) return;
      setReferenceState("error");
      setReferenceError(error instanceof Error ? error.message : "Unable to load queue filters.");
    }
  }

  async function loadQueue() {
    const sequence = ++queueRequestSequence.current;
    setState("loading");
    setErrorMessage("");
    setErrorStatus(null);

    try {
      const loadedQueue = await getStaffTickets(filters);
      if (sequence !== queueRequestSequence.current) return;
      setResult(loadedQueue);
      setState("success");
    } catch (error) {
      if (sequence !== queueRequestSequence.current) return;
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the staff ticket queue.");
      setErrorStatus(error instanceof ApiRequestError ? error.status : null);
    }
  }

  useEffect(() => {
    void loadReferences();

    return () => {
      referenceRequestSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      queueRequestSequence.current += 1;
      return;
    }

    void loadQueue();

    return () => {
      queueRequestSequence.current += 1;
    };
  }, [filters, visible]);

  function updateDraft(field: keyof QueueDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters(optionsFromDraft(draft));
  }

  function clearFilters() {
    setDraft(defaultDraft);
    setFilters(optionsFromDraft(defaultDraft));
  }

  function goToPage(page: number) {
    setFilters((current) => ({ ...current, page }));
  }

  function retryLoading() {
    if (referenceState === "error") void loadReferences();
    void loadQueue();
  }

  const hasFilters = Boolean(
    filters.search ||
      filters.categoryId ||
      filters.relatedSystemId ||
      filters.requestedPriority ||
      filters.itPriority ||
      filters.currentStatus ||
      filters.ownerId,
  );
  const items = result?.items ?? [];
  const pagination = result?.pagination;
  const isLoading = state === "loading" || referenceState === "loading";
  const hasError = state === "error" || referenceState === "error";
  const canShowResults = state === "success" && referenceState === "success";
  const noResultsMessage = hasFilters
    ? "No tickets match the current queue filters."
    : "No tickets are currently in the operational queue.";

  function renderTicketFields(ticket: StaffTicketListItem) {
    return (
      <>
        <div><span className="fw-semibold">Created:</span> {formatDate(ticket.ticketDate)}</div>
        <div><span className="fw-semibold">Summary:</span> {ticket.summary}</div>
        <div><span className="fw-semibold">Category:</span> {ticket.category.name}</div>
        <div><span className="fw-semibold">Requester:</span> {ticket.requester.name}</div>
        <div><span className="fw-semibold">Requested Priority:</span>{" "}
          <span className={`badge ${priorityBadgeClass(ticket.requestedPriority)}`}>{ticket.requestedPriority}</span>
        </div>
        <div><span className="fw-semibold">IT Priority:</span>{" "}
          <span className={`badge ${priorityBadgeClass(ticket.itPriority)}`}>{ticket.itPriority}</span>
        </div>
        <div><span className="fw-semibold">Status:</span>{" "}
          <span className={`badge ${statusBadgeClass(ticket.currentStatus)}`}>{ticket.currentStatus}</span>
        </div>
        <div><span className="fw-semibold">Owner:</span> {ticket.owner?.name ?? "Unassigned"}</div>
        <div><span className="fw-semibold">Last Updated:</span> {formatDate(ticket.updatedAt)}</div>
      </>
    );
  }

  return (
    <section
      id="staff-ticket-queue"
      className={`card border-0 shadow-sm mb-4${visible ? "" : " d-none"}`}
      aria-labelledby="staff-ticket-queue-title"
      aria-hidden={!visible}
    >
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
          <div>
            <h2 id="staff-ticket-queue-title" className="h4 mb-1">Ticket Queue</h2>
            <p className="text-secondary mb-0">Operational tickets available to Staff and Administrators.</p>
          </div>
        </div>

        <form className="border rounded p-3 mb-4 bg-light" onSubmit={applyFilters}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="staff-ticket-search">Search Queue</label>
              <input
                id="staff-ticket-search"
                className="form-control"
                placeholder="Ticket number, summary, description, or requester"
                value={draft.search}
                onChange={(event) => updateDraft("search", event.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="staff-queue-category">Category</label>
              <select
                id="staff-queue-category"
                className="form-select"
                value={draft.categoryId}
                onChange={(event) => updateDraft("categoryId", event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="staff-queue-system">Related System</label>
              <select
                id="staff-queue-system"
                className="form-select"
                value={draft.relatedSystemId}
                onChange={(event) => updateDraft("relatedSystemId", event.target.value)}
              >
                <option value="">All related systems</option>
                {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold" htmlFor="staff-requested-priority">Requested Priority</label>
              <select
                id="staff-requested-priority"
                className="form-select"
                value={draft.requestedPriority}
                onChange={(event) => updateDraft("requestedPriority", event.target.value)}
              >
                <option value="">All priorities</option>
                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold" htmlFor="staff-it-priority">IT Priority</label>
              <select
                id="staff-it-priority"
                className="form-select"
                value={draft.itPriority}
                onChange={(event) => updateDraft("itPriority", event.target.value)}
              >
                <option value="">All IT priorities</option>
                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold" htmlFor="staff-status">Status</label>
              <select
                id="staff-status"
                className="form-select"
                value={draft.currentStatus}
                onChange={(event) => updateDraft("currentStatus", event.target.value)}
              >
                <option value="">All statuses</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" htmlFor="staff-owner">Owner</label>
              <select
                id="staff-owner"
                className="form-select"
                value={draft.ownerId}
                onChange={(event) => updateDraft("ownerId", event.target.value)}
              >
                <option value="">All owners</option>
                <option value="unassigned">Unassigned only</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" htmlFor="staff-sort">Sort by</label>
              <select
                id="staff-sort"
                className="form-select"
                value={draft.sort}
                onChange={(event) => updateDraft("sort", event.target.value as QueueDraft["sort"])}
              >
                <option value="updatedAt">Last updated</option>
                <option value="ticketNumber">Ticket number</option>
                <option value="ticketDate">Created date</option>
                <option value="requestedPriority">Requested priority</option>
                <option value="itPriority">IT priority</option>
                <option value="currentStatus">Status</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" htmlFor="staff-order">Order</label>
              <select
                id="staff-order"
                className="form-select"
                value={draft.order}
                onChange={(event) => updateDraft("order", event.target.value as QueueDraft["order"])}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" htmlFor="staff-page-size">Page size</label>
              <select
                id="staff-page-size"
                className="form-select"
                value={draft.pageSize}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  pageSize: Number(event.target.value) as QueueDraft["pageSize"],
                }))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="col-12 d-flex flex-wrap gap-2">
              <button className="btn btn-success" type="submit">Apply filters</button>
              <button className="btn btn-outline-secondary" type="button" onClick={clearFilters}>Clear filters</button>
            </div>
          </div>
        </form>

        {isLoading && <p role="status">Loading Ticket Queue…</p>}

        {hasError && (
          <div className="alert alert-danger" role="alert">
            <p className="mb-2">
              {errorStatus === 403
                ? "You do not have permission to view the Ticket Queue."
                : state === "error"
                  ? errorMessage
                  : referenceError}
            </p>
            <button className="btn btn-outline-danger" type="button" onClick={retryLoading}>Try again</button>
          </div>
        )}

        {canShowResults && pagination && pagination.totalItems === 0 && (
          <p className="alert alert-info" role="status">{noResultsMessage}</p>
        )}

        {canShowResults && pagination && items.length > 0 && (
          <>
            <div className="table-responsive d-none d-lg-block">
              <table className="table align-middle">
                <caption className="visually-hidden">IT Staff Ticket Queue</caption>
                <thead>
                  <tr>
                    <th scope="col">Ticket Number</th>
                    <th scope="col">Created</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Category</th>
                    <th scope="col">Requester</th>
                    <th scope="col">Requested</th>
                    <th scope="col">IT Priority</th>
                    <th scope="col">Status</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Updated</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ticket) => (
                    <tr key={ticket.id}>
                      <th scope="row">{ticket.ticketNumber}</th>
                      <td>{formatDate(ticket.ticketDate)}</td>
                      <td>{ticket.summary}</td>
                      <td>{ticket.category.name}</td>
                      <td>{ticket.requester.name}</td>
                      <td><span className={`badge ${priorityBadgeClass(ticket.requestedPriority)}`}>{ticket.requestedPriority}</span></td>
                      <td><span className={`badge ${priorityBadgeClass(ticket.itPriority)}`}>{ticket.itPriority}</span></td>
                      <td><span className={`badge ${statusBadgeClass(ticket.currentStatus)}`}>{ticket.currentStatus}</span></td>
                      <td>{ticket.owner?.name ?? "Unassigned"}</td>
                      <td>{formatDate(ticket.updatedAt)}</td>
                      <td>
                        <button className="btn btn-outline-success btn-sm" type="button" onClick={() => onOpenTicket(ticket.id)}>
                          Open Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-lg-none d-grid gap-3">
              {items.map((ticket) => (
                <article key={ticket.id} className="border rounded p-3" aria-label={`Ticket ${ticket.ticketNumber}`}>
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                    <h3 className="h6 mb-0">{ticket.ticketNumber}</h3>
                    <span className={`badge ${statusBadgeClass(ticket.currentStatus)}`}>{ticket.currentStatus}</span>
                  </div>
                  <div className="small d-grid gap-1">{renderTicketFields(ticket)}</div>
                  <button className="btn btn-outline-success btn-sm mt-3" type="button" onClick={() => onOpenTicket(ticket.id)}>
                    Open Detail
                  </button>
                </article>
              ))}
            </div>

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
              <p className="small text-secondary mb-0">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} tickets)
              </p>
              <div className="btn-group" role="group" aria-label="Ticket Queue pagination">
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

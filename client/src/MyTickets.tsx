import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Category,
  getCategories,
  getMyTickets,
  getRelatedSystems,
  RelatedSystem,
  Requester,
  TicketListItem,
  TicketListOptions,
  TicketPriority,
  TicketListResponse,
} from "./api.js";

type PageState = "loading" | "success" | "error";

type FilterDraft = {
  search: string;
  categoryId: string;
  relatedSystemId: string;
  requestedPriority: "" | TicketPriority;
  currentStatus: "" | "NEW";
  sort: NonNullable<TicketListOptions["sort"]>;
  order: NonNullable<TicketListOptions["order"]>;
  pageSize: 10 | 25 | 50;
};

const defaultDraft: FilterDraft = {
  search: "",
  categoryId: "",
  relatedSystemId: "",
  requestedPriority: "",
  currentStatus: "",
  sort: "updatedAt",
  order: "desc",
  pageSize: 10,
};

const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function optionsFromDraft(draft: FilterDraft, page = 1): TicketListOptions {
  return {
    ...(draft.search.trim() ? { search: draft.search.trim() } : {}),
    ...(draft.categoryId ? { categoryId: Number(draft.categoryId) } : {}),
    ...(draft.relatedSystemId ? { relatedSystemId: Number(draft.relatedSystemId) } : {}),
    ...(draft.requestedPriority ? { requestedPriority: draft.requestedPriority } : {}),
    ...(draft.currentStatus ? { currentStatus: draft.currentStatus } : {}),
    sort: draft.sort,
    order: draft.order,
    page,
    pageSize: draft.pageSize,
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

export interface MyTicketsProps {
  requester: Requester;
  onCreateTicket: () => void;
}

export default function MyTickets({ requester, onCreateTicket }: MyTicketsProps) {
  const [draft, setDraft] = useState<FilterDraft>(defaultDraft);
  const [filters, setFilters] = useState<TicketListOptions>(optionsFromDraft(defaultDraft));
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [result, setResult] = useState<TicketListResponse | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [referenceState, setReferenceState] = useState<PageState>("loading");
  const [referenceErrorMessage, setReferenceErrorMessage] = useState("");
  const ticketRequestSequence = useRef(0);
  const referenceRequestSequence = useRef(0);

  async function loadReferences() {
    const requestSequence = ++referenceRequestSequence.current;
    setReferenceState("loading");
    setReferenceErrorMessage("");

    try {
      const [loadedCategories, loadedSystems] = await Promise.all([
        getCategories(),
        getRelatedSystems(),
      ]);
      if (requestSequence !== referenceRequestSequence.current) return;
      setCategories(loadedCategories);
      setRelatedSystems(loadedSystems);
      setReferenceState("success");
    } catch (error) {
      if (requestSequence !== referenceRequestSequence.current) return;
      setReferenceState("error");
      setReferenceErrorMessage(
        error instanceof Error ? error.message : "Unable to load ticket filters.",
      );
    }
  }

  async function loadPage() {
    const requestSequence = ++ticketRequestSequence.current;
    setState("loading");
    setErrorMessage("");

    try {
      const loadedTickets = await getMyTickets(requester.id, filters);
      if (requestSequence !== ticketRequestSequence.current) return;
      setResult(loadedTickets);
      setState("success");
    } catch (error) {
      if (requestSequence !== ticketRequestSequence.current) return;
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load My Tickets.");
    }
  }

  useEffect(() => {
    void loadReferences();

    return () => {
      referenceRequestSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    void loadPage();

    return () => {
      ticketRequestSequence.current += 1;
    };
  }, [requester.id, filters]);

  function updateDraft(field: keyof FilterDraft, value: string) {
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
    void loadPage();
  }

  const hasFilters = Boolean(
    filters.search ||
      filters.categoryId ||
      filters.relatedSystemId ||
      filters.requestedPriority ||
      filters.currentStatus,
  );
  const items = result?.items ?? [];
  const pagination = result?.pagination;
  const isLoading = state === "loading" || referenceState === "loading";
  const hasError = state === "error" || referenceState === "error";
  const canShowResults = state === "success" && referenceState === "success";
  const displayedErrorMessage = state === "error" ? errorMessage : referenceErrorMessage;
  const noResultsMessage = hasFilters
    ? "No tickets match your search or filters."
    : "No tickets yet. Create your first ticket.";

  function priorityBadgeClass(priority: TicketPriority): string {
    switch (priority) {
      case "LOW": return "text-bg-secondary";
      case "MEDIUM": return "text-bg-info";
      case "HIGH": return "text-bg-warning text-dark";
      case "URGENT": return "text-bg-danger";
    }
  }

  function statusBadgeClass(status: TicketListItem["currentStatus"]): string {
    return status === "NEW" ? "text-bg-primary" : "text-bg-secondary";
  }

  const renderRow = (ticket: TicketListItem) => (
    <tr key={ticket.id}>
      <th scope="row">{ticket.ticketNumber}</th>
      <td>{ticket.summary}</td>
      <td>{ticket.category.name}</td>
      <td>{ticket.relatedSystem.name}</td>
      <td><span className={`badge ${statusBadgeClass(ticket.currentStatus)}`}>{ticket.currentStatus}</span></td>
      <td><span className={`badge ${priorityBadgeClass(ticket.requestedPriority)}`}>{ticket.requestedPriority}</span></td>
      <td>{formatDate(ticket.updatedAt)}</td>
    </tr>
  );

  return (
    <section id="my-tickets" className="card border-0 shadow-sm mb-4" aria-labelledby="my-tickets-title">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
          <div>
            <h2 id="my-tickets-title" className="h4 mb-1">My Tickets</h2>
            <p className="text-secondary mb-0">Tickets created by {requester.name}.</p>
          </div>
          <button className="btn btn-success" type="button" onClick={onCreateTicket}>
            Create Ticket
          </button>
        </div>

        <form className="border rounded p-3 mb-4 bg-light" onSubmit={applyFilters}>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-semibold" htmlFor="ticket-search">Search Tickets</label>
              <input
                id="ticket-search"
                className="form-control"
                placeholder="Ticket number, summary, or description"
                value={draft.search}
                onChange={(event) => updateDraft("search", event.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="ticket-list-category">Category</label>
              <select
                id="ticket-list-category"
                className="form-select"
                value={draft.categoryId}
                onChange={(event) => updateDraft("categoryId", event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="ticket-list-system">Related System</label>
              <select
                id="ticket-list-system"
                className="form-select"
                value={draft.relatedSystemId}
                onChange={(event) => updateDraft("relatedSystemId", event.target.value)}
              >
                <option value="">All related systems</option>
                {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold" htmlFor="ticket-list-priority">Requested Priority</label>
              <select
                id="ticket-list-priority"
                className="form-select"
                value={draft.requestedPriority}
                onChange={(event) => updateDraft("requestedPriority", event.target.value)}
              >
                <option value="">All priorities</option>
                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold" htmlFor="ticket-list-status">Status</label>
              <select
                id="ticket-list-status"
                className="form-select"
                value={draft.currentStatus}
                onChange={(event) => updateDraft("currentStatus", event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="NEW">NEW</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-semibold" htmlFor="ticket-list-page-size">Page size</label>
              <select
                id="ticket-list-page-size"
                className="form-select"
                value={draft.pageSize}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    pageSize: Number(event.target.value) as 10 | 25 | 50,
                  }))
                }
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="ticket-list-sort">Sort by</label>
              <select
                id="ticket-list-sort"
                className="form-select"
                value={draft.sort}
                onChange={(event) => updateDraft("sort", event.target.value)}
              >
                <option value="updatedAt">Last updated</option>
                <option value="ticketNumber">Ticket Number</option>
                <option value="ticketDate">Ticket Date</option>
                <option value="requestedPriority">Requested Priority</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="ticket-list-order">Order</label>
              <select
                id="ticket-list-order"
                className="form-select"
                value={draft.order}
                onChange={(event) => updateDraft("order", event.target.value)}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <button className="btn btn-success" type="submit">Apply filters</button>
            <button className="btn btn-outline-secondary" type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        </form>

        {isLoading && <p role="status">Loading My Tickets…</p>}

        {hasError && (
          <div className="alert alert-danger" role="alert">
            <p className="mb-2">Unable to load My Tickets.</p>
            <p className="small mb-3">{displayedErrorMessage}</p>
            <button className="btn btn-outline-danger" type="button" onClick={retryLoading}>
              Try again
            </button>
          </div>
        )}

        {canShowResults && items.length === 0 && (
          <p className="alert alert-info" role="status">{noResultsMessage}</p>
        )}

        {canShowResults && items.length > 0 && (
          <>
            <div className="table-responsive d-none d-md-block">
              <table className="table align-middle" aria-label="My Tickets list">
                <thead>
                  <tr>
                    <th scope="col">Ticket Number</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Category</th>
                    <th scope="col">Related System</th>
                    <th scope="col">Status</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Last Updated</th>
                  </tr>
                </thead>
                <tbody>{items.map(renderRow)}</tbody>
              </table>
            </div>

            <div className="d-md-none vstack gap-3" aria-label="My Tickets cards">
              {items.map((ticket) => (
                <article key={ticket.id} className="border rounded p-3">
                  <h3 className="h6">{ticket.ticketNumber}</h3>
                  <p className="mb-2">{ticket.summary}</p>
                  <dl className="row small mb-0">
                    <dt className="col-5">Category</dt><dd className="col-7">{ticket.category.name}</dd>
                    <dt className="col-5">Related System</dt><dd className="col-7">{ticket.relatedSystem.name}</dd>
                    <dt className="col-5">Status</dt><dd className="col-7"><span className={`badge ${statusBadgeClass(ticket.currentStatus)}`}>{ticket.currentStatus}</span></dd>
                    <dt className="col-5">Priority</dt><dd className="col-7"><span className={`badge ${priorityBadgeClass(ticket.requestedPriority)}`}>{ticket.requestedPriority}</span></dd>
                    <dt className="col-5">Last Updated</dt><dd className="col-7">{formatDate(ticket.updatedAt)}</dd>
                  </dl>
                </article>
              ))}
            </div>

            {pagination && pagination.totalPages > 0 && (
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
                <p className="small text-secondary mb-0">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} tickets)
                </p>
                <div className="btn-group" role="group" aria-label="Ticket list pagination">
                  <button
                    className="btn btn-outline-success"
                    type="button"
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-outline-success"
                    type="button"
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

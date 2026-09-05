import { useEffect, useMemo, useState } from "react";
import {
  clearRequesterId,
  getRequesters,
  readRequesterId,
  Requester,
  saveRequesterId,
} from "./api.js";
import CreateTicket from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";

type RequesterState = "loading" | "success" | "error";
type ActivePage = "tickets" | "create" | "detail";

export default function App() {
  const [requesterState, setRequesterState] = useState<RequesterState>("loading");
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedRequesterId, setSelectedRequesterId] = useState<number | null>(null);
  const [currentRequester, setCurrentRequester] = useState<Requester | null>(null);
  const [requesterError, setRequesterError] = useState("");
  const [activePage, setActivePage] = useState<ActivePage>("tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  async function loadRequesters() {
    setRequesterState("loading");
    setRequesterError("");

    try {
      const loadedRequesters = await getRequesters();
      setRequesters(loadedRequesters);

      const storedId = readRequesterId();
      const storedRequester = loadedRequesters.find(({ id }) => id === storedId);
      if (storedRequester) {
        setSelectedRequesterId(storedRequester.id);
        setCurrentRequester(storedRequester);
      } else {
        clearRequesterId();
        setSelectedRequesterId(null);
        setCurrentRequester(null);
      }

      setRequesterState("success");
    } catch (error) {
      setRequesterState("error");
      setRequesterError(
        error instanceof Error ? error.message : "Unable to load Development Requesters.",
      );
    }
  }

  useEffect(() => {
    void loadRequesters();
  }, []);

  const selectedRequester = useMemo(
    () => requesters.find(({ id }) => id === selectedRequesterId) ?? null,
    [requesters, selectedRequesterId],
  );

  function handleContinue() {
    if (!selectedRequester) return;

    saveRequesterId(selectedRequester.id);
    setCurrentRequester(selectedRequester);
    setActivePage("create");
  }

  function handleChangeRequester() {
    clearRequesterId();
    setSelectedRequesterId(null);
    setCurrentRequester(null);
    setActivePage("tickets");
    setSelectedTicketId(null);
  }

  function handleOpenTicket(ticketId: number) {
    setSelectedTicketId(ticketId);
    setActivePage("detail");
  }

  return (
    <div className="container py-4" style={{ maxWidth: 760 }}>
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h1 className="h3 mb-0">
          TokTickIT <span className="text-success">IT Service Desk</span>
        </h1>

        {currentRequester && (
          <div className="d-flex align-items-center gap-2" aria-label="Current Development Requester">
            <span className="small text-secondary">Requester: {currentRequester.name}</span>
            <button className="btn btn-outline-success btn-sm" onClick={handleChangeRequester}>
              Change Requester
            </button>
          </div>
        )}
      </header>

      {currentRequester && (
        <nav className="navbar navbar-expand-sm bg-success-subtle rounded px-3 mb-4" aria-label="Main navigation">
          <div className="navbar-nav gap-2">
            <a
              className={`nav-link${activePage === "tickets" || activePage === "detail" ? " active fw-semibold" : ""}`}
              href="#my-tickets"
              aria-current={activePage === "tickets" || activePage === "detail" ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setActivePage("tickets");
              }}
            >
              My Tickets
            </a>
            <a
              className={`nav-link${activePage === "create" ? " active fw-semibold" : ""}`}
              href="#create-ticket"
              aria-current={activePage === "create" ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                setActivePage("create");
              }}
            >
              Create Ticket
            </a>
          </div>
        </nav>
      )}

      <section className="card border-0 shadow-sm mb-4" aria-label="Development Requester selection">
        <div className="card-body">
          <h2 className="h5">Development Requester</h2>

          {!currentRequester && (
            <p className="text-secondary mb-3">
              Select a Development Requester to test requester-specific behavior. This is not a
              login screen. Authentication will be introduced in Lab 3.
            </p>
          )}

          {requesterState === "loading" && (
            <p className="mb-0" role="status">
              Loading Development Requesters…
            </p>
          )}

          {requesterState === "error" && (
            <div role="alert" className="alert alert-danger mb-0">
              <p className="mb-2">Unable to load Development Requesters.</p>
              <p className="small mb-3">{requesterError}</p>
              <button className="btn btn-outline-danger" onClick={() => void loadRequesters()}>
                Try again
              </button>
            </div>
          )}

          {requesterState === "success" && !currentRequester && requesters.length === 0 && (
            <p className="alert alert-warning mb-0" role="status">
              No active Development Requesters are available.
            </p>
          )}

          {requesterState === "success" && !currentRequester && requesters.length > 0 && (
            <>
              <label className="form-label fw-semibold" htmlFor="requester-select">
                Choose a Development Requester <span className="text-danger">*</span>
              </label>
              <select
                id="requester-select"
                className="form-select"
                value={selectedRequesterId ?? ""}
                onChange={(event) =>
                  setSelectedRequesterId(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Select a requester…</option>
                {requesters.map((requester) => (
                  <option key={requester.id} value={requester.id}>
                    {requester.name} ({requester.email})
                  </option>
                ))}
              </select>
              <button
                className="btn btn-success mt-3"
                onClick={handleContinue}
                disabled={!selectedRequester}
              >
                Continue
              </button>
            </>
          )}
        </div>
      </section>

      {currentRequester && (activePage === "tickets" || activePage === "detail") && (
        <div
          className={activePage === "detail" ? "d-none" : undefined}
          aria-hidden={activePage === "detail" ? true : undefined}
        >
          <MyTickets
            requester={currentRequester}
            onCreateTicket={() => setActivePage("create")}
            onOpenTicket={handleOpenTicket}
          />
        </div>
      )}

      {currentRequester && activePage === "create" && <CreateTicket requester={currentRequester} />}

      {currentRequester && activePage === "detail" && selectedTicketId !== null && (
        <TicketDetail
          requesterId={currentRequester.id}
          ticketId={selectedTicketId}
          onBack={() => setActivePage("tickets")}
        />
      )}

    </div>
  );
}

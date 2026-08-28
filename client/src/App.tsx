import { useEffect, useMemo, useState } from "react";
import {
  Category,
  checkSystem,
  clearRequesterId,
  getRequesters,
  readRequesterId,
  Requester,
  saveRequesterId,
} from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";
type RequesterState = "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [requesterState, setRequesterState] = useState<RequesterState>("loading");
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedRequesterId, setSelectedRequesterId] = useState<number | null>(null);
  const [currentRequester, setCurrentRequester] = useState<Requester | null>(null);
  const [requesterError, setRequesterError] = useState("");

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
  }

  function handleChangeRequester() {
    clearRequesterId();
    setSelectedRequesterId(null);
    setCurrentRequester(null);
    setState("idle");
    setCategories([]);
    setErrorMessage("");
  }

  async function handleCheck() {
    setState("loading");
    setErrorMessage("");

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState(result.online ? "success" : "error");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to reach the API.");
    }
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
            <a className="nav-link active fw-semibold" href="#my-tickets" aria-current="page">
              My Tickets
            </a>
            <a className="nav-link" href="#create-ticket">
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
            <p className="alert alert-warning mb-0">
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

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "loading" && (
        <p className="mt-4" role="status">
          Checking backend status…
        </p>
      )}

      {state === "success" && (
        <section className="mt-4" aria-label="System status">
          <p className="text-success fw-bold">Online</p>
          <h2 className="h5">Request categories</h2>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        </section>
      )}

      {state === "error" && (
        <section className="mt-4" role="alert" aria-label="System status">
          <p className="text-danger fw-bold">Offline</p>
          <p>{errorMessage || "Unable to reach the API."}</p>
        </section>
      )}
    </div>
  );
}

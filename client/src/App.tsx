import { useEffect, useState } from "react";
import { ApiRequestError, AuthUser, getCurrentUser, logout, Requester } from "./api.js";
import ChangePassword from "./ChangePassword.js";
import CreateTicket from "./CreateTicket.js";
import Login from "./Login.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";

type ActivePage = "tickets" | "create" | "detail";
type AuthMode = "checking" | "login" | "change-password" | "authenticated";

function requesterFromUser(user: AuthUser): Requester {
  return { id: user.id, name: user.name, email: user.email };
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>("checking");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>("tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser()
      .then(({ user }) => {
        if (cancelled) return;
        setAuthUser(user);
        setAuthMode(user.mustChangePassword ? "change-password" : "authenticated");
      })
      .catch((error) => {
        if (cancelled) return;
        // A missing session is the normal signed-out state. Other failures
        // still show the login screen without exposing transport details.
        if (error instanceof ApiRequestError && error.status !== 401) {
          setAuthUser(null);
        }
        setAuthMode("login");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentRequester =
    authUser?.role === "REQUESTER" ? requesterFromUser(authUser) : null;

  function handleLogin(user: AuthUser) {
    setAuthUser(user);
    setSelectedTicketId(null);
    setActivePage("tickets");
    setAuthMode(user.mustChangePassword ? "change-password" : "authenticated");
  }

  function handlePasswordChanged(user: AuthUser) {
    setAuthUser(user);
    setAuthMode("authenticated");
    setActivePage("tickets");
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Clear local state even if the network is unavailable.
    }
    setAuthUser(null);
    setSelectedTicketId(null);
    setActivePage("tickets");
    setAuthMode("login");
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

        {authUser && authMode !== "login" && authMode !== "checking" && (
          <div className="d-flex align-items-center gap-2" aria-label="Current user">
            <span className="small text-secondary">
              {authUser.name} <span className="badge text-bg-success">{authUser.role}</span>
            </span>
            <button className="btn btn-outline-success btn-sm" onClick={() => void handleLogout()}>
              Logout
            </button>
          </div>
        )}
      </header>

      {currentRequester && authMode === "authenticated" && (
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

      {authMode === "checking" && (
        <p className="card card-body border-0 shadow-sm" role="status">
          Checking your session…
        </p>
      )}

      {authMode === "login" && <Login onSuccess={handleLogin} />}

      {authMode === "change-password" && authUser && (
        <ChangePassword user={authUser} onSuccess={handlePasswordChanged} />
      )}

      {authMode === "authenticated" && authUser && !currentRequester && (
        <section className="card border-0 shadow-sm" aria-labelledby="role-workspace-title">
          <div className="card-body">
            <h2 id="role-workspace-title" className="h4">Welcome, {authUser.name}</h2>
            <p className="mb-0">
              Your {authUser.role.replace("_", " ")} workspace will be available in the next Lab 3 issue.
            </p>
          </div>
        </section>
      )}

      {authMode === "authenticated" && currentRequester && (
        <MyTickets
          requester={currentRequester}
          onCreateTicket={() => setActivePage("create")}
          onOpenTicket={handleOpenTicket}
          visible={activePage === "tickets"}
        />
      )}

      {authMode === "authenticated" && currentRequester && activePage === "create" && (
        <CreateTicket requester={currentRequester} />
      )}

      {authMode === "authenticated" && currentRequester && activePage === "detail" && selectedTicketId !== null && (
        <TicketDetail
          ticketId={selectedTicketId}
          onBack={() => setActivePage("tickets")}
        />
      )}
    </div>
  );
}

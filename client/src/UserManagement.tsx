import { FormEvent, useEffect, useState } from "react";
import {
  AdminUser,
  ApiRequestError,
  UserRole,
  createAdminUser,
  getAdminUsers,
  setAdminUserInitialPassword,
  updateAdminUser,
} from "./api.js";

const roles: UserRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
type Draft = { name: string; email: string; role: UserRole; isActive: boolean; initialPassword: string };
const emptyDraft: Draft = { name: "", email: "", role: "REQUESTER", isActive: true, initialPassword: "" };

function roleLabel(role: UserRole): string {
  return role.replaceAll("_", " ");
}

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [roleDraft, setRoleDraft] = useState<UserRole | "">("");
  const [role, setRole] = useState<UserRole | "">("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [success, setSuccess] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedImpact, setConfirmedImpact] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const requiresImpactConfirmation = Boolean(editingUser && (
    (editingUser.isActive && !draft.isActive) ||
    (editingUser.role === "ADMINISTRATOR" && draft.role !== "ADMINISTRATOR")
  ));

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError("");
    void getAdminUsers({ search, ...(role ? { role } : {}) })
      .then((result) => {
        if (current) setUsers(result);
      })
      .catch((error: unknown) => {
        if (!current) return;
        setLoadError(error instanceof ApiRequestError && error.status === 403
          ? "You do not have permission to manage users."
          : "Unable to load users. Check the connection and try again.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [search, role, reloadKey]);

  function startCreate() {
    setEditingUser(null);
    setDraft(emptyDraft);
    setFormError("");
    setConfirmedImpact(false);
    setSuccess("");
    setFormOpen(true);
  }

  function startEdit(user: AdminUser) {
    setEditingUser(user);
    setDraft({ name: user.name, email: user.email, role: user.role, isActive: user.isActive, initialPassword: "" });
    setFormError("");
    setConfirmedImpact(false);
    setSuccess("");
    setFormOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    if (!draft.name.trim() || !draft.email.trim() || (!editingUser && !draft.initialPassword)) {
      setFormError("Enter a name, valid email, and initial password.");
      return;
    }
    if (requiresImpactConfirmation && !confirmedImpact) {
      setFormError("Confirm the account access or Administrator role change before saving.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingUser) {
        await updateAdminUser(editingUser.id, {
          name: draft.name,
          email: draft.email,
          role: draft.role,
          isActive: draft.isActive,
        });
        setSuccess("User updated.");
      } else {
        await createAdminUser(draft);
        setSuccess("User created. They must change the initial password at next sign-in.");
      }
      setFormOpen(false);
      setEditingUser(null);
      setDraft(emptyDraft);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save this user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetPassword(event: FormEvent<HTMLFormElement>, user: AdminUser) {
    event.preventDefault();
    setPasswordError("");
    setSuccess("");
    setPasswordBusy(true);
    try {
      await setAdminUserInitialPassword(user.id, passwordDraft);
      setPasswordUserId(null);
      setPasswordDraft("");
      setSuccess(`Initial password set for ${user.name}; it must be changed at next sign-in.`);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to set the initial password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <section aria-labelledby="user-management-title">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h2 id="user-management-title" className="h4 mb-1">User Management</h2>
          <p className="text-secondary mb-0">Manage account details, roles, access, and initial passwords.</p>
        </div>
        <button className="btn btn-success" type="button" onClick={startCreate}>Add user</button>
      </div>

      {success && <p className="alert alert-success py-2" role="status">{success}</p>}

      {formOpen && (
        <form className="card border-0 shadow-sm mb-4" onSubmit={(event) => void handleSave(event)} noValidate>
          <div className="card-body">
            <h3 className="h5">{editingUser ? `Edit ${editingUser.name}` : "Create user"}</h3>
            {formError && <div className="alert alert-danger py-2" role="alert">{formError}</div>}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="admin-user-name">Name</label>
                <input id="admin-user-name" name="name" className="form-control" value={draft.name} maxLength={120}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="admin-user-email">Email</label>
                <input id="admin-user-email" name="email" className="form-control" type="email" spellCheck={false} value={draft.email} maxLength={254}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })} required />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="admin-user-role">Role</label>
                <select id="admin-user-role" name="role" className="form-select" value={draft.role}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })}>
                  {roles.map((option) => <option key={option} value={option}>{roleLabel(option)}</option>)}
                </select>
              </div>
              <div className="col-md-6 d-flex align-items-end pb-2">
                <div className="form-check">
                  <input id="admin-user-active" name="isActive" className="form-check-input" type="checkbox" checked={draft.isActive}
                    onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
                  <label className="form-check-label" htmlFor="admin-user-active">Active account</label>
                </div>
              </div>
              {!editingUser && <div className="col-md-6">
                <label className="form-label" htmlFor="admin-user-password">Initial password</label>
                <input id="admin-user-password" name="initialPassword" className="form-control" type="password" autoComplete="new-password"
                  value={draft.initialPassword} onChange={(event) => setDraft({ ...draft, initialPassword: event.target.value })} required />
                <div className="form-text">12–128 characters, including uppercase, lowercase, and a number.</div>
              </div>}
              {requiresImpactConfirmation && <div className="col-12">
                <div className="alert alert-warning mb-0">
                  <p className="mb-2">This change affects sign-in access or Administrator availability.</p>
                  <div className="form-check">
                    <input id="admin-user-confirm-impact" name="confirmImpact" className="form-check-input" type="checkbox" checked={confirmedImpact}
                      onChange={(event) => setConfirmedImpact(event.target.checked)} />
                    <label className="form-check-label" htmlFor="admin-user-confirm-impact">
                      I understand and want to continue.
                    </label>
                  </div>
                </div>
              </div>}
            </div>
            <div className="d-flex gap-2 mt-3">
              <button className="btn btn-success" type="submit" disabled={submitting || (requiresImpactConfirmation && !confirmedImpact)}>
                {submitting ? "Saving…" : "Save user"}
              </button>
              <button className="btn btn-outline-secondary" type="button" disabled={submitting}
                onClick={() => { setFormOpen(false); setEditingUser(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <form className="row g-2 align-items-end mb-3" onSubmit={(event) => {
        event.preventDefault();
        setSearch(searchDraft.trim());
        setRole(roleDraft);
      }}>
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="admin-user-search">Search name or email</label>
          <input id="admin-user-search" name="search" className="form-control" value={searchDraft} maxLength={100}
            onChange={(event) => setSearchDraft(event.target.value)} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="admin-user-role-filter">Filter by role</label>
          <select id="admin-user-role-filter" name="roleFilter" className="form-select" value={roleDraft}
            onChange={(event) => setRoleDraft(event.target.value as UserRole | "")}>
            <option value="">All roles</option>
            {roles.map((option) => <option key={option} value={option}>{roleLabel(option)}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-2 d-grid">
          <button className="btn btn-outline-success" type="submit">Apply filters</button>
        </div>
      </form>

      {loading && <p className="card card-body border-0 shadow-sm" role="status">Loading users…</p>}
      {!loading && loadError && <div className="alert alert-danger" role="alert">
        <p className="mb-2">{loadError}</p>
        <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => setReloadKey((value) => value + 1)}>Try again</button>
      </div>}
      {!loading && !loadError && users.length === 0 && (
        <p className="card card-body border-0 shadow-sm" role="status">
          {search || role ? "No users match your search and filters." : "No users are available."}
        </p>
      )}
      {!loading && !loadError && users.length > 0 && <div className="d-grid gap-2">
        {users.map((user) => (
          <article className="card border-0 shadow-sm" key={user.id}>
            <div className="card-body d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
              <div className="min-w-0">
                <h3 className="h6 mb-1">{user.name}</h3>
                <p className="text-secondary mb-2 text-break">{user.email}</p>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge text-bg-success">{roleLabel(user.role)}</span>
                  <span className={`badge ${user.isActive ? "text-bg-success" : "text-bg-secondary"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-outline-success btn-sm" type="button" onClick={() => startEdit(user)}>Edit</button>
                <button className="btn btn-outline-secondary btn-sm" type="button"
                  onClick={() => { setPasswordUserId(passwordUserId === user.id ? null : user.id); setPasswordError(""); setPasswordDraft(""); }}>
                  Set New Initial Password
                </button>
              </div>
            </div>
            {passwordUserId === user.id && <form className="card-footer bg-white" onSubmit={(event) => void handleSetPassword(event, user)}>
              <label className="form-label" htmlFor={`admin-reset-password-${user.id}`}>New initial password</label>
              <div className="d-flex flex-column flex-sm-row gap-2">
                <input id={`admin-reset-password-${user.id}`} name="initialPassword" className="form-control" type="password" autoComplete="new-password"
                  value={passwordDraft} onChange={(event) => setPasswordDraft(event.target.value)} required />
                <button className="btn btn-success flex-shrink-0" type="submit" disabled={passwordBusy}>
                  {passwordBusy ? "Saving…" : "Set password"}
                </button>
              </div>
              {passwordError && <p className="text-danger mb-0 mt-2" role="alert">{passwordError}</p>}
              <p className="form-text mb-0 mt-2">12–128 characters, including uppercase, lowercase, and a number. The user must change it at next sign-in.</p>
            </form>}
          </article>
        ))}
      </div>}
    </section>
  );
}

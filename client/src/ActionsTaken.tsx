import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  type ActionRevision,
  type ActionStatus,
  type ActionTaken,
  ApiRequestError,
  getActionRevisions,
  getActionsTaken,
  type Pagination,
  type StaffUser,
  type TicketStatus,
  writeActionTaken,
} from "./api.js";

export interface ActionsTakenProps {
  ticketId: number;
  ticketStatus: TicketStatus;
  // Staff/Admin only; a Requester view passes none of these and gets no write controls.
  editable?: {
    currentUserId: number;
    ticketUpdatedAt: string;
    assignees: StaffUser[];
    assigneesError: string;
    onRetryAssignees: () => void;
    // Called after every saved write with the Ticket's new timestamp, so the parent can refresh the gate.
    onChanged: (ticketUpdatedAt: string) => void;
  };
}

type PanelKind = "create" | "edit" | "assign" | "complete" | "cancel";
// `opened` is what the user started editing (diff base); `action` follows Load Latest for id and version.
type Panel = { kind: PanelKind; action: ActionTaken | null; opened: ActionTaken | null };
type Draft = {
  actionAtIso: string | null; // exact loaded/default instant until the user edits the date
  actionAt: string;
  description: string;
  result: string;
  assigneeId: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
  cancellationReason: string;
  confirmCancel: boolean;
};
type Command = { method: "POST" | "PATCH"; path: string; body: Record<string, unknown> };
type Feedback = { kind: "success" | "error"; message: string; reload?: boolean };

const lockedStatuses: TicketStatus[] = ["RESOLVED", "CLOSED", "CANCELLED"];
const statusLabel: Record<ActionStatus, string> = {
  PLANNED: "Planned", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const statusClass: Record<ActionStatus, string> = {
  PLANNED: "text-bg-secondary", IN_PROGRESS: "text-bg-warning text-dark", COMPLETED: "text-bg-success", CANCELLED: "text-bg-light border text-dark",
};
const panelTitle: Record<PanelKind, string> = {
  create: "Add Action", edit: "Edit Action", assign: "Reassign Action", complete: "Complete Action", cancel: "Cancel Action",
};

const bangkokParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
// Value for <input type="datetime-local"> in Bangkok time.
function toBangkokInput(iso: string): string {
  const p = Object.fromEntries(bangkokParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
// Bangkok has no daylight saving, so +07:00 is always the right offset.
function fromBangkokInput(value: string): string {
  return `${value.length === 16 ? `${value}:00` : value}+07:00`;
}
export function formatBangkok(iso: string): string {
  return `${new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} (Bangkok)`;
}

function draftFor(action: ActionTaken | null, currentUserId: number): Draft {
  const at = action?.actionAt ?? new Date().toISOString();
  return {
    actionAtIso: at,
    actionAt: toBangkokInput(at),
    description: action?.description ?? "",
    result: action?.result ?? "",
    assigneeId: String(action?.assignee.id ?? currentUserId),
    followUpRequired: action?.followUpRequired ?? false,
    followUpNote: action?.followUpNote ?? "",
    attachmentNotes: action?.attachmentNotes ?? "",
    cancellationReason: "",
    confirmCancel: false,
  };
}

const actionAtOf = (draft: Draft) => draft.actionAtIso ?? fromBangkokInput(draft.actionAt);
const noteOf = (draft: Draft) => (draft.followUpRequired ? draft.followUpNote.trim() : null);
const attachmentNotesOf = (draft: Draft) => draft.attachmentNotes.trim() || null;

function validate(panel: Panel, draft: Draft, assignees: StaffUser[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const { kind, action } = panel;
  if (kind === "create" || kind === "edit") {
    const at = new Date(actionAtOf(draft));
    if (!draft.actionAt || Number.isNaN(at.getTime())) errors.actionAt = "Enter the Action date and time.";
    else if (at.getTime() > Date.now()) errors.actionAt = "The action cannot be in the future.";
    if (!draft.description.trim()) errors.description = "Describe the action.";
    if (kind === "edit" && action?.status === "COMPLETED" && !draft.result.trim()) errors.result = "A completed Action needs a result.";
  }
  if (kind === "complete" && !draft.result.trim()) errors.result = "Record the result before completing.";
  if ((kind === "create" || kind === "edit" || kind === "complete") && draft.followUpRequired && !draft.followUpNote.trim()) {
    errors.followUpNote = "Describe the required follow-up.";
  }
  if (kind === "create" || kind === "assign") {
    if (!assignees.some((user) => String(user.id) === draft.assigneeId)) errors.assigneeId = "Choose an active IT Staff member or Administrator.";
    else if (kind === "assign" && action && String(action.assignee.id) === draft.assigneeId) errors.assigneeId = "Choose a different person.";
  }
  if (kind === "cancel") {
    const reason = draft.cancellationReason.trim();
    if (reason.length < 5 || reason.length > 500) errors.cancellationReason = "Give a reason of 5 to 500 characters.";
    if (!draft.confirmCancel) errors.confirm = "Confirm that you want to cancel this Action.";
  }
  return errors;
}

function commandFor(ticketId: number, ticketUpdatedAt: string, panel: Panel, draft: Draft): Command | Record<string, string> {
  const base = `/api/tickets/${ticketId}/actions-taken`;
  const { kind, action } = panel;
  if (kind === "create") {
    const body: Record<string, unknown> = {
      ticketUpdatedAt, actionAt: actionAtOf(draft), description: draft.description.trim(), assigneeId: Number(draft.assigneeId),
      followUpRequired: draft.followUpRequired, followUpNote: noteOf(draft), attachmentNotes: attachmentNotesOf(draft),
    };
    if (draft.result.trim()) body.result = draft.result.trim();
    return { method: "POST", path: base, body };
  }
  const path = `${base}/${action!.id}`;
  const stamp = { ticketUpdatedAt, version: action!.version };
  if (kind === "assign") return { method: "PATCH", path: `${path}/assignee`, body: { ...stamp, assigneeId: Number(draft.assigneeId) } };
  if (kind === "cancel") {
    return { method: "PATCH", path: `${path}/status`, body: { ...stamp, status: "CANCELLED", confirm: true, cancellationReason: draft.cancellationReason.trim() } };
  }
  if (kind === "complete") {
    return {
      method: "PATCH", path: `${path}/status`,
      body: { ...stamp, status: "COMPLETED", result: draft.result.trim(), followUpRequired: draft.followUpRequired, followUpNote: noteOf(draft) },
    };
  }
  // Edit sends only what the user changed, so another user's newer value in an untouched field survives.
  const opened = panel.opened!;
  const changes: Record<string, unknown> = {};
  if (new Date(actionAtOf(draft)).getTime() !== new Date(opened.actionAt).getTime()) changes.actionAt = actionAtOf(draft);
  if (draft.description.trim() !== opened.description) changes.description = draft.description.trim();
  if (draft.result.trim() !== opened.result) changes.result = draft.result.trim();
  if (draft.followUpRequired !== opened.followUpRequired) changes.followUpRequired = draft.followUpRequired;
  if (noteOf(draft) !== opened.followUpNote) changes.followUpNote = noteOf(draft);
  if (attachmentNotesOf(draft) !== opened.attachmentNotes) changes.attachmentNotes = attachmentNotesOf(draft);
  if (Object.keys(changes).length === 0) return { body: "Change at least one field before saving." };
  return { method: "PATCH", path, body: { ...stamp, ...changes } };
}

function failure(error: unknown): { feedback: Feedback; fieldErrors: Record<string, string> } {
  if (error instanceof ApiRequestError) {
    if (error.status === 400) {
      return {
        feedback: { kind: "error", message: "The Action was not saved. Check the fields below; your draft is kept." },
        fieldErrors: (error.body?.fieldErrors as Record<string, string> | undefined) ?? {},
      };
    }
    if (error.code === "STALE_STATE") {
      return {
        feedback: { kind: "error", reload: true, message: "This Ticket or Action changed after you loaded it. Your draft is kept: load the latest values, review your draft and save again." },
        fieldErrors: {},
      };
    }
    if (error.status === 409 || error.status === 404) {
      return { feedback: { kind: "error", reload: true, message: `${error.message} Your draft is kept.` }, fieldErrors: {} };
    }
    if (error.status === 403) return { feedback: { kind: "error", message: "You do not have permission to change Actions on this Ticket." }, fieldErrors: {} };
    if (error.status === 401) return { feedback: { kind: "error", message: "Your session has ended. Sign in again to continue." }, fieldErrors: {} };
  }
  return {
    feedback: { kind: "error", message: "The Action could not be saved because of a network or server problem. Your draft is kept; try again." },
    fieldErrors: {},
  };
}

export default function ActionsTaken({ ticketId, ticketStatus, editable }: ActionsTakenProps) {
  const alive = useRef(true);
  const saving = useRef(false);
  // Same command (same draft and versions) keeps its request id across retries; any change gets a new one.
  const pendingCommand = useRef<{ key: string; mutationId: string } | null>(null);
  const [items, setItems] = useState<ActionTaken[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ actionId: number; page: number; items: ActionRevision[]; pagination: Pagination | null; state: "loading" | "success" | "error" } | null>(null);

  const locked = lockedStatuses.includes(ticketStatus);
  const assignees = editable?.assignees ?? [];
  const eligible = (action: ActionTaken) =>
    action.assignee.isActive && (editable?.assigneesError ? true : assignees.some((user) => user.id === action.assignee.id));

  async function loadPage(target: number, focus?: string) {
    setLoadState("loading");
    try {
      const response = await getActionsTaken(ticketId, target);
      if (!alive.current) return;
      setItems(response.items);
      setPagination(response.pagination);
      setPage(response.pagination.page);
      setLoadState("success");
      // Keep an open form on the newest copy of its Action, but never touch the user's draft.
      setPanel((current) => {
        if (!current?.action) return current;
        const fresh = response.items.find((item) => item.id === current.action!.id);
        return fresh ? { ...current, action: fresh } : current;
      });
      if (focus) setFocusId(focus);
    } catch (error) {
      if (!alive.current) return;
      setLoadState("error");
      setLoadError(
        error instanceof ApiRequestError && error.status === 403 ? "You do not have permission to view these Actions."
          : error instanceof ApiRequestError && error.status === 404 ? "Ticket not found."
            : "Actions Taken could not be loaded.",
      );
    }
  }

  useEffect(() => {
    alive.current = true;
    void loadPage(1);
    return () => {
      alive.current = false;
    };
  }, [ticketId]);

  useEffect(() => {
    if (!focusId || loadState !== "success") return;
    document.getElementById(focusId)?.focus();
    setFocusId(null);
  }, [focusId, loadState, items]);

  function openPanel(kind: PanelKind, action: ActionTaken | null) {
    if (panel && draft && !window.confirm("Discard the Action form you have open?")) return;
    setPanel({ kind, action, opened: action });
    setDraft(draftFor(action, editable!.currentUserId));
    setFieldErrors({});
    setFeedback(null);
    setFocusId("action-form-title");
  }

  function closePanel() {
    if (!window.confirm("Discard this Action form? Unsaved changes will be lost.")) return;
    const back = panel?.action ? `action-${panel.action.id}` : "actions-taken-title";
    setPanel(null);
    setDraft(null);
    setFieldErrors({});
    setFocusId(back);
  }

  function edit<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value, ...(key === "actionAt" ? { actionAtIso: null } : {}) } : current));
  }

  function toggleFollowUp(checked: boolean) {
    if (!checked && draft?.followUpNote.trim() && !window.confirm("Turning off follow-up removes the follow-up note. Continue?")) return;
    setDraft((current) => (current ? { ...current, followUpRequired: checked, followUpNote: checked ? current.followUpNote : "" } : current));
  }

  async function send(command: Command, success: string, onSaved: () => void) {
    if (saving.current || !editable) return;
    const key = JSON.stringify(command);
    if (pendingCommand.current?.key !== key) pendingCommand.current = { key, mutationId: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    setFeedback(null);
    setFieldErrors({});
    try {
      const response = await writeActionTaken(command.method, command.path, { mutationId: pendingCommand.current.mutationId, ...command.body });
      if (!alive.current) return;
      pendingCommand.current = null;
      onSaved();
      editable.onChanged(response.ticketUpdatedAt);
      setFeedback({
        kind: "success",
        message: response.replayed ? "This change had already been saved. The latest values are shown." : success,
      });
      await loadPage(page, `action-${response.action.id}`);
    } catch (error) {
      if (!alive.current) return;
      const result = failure(error);
      // A rejected command is finished; the next attempt is a new one after review.
      if (error instanceof ApiRequestError) pendingCommand.current = null;
      setFeedback(result.feedback);
      setFieldErrors(result.fieldErrors);
      setDraft((current) => (current ? { ...current, confirmCancel: false } : current));
    } finally {
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!panel || !draft || !editable) return;
    const errors = validate(panel, draft, assignees);
    const command = Object.keys(errors).length ? errors : commandFor(ticketId, editable.ticketUpdatedAt, panel, draft);
    if (!("method" in command)) {
      setFieldErrors(command as Record<string, string>);
      setFeedback({ kind: "error", message: "The Action was not saved. Check the fields below; your draft is kept." });
      return;
    }
    const message = {
      create: "Action added.", edit: "Action updated.", assign: "Action reassigned.", complete: "Action completed.", cancel: "Action cancelled.",
    }[panel.kind];
    void send(command as Command, message, () => {
      setPanel(null);
      setDraft(null);
    });
  }

  function start(action: ActionTaken) {
    if (!editable) return;
    void send(
      { method: "PATCH", path: `/api/tickets/${ticketId}/actions-taken/${action.id}/status`, body: { ticketUpdatedAt: editable.ticketUpdatedAt, version: action.version, status: "IN_PROGRESS" } },
      "Action started.",
      () => undefined,
    );
  }

  function loadLatest() {
    pendingCommand.current = null;
    setFeedback(null);
    editable?.onChanged(editable.ticketUpdatedAt);
    void loadPage(page);
  }

  async function openHistory(actionId: number, target = 1) {
    setHistory({ actionId, page: target, items: [], pagination: null, state: "loading" });
    setFocusId(`action-history-${actionId}`);
    try {
      const response = await getActionRevisions(ticketId, actionId, target);
      if (!alive.current) return;
      setHistory((current) => (current?.actionId === actionId && current.page === target ? { ...current, ...response, state: "success" } : current));
    } catch {
      if (!alive.current) return;
      setHistory((current) => (current?.actionId === actionId && current.page === target ? { ...current, state: "error" } : current));
    }
  }

  function closeHistory(actionId: number) {
    setHistory(null);
    setFocusId(`action-history-toggle-${actionId}`);
  }

  const errorProps = (key: string, help?: string) => ({
    "aria-invalid": fieldErrors[key] ? true : undefined,
    "aria-describedby": [help, fieldErrors[key] ? `action-${key}-error` : undefined].filter(Boolean).join(" ") || undefined,
  });
  const errorText = (key: string) =>
    fieldErrors[key] ? <div id={`action-${key}-error`} className="invalid-feedback d-block">{fieldErrors[key]}</div> : null;
  const otherErrors = Object.entries(fieldErrors).filter(([key]) =>
    !["actionAt", "description", "result", "assigneeId", "followUpNote", "attachmentNotes", "cancellationReason", "confirm"].includes(key));

  function renderForm() {
    if (!panel || !draft || !editable) return null;
    const { kind, action } = panel;
    const describes = kind === "create" || kind === "edit";
    const showResult = describes || kind === "complete";
    const showFollowUp = describes || kind === "complete";
    return (
      <form className="border border-success rounded p-3 mb-3 bg-white" onSubmit={submit} noValidate aria-labelledby="action-form-title">
        <h4 id="action-form-title" className="h6" tabIndex={-1}>
          {panelTitle[kind]}{action ? `: ${action.description.slice(0, 60)}` : ""}
        </h4>
        {action && (
          <p className="small text-secondary">
            Performed by {action.performedBy.name} · version {action.version} · status {statusLabel[action.status]} (read-only here)
          </p>
        )}
        {describes && (
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="action-at">Action Date/Time (Bangkok) <span className="text-danger" aria-hidden="true">*</span></label>
            <input id="action-at" type="datetime-local" step={1} className={`form-control ${fieldErrors.actionAt ? "is-invalid" : ""}`}
              value={draft.actionAt} onChange={(event) => edit("actionAt", event.target.value)} {...errorProps("actionAt")} />
            {errorText("actionAt")}
          </div>
        )}
        {describes && (
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="action-description">Description <span className="text-danger" aria-hidden="true">*</span></label>
            <textarea id="action-description" className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`} rows={3} maxLength={4000}
              value={draft.description} onChange={(event) => edit("description", event.target.value)} {...errorProps("description")} />
            {errorText("description")}
          </div>
        )}
        {showResult && (
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="action-result">Result{kind === "complete" ? " (required to complete)" : ""}{kind === "complete" || action?.status === "COMPLETED" ? <> <span className="text-danger" aria-hidden="true">*</span></> : null}</label>
            <textarea id="action-result" className={`form-control ${fieldErrors.result ? "is-invalid" : ""}`} rows={2} maxLength={4000}
              value={draft.result} onChange={(event) => edit("result", event.target.value)} {...errorProps("result")} />
            {errorText("result")}
          </div>
        )}
        {(kind === "create" || kind === "assign") && (
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="action-assignee">Assigned to <span className="text-danger" aria-hidden="true">*</span></label>
            {editable.assigneesError ? (
              <div className="alert alert-warning py-2" role="alert">
                Eligible assignees could not be loaded, so this form cannot be saved yet.
                <button type="button" className="btn btn-sm btn-outline-dark ms-2" onClick={editable.onRetryAssignees}>Retry loading assignees</button>
              </div>
            ) : (
              <select id="action-assignee" className={`form-select ${fieldErrors.assigneeId ? "is-invalid" : ""}`} value={draft.assigneeId}
                onChange={(event) => edit("assigneeId", event.target.value)} {...errorProps("assigneeId")}>
                {action && !eligible(action) && <option value={action.assignee.id} disabled>{action.assignee.name} (not eligible)</option>}
                {assignees.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role === "ADMINISTRATOR" ? "Administrator" : "IT Staff"})</option>)}
              </select>
            )}
            {errorText("assigneeId")}
          </div>
        )}
        {showFollowUp && (
          <div className="mb-3">
            <div className="form-check">
              <input id="action-follow-up" type="checkbox" className="form-check-input" checked={draft.followUpRequired}
                onChange={(event) => toggleFollowUp(event.target.checked)} />
              <label className="form-check-label fw-semibold" htmlFor="action-follow-up">Follow-Up Required?</label>
            </div>
            {draft.followUpRequired && (
              <>
                <label className="form-label fw-semibold mt-2" htmlFor="action-follow-up-note">Follow-up Note <span className="text-danger" aria-hidden="true">*</span></label>
                <textarea id="action-follow-up-note" className={`form-control ${fieldErrors.followUpNote ? "is-invalid" : ""}`} rows={2} maxLength={2000}
                  value={draft.followUpNote} onChange={(event) => edit("followUpNote", event.target.value)} {...errorProps("followUpNote")} />
              </>
            )}
            {errorText("followUpNote")}
          </div>
        )}
        {describes && (
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="action-attachment-notes">Attachment Notes</label>
            <textarea id="action-attachment-notes" className={`form-control ${fieldErrors.attachmentNotes ? "is-invalid" : ""}`} rows={2} maxLength={2000}
              value={draft.attachmentNotes} onChange={(event) => edit("attachmentNotes", event.target.value)} {...errorProps("attachmentNotes", "action-attachment-notes-help")} />
            <div id="action-attachment-notes-help" className="form-text">Refer to files already attached to this Ticket by name. This does not upload files.</div>
            {errorText("attachmentNotes")}
          </div>
        )}
        {kind === "cancel" && (
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="action-cancel-reason">Cancellation Reason <span className="text-danger" aria-hidden="true">*</span></label>
            <textarea id="action-cancel-reason" className={`form-control ${fieldErrors.cancellationReason ? "is-invalid" : ""}`} rows={2} maxLength={500}
              value={draft.cancellationReason} onChange={(event) => edit("cancellationReason", event.target.value)} {...errorProps("cancellationReason")} />
            {errorText("cancellationReason")}
            <div className="form-check mt-2">
              <input id="action-cancel-confirm" type="checkbox" className={`form-check-input ${fieldErrors.confirm ? "is-invalid" : ""}`} checked={draft.confirmCancel}
                onChange={(event) => edit("confirmCancel", event.target.checked)} {...errorProps("confirm")} />
              <label className="form-check-label" htmlFor="action-cancel-confirm">
                I confirm cancelling this Action. This cancels the Action only, not the Ticket.
              </label>
            </div>
            {errorText("confirm")}
          </div>
        )}
        {otherErrors.map(([key, message]) => <p key={key} className="text-danger small mb-2" role="alert">{message}</p>)}
        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className={kind === "cancel" ? "btn btn-danger" : "btn btn-success"}
            disabled={busy || ((kind === "create" || kind === "assign") && Boolean(editable.assigneesError))}>
            {busy ? "Saving…" : kind === "cancel" ? "Cancel this Action" : kind === "complete" ? "Complete Action" : "Save Action"}
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={closePanel}>Discard form</button>
        </div>
      </form>
    );
  }

  function renderHistory(action: ActionTaken) {
    if (history?.actionId !== action.id) return null;
    return (
      <div className="border-top mt-3 pt-3">
        <h5 id={`action-history-${action.id}`} className="h6" tabIndex={-1}>History for this Action</h5>
        {history.state === "loading" && <p role="status" className="small">Loading history…</p>}
        {history.state === "error" && (
          <p role="alert" className="small text-danger">
            The history could not be loaded.
            <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => void openHistory(action.id, history.page)}>Retry</button>
          </p>
        )}
        {history.state === "success" && (
          <ol className="list-unstyled small mb-2">
            {history.items.map((revision) => (
              <li key={revision.version} className="border rounded p-2 mb-2">
                <strong>Version {revision.version}: {revision.operation}</strong> by {revision.actor.name} on {formatBangkok(revision.createdAt)}
                <div className="text-secondary" style={{ whiteSpace: "pre-wrap" }}>
                  Status {statusLabel[revision.snapshot.status]} · assigned to {revision.snapshot.assignee.name} · {revision.snapshot.description}
                  {revision.snapshot.result ? ` · result: ${revision.snapshot.result}` : ""}
                  {revision.snapshot.followUpRequired ? ` · follow-up: ${revision.snapshot.followUpNote}` : ""}
                  {revision.snapshot.cancellationReason ? ` · cancelled: ${revision.snapshot.cancellationReason}` : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="d-flex flex-wrap gap-2">
          {history.pagination && history.pagination.totalPages > 1 && (
            <>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={history.page <= 1} onClick={() => void openHistory(action.id, history.page - 1)}>Earlier versions</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={history.page >= history.pagination.totalPages} onClick={() => void openHistory(action.id, history.page + 1)}>Later versions</button>
            </>
          )}
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => closeHistory(action.id)}>Close History</button>
        </div>
      </div>
    );
  }

  function renderAction(action: ActionTaken) {
    const pending = action.status === "PLANNED" || action.status === "IN_PROGRESS";
    const canWrite = Boolean(editable) && !locked && action.status !== "CANCELLED";
    const assigneeOk = eligible(action);
    return (
      <li key={action.id} id={`action-${action.id}`} tabIndex={-1} className="list-group-item" aria-label={`Action: ${action.description.slice(0, 80)}`}>
        <div className="d-flex flex-wrap justify-content-between gap-2">
          <span className={`badge ${statusClass[action.status]}`}>{statusLabel[action.status]}</span>
          <span className="small text-secondary">Version {action.version}</span>
        </div>
        <p className="mt-2 mb-2" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{action.description}</p>
        <dl className="row small mb-0">
          <dt className="col-sm-4">Action Date/Time</dt><dd className="col-sm-8">{formatBangkok(action.actionAt)}</dd>
          <dt className="col-sm-4">Performed by</dt><dd className="col-sm-8">{action.performedBy.name}</dd>
          <dt className="col-sm-4">Assigned to</dt>
          <dd className="col-sm-8">
            {action.assignee.name}
            {canWrite && !assigneeOk && <span className="badge text-bg-warning text-dark ms-2">Not eligible: reassign first</span>}
          </dd>
          <dt className="col-sm-4">Result</dt><dd className="col-sm-8" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{action.result || "Not recorded"}</dd>
          <dt className="col-sm-4">Follow-Up Required?</dt>
          <dd className="col-sm-8" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{action.followUpRequired ? `Yes: ${action.followUpNote}` : "No"}</dd>
          <dt className="col-sm-4">Attachment Notes</dt><dd className="col-sm-8" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{action.attachmentNotes ?? "None"}</dd>
          {action.cancellationReason && (<><dt className="col-sm-4">Cancellation Reason</dt><dd className="col-sm-8">{action.cancellationReason}</dd></>)}
          <dt className="col-sm-4">Created / Updated</dt><dd className="col-sm-8">{formatBangkok(action.createdAt)} / {formatBangkok(action.updatedAt)}</dd>
        </dl>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <button type="button" id={`action-history-toggle-${action.id}`} className="btn btn-sm btn-outline-secondary"
            aria-expanded={history?.actionId === action.id}
            onClick={() => (history?.actionId === action.id ? closeHistory(action.id) : void openHistory(action.id))}>
            View History
          </button>
          {canWrite && (
            <>
              <button type="button" className="btn btn-sm btn-outline-success" disabled={busy || !assigneeOk} onClick={() => openPanel("edit", action)}>Edit</button>
              <button type="button" className="btn btn-sm btn-outline-success" disabled={busy} onClick={() => openPanel("assign", action)}>Reassign</button>
              {action.status === "PLANNED" && (
                <button type="button" className="btn btn-sm btn-outline-success" disabled={busy || !assigneeOk} onClick={() => start(action)}>Start</button>
              )}
              {pending && (
                <button type="button" className="btn btn-sm btn-success" disabled={busy || !assigneeOk} onClick={() => openPanel("complete", action)}>Complete</button>
              )}
              {pending && (
                <button type="button" className="btn btn-sm btn-outline-danger ms-sm-auto" disabled={busy} onClick={() => openPanel("cancel", action)}>Cancel Action</button>
              )}
            </>
          )}
        </div>
        {renderHistory(action)}
      </li>
    );
  }

  return (
    <section className="border border-success rounded p-3 mb-4" aria-labelledby="actions-taken-title">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h3 id="actions-taken-title" className="h5 mb-0" tabIndex={-1}>Actions Taken</h3>
        {editable && !locked && (
          <button type="button" className="btn btn-success" disabled={busy} onClick={() => openPanel("create", null)}>Add Action</button>
        )}
      </div>
      <p className="text-secondary small">
        {editable
          ? "Work recorded on this Ticket. Performed by is set automatically; Assigned to can differ from the Ticket Owner. Use Internal Notes for private material."
          : "Work the support team has recorded on your Ticket. This list is read-only."}
      </p>
      {editable && locked && (
        <p className="alert alert-secondary py-2" role="status">
          Actions cannot change while the Ticket is {ticketStatus}. Reopen the Ticket first to record or change work.
        </p>
      )}
      {feedback && (
        <div className={`alert ${feedback.kind === "success" ? "alert-success" : "alert-danger"} py-2`} role={feedback.kind === "success" ? "status" : "alert"}>
          {feedback.message}
          {feedback.reload && <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={loadLatest}>Load Latest</button>}
        </div>
      )}
      {busy && <p className="small text-secondary" role="status">Saving Action…</p>}
      {renderForm()}
      {loadState === "loading" && <p role="status">Loading Actions Taken…</p>}
      {loadState === "error" && (
        <div className="alert alert-danger" role="alert">
          {loadError}
          <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => void loadPage(page)}>Try again</button>
        </div>
      )}
      {loadState === "success" && items.length === 0 && <p className="alert alert-info" role="status">No Actions have been recorded yet.</p>}
      {loadState === "success" && items.length > 0 && <ol className="list-group">{items.map(renderAction)}</ol>}
      {loadState === "success" && pagination && pagination.totalPages > 1 && (
        <nav className="d-flex flex-wrap align-items-center gap-2 mt-2" aria-label="Actions Taken pages">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => void loadPage(page - 1, "actions-taken-title")}>Previous</button>
          <span className="small">Page {page} of {pagination.totalPages} ({pagination.totalItems} Actions)</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= pagination.totalPages} onClick={() => void loadPage(page + 1, "actions-taken-title")}>Next</button>
        </nav>
      )}
    </section>
  );
}

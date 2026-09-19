import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  addPublicComment,
  ApiRequestError,
  getTicketComments,
  getTicketDetail,
  PublicComment,
  setProblemAppearsResolved,
} from "./api.js";
import type { TicketDetail as TicketDetailData, TicketPriority } from "./api.js";
import AttachmentSection from "./AttachmentSection.js";

type DetailState = "loading" | "success" | "error";
type CommentState = "loading" | "success" | "error";

export interface TicketDetailProps {
  ticketId: number;
  onBack: () => void;
}

function formatDateTime(value: string): string {
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

function commentAuthorLabel(comment: PublicComment): string {
  return `${comment.author.name} (${comment.author.email})`;
}

export default function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [commentState, setCommentState] = useState<CommentState>("loading");
  const [commentLoadError, setCommentLoadError] = useState("");
  const [commentFormError, setCommentFormError] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [commentSuccess, setCommentSuccess] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [resolutionError, setResolutionError] = useState("");
  const [resolutionSuccess, setResolutionSuccess] = useState("");
  const [savingResolution, setSavingResolution] = useState(false);
  const requestSequence = useRef(0);
  const commentRequestSequence = useRef(0);

  async function loadComments() {
    const sequence = ++commentRequestSequence.current;
    setCommentState("loading");
    setCommentLoadError("");

    try {
      const loadedComments = await getTicketComments(ticketId);
      if (sequence !== commentRequestSequence.current) return;
      setComments(loadedComments);
      setCommentState("success");
    } catch (error) {
      if (sequence !== commentRequestSequence.current) return;
      setCommentState("error");
      setCommentLoadError(error instanceof Error ? error.message : "Unable to load public comments.");
    }
  }

  async function loadDetail() {
    const sequence = ++requestSequence.current;
    setState("loading");
    setTicket(null);
    setErrorMessage("");
    setErrorStatus(null);
    setCommentSuccess("");
    setResolutionSuccess("");

    try {
      const loadedTicket = await getTicketDetail(ticketId);
      if (sequence !== requestSequence.current) return;
      setTicket(loadedTicket);
      setState("success");
      void loadComments();
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load Ticket Detail.");
      setErrorStatus(error instanceof ApiRequestError ? error.status : null);
    }
  }

  useEffect(() => {
    void loadDetail();

    return () => {
      requestSequence.current += 1;
      commentRequestSequence.current += 1;
    };
  }, [ticketId]);

  async function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (commentState !== "success") return;

    const content = commentContent.trim();
    if (!content) {
      setCommentFormError("Comment content is required.");
      return;
    }
    if (content.length > 4000) {
      setCommentFormError("Comment content must be 4000 characters or fewer.");
      return;
    }

    setSavingComment(true);
    setCommentFormError("");
    setCommentSuccess("");
    try {
      const addedComment = await addPublicComment(ticketId, content);
      setComments((current) => [...current, addedComment]);
      setCommentContent("");
      setCommentSuccess("Public comment added.");
    } catch (error) {
      setCommentFormError(error instanceof Error ? error.message : "Unable to add public comment.");
    } finally {
      setSavingComment(false);
    }
  }

  async function handleResolutionChange() {
    if (!ticket) return;

    const appearsResolved = !ticket.problemAppearsResolved;
    setSavingResolution(true);
    setResolutionError("");
    setResolutionSuccess("");
    try {
      const updated = await setProblemAppearsResolved(ticket.id, appearsResolved);
      setTicket((current) => current ? { ...current, ...updated } : current);
      setResolutionSuccess(
        appearsResolved
          ? "Problem marked as appearing resolved. Ticket status was not changed."
          : "Problem resolution indication cleared.",
      );
    } catch (error) {
      setResolutionError(error instanceof Error ? error.message : "Unable to update problem resolution.");
    } finally {
      setSavingResolution(false);
    }
  }

  const notFound = errorStatus === 404;
  const forbidden = errorStatus === 403;

  return (
    <section id="ticket-detail" className="card border-0 shadow-sm mb-4" aria-labelledby="ticket-detail-title">
      <div className="card-body">
        <button className="btn btn-outline-secondary mb-3" type="button" onClick={onBack}>
          Back to My Tickets
        </button>

        <h2 id="ticket-detail-title" className="h4 mb-3">Ticket Detail</h2>

        {state === "loading" && <p role="status">Loading Ticket Detail…</p>}

        {state === "error" && (
          <div className="alert alert-danger" role="alert">
            <p className="mb-2">Unable to load Ticket Detail.</p>
            <p className="small mb-3">
              {notFound
                ? "Ticket not found or you do not have access."
                : forbidden
                  ? "You do not have permission to view this Ticket."
                  : errorMessage}
            </p>
            <button className="btn btn-outline-danger" type="button" onClick={() => void loadDetail()}>
              Try again
            </button>
          </div>
        )}

        {state === "success" && ticket && (
          <>
            <section className="border rounded p-3 mb-4" aria-labelledby="ticket-information-title">
              <h3 id="ticket-information-title" className="h5 mb-3">Ticket Information</h3>
              <dl className="row mb-0">
                <dt className="col-sm-4">Ticket Number</dt>
                <dd className="col-sm-8">{ticket.ticketNumber}</dd>
                <dt className="col-sm-4">Ticket Date</dt>
                <dd className="col-sm-8">{formatDateTime(ticket.ticketDate)}</dd>
                <dt className="col-sm-4">Requester</dt>
                <dd className="col-sm-8">{ticket.requester.name} ({ticket.requester.email})</dd>
                <dt className="col-sm-4">Category</dt>
                <dd className="col-sm-8">{ticket.category.name}</dd>
                <dt className="col-sm-4">Related System</dt>
                <dd className="col-sm-8">{ticket.relatedSystem.name}</dd>
                <dt className="col-sm-4">Requested Priority</dt>
                <dd className="col-sm-8">
                  <span className={`badge ${priorityBadgeClass(ticket.requestedPriority)}`}>
                    {ticket.requestedPriority}
                  </span>
                </dd>
                <dt className="col-sm-4">Current Status</dt>
                <dd className="col-sm-8"><span className="badge text-bg-primary">{ticket.currentStatus}</span></dd>
                <dt className="col-sm-4">Summary</dt>
                <dd className="col-sm-8">{ticket.summary}</dd>
                <dt className="col-sm-4">Description</dt>
                <dd className="col-sm-8" style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</dd>
                <dt className="col-sm-4">Created</dt>
                <dd className="col-sm-8">{formatDateTime(ticket.createdAt)}</dd>
                <dt className="col-sm-4">Last Updated</dt>
                <dd className="col-sm-8">{formatDateTime(ticket.updatedAt)}</dd>
              </dl>
            </section>

            <section className="border rounded p-3 mb-4" aria-labelledby="problem-resolution-title">
              <h3 id="problem-resolution-title" className="h5 mb-2">Problem Appears Resolved</h3>
              <p className="small text-secondary">
                This is a requester indication only. It does not formally resolve or close the Ticket.
              </p>
              <p role="status" className="mb-3">
                {ticket.problemAppearsResolved
                  ? "You marked this problem as appearing resolved."
                  : "You have not marked this problem as resolved."}
              </p>
              <button
                className="btn btn-outline-success"
                type="button"
                onClick={() => void handleResolutionChange()}
                disabled={savingResolution}
              >
                {savingResolution
                  ? "Saving…"
                  : ticket.problemAppearsResolved
                    ? "Clear resolved indication"
                    : "Mark problem as resolved"}
              </button>
              {resolutionSuccess && <p className="text-success small mt-2 mb-0" role="status">{resolutionSuccess}</p>}
              {resolutionError && <p className="text-danger small mt-2 mb-0" role="alert">{resolutionError}</p>}
            </section>

            <section className="border rounded p-3 mb-4" aria-labelledby="public-comments-title">
              <h3 id="public-comments-title" className="h5 mb-2">Public Comments</h3>
              <p className="small text-secondary">Comments are visible to permitted users and are saved as plain text.</p>

              {commentState === "loading" && <p role="status">Loading Public Comments…</p>}
              {commentState === "error" && (
                <div className="alert alert-danger" role="alert">
                  <p className="mb-2">{commentLoadError}</p>
                  <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => void loadComments()}>
                    Try again
                  </button>
                </div>
              )}
              {commentState === "success" && comments.length === 0 && (
                <p className="alert alert-info" role="status">No public comments yet.</p>
              )}
              {comments.length > 0 && (
                <ol className="list-group list-group-numbered mb-3" aria-label="Public comment list">
                  {comments.map((comment) => (
                    <li key={comment.id} className="list-group-item">
                      <div className="d-flex flex-wrap justify-content-between gap-2">
                        <strong>{commentAuthorLabel(comment)}</strong>
                        <time className="small text-secondary" dateTime={comment.createdAt}>
                          {formatDateTime(comment.createdAt)}
                        </time>
                      </div>
                      <p className="mb-0 mt-2" style={{ whiteSpace: "pre-wrap" }}>{comment.content}</p>
                    </li>
                  ))}
                </ol>
              )}

              <form onSubmit={handleAddComment}>
                <label className="form-label fw-semibold" htmlFor={`public-comment-${ticket.id}`}>
                  Add Public Comment
                </label>
                <textarea
                  id={`public-comment-${ticket.id}`}
                  className={`form-control${commentFormError ? " is-invalid" : ""}`}
                  rows={4}
                  value={commentContent}
                  onChange={(event) => setCommentContent(event.target.value)}
                  maxLength={4000}
                  aria-invalid={Boolean(commentFormError)}
                  aria-describedby={`public-comment-help-${ticket.id}`}
                  disabled={commentState !== "success" || savingComment}
                />
                <div id={`public-comment-help-${ticket.id}`} className="form-text">
                  1–4000 characters. Markup is displayed as text.
                </div>
                {commentFormError && <div className="text-danger small mt-1" role="alert">{commentFormError}</div>}
                {commentSuccess && <div className="text-success small mt-1" role="status">{commentSuccess}</div>}
                <button
                  className="btn btn-success mt-2"
                  type="submit"
                  disabled={commentState !== "success" || savingComment}
                >
                  {savingComment ? "Saving…" : "Add Public Comment"}
                </button>
              </form>
            </section>

            <AttachmentSection
              ticketId={ticket.id}
              initialAttachments={ticket.attachments}
            />
          </>
        )}
      </div>
    </section>
  );
}

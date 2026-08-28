import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  Category,
  createTicket,
  CreateTicketInput,
  getCategories,
  getRelatedSystems,
  RelatedSystem,
  Requester,
  Ticket,
  TicketPriority,
} from "./api.js";

type FormValues = {
  categoryId: string;
  relatedSystemId: string;
  summary: string;
  description: string;
  requestedPriority: "" | TicketPriority;
};

type FormErrors = Partial<Record<keyof FormValues | "attachments", string>>;
type ReferenceState = "loading" | "ready" | "error";

const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const maxAttachmentCount = 5;
const maxAttachmentBytes = 5 * 1024 * 1024;
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const initialValues: FormValues = {
  categoryId: "",
  relatedSystemId: "",
  summary: "",
  description: "",
  requestedPriority: "",
};

function attachmentError(file: File): string | null {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!allowedMimeTypes.has(file.type) && !allowedExtensions.has(extension)) {
    return "Allowed attachment types: JPG, JPEG, PNG, WEBP, or PDF.";
  }

  if (file.size > maxAttachmentBytes) {
    return "Each attachment must be 5 MB or smaller.";
  }

  return null;
}

function validate(values: FormValues, attachments: File[]): FormErrors {
  const errors: FormErrors = {};

  if (!values.categoryId) errors.categoryId = "Category is required.";
  if (!values.relatedSystemId) errors.relatedSystemId = "Related System is required.";

  const summary = values.summary.trim();
  if (!summary) {
    errors.summary = "Summary is required.";
  } else if (summary.length < 5 || summary.length > 120) {
    errors.summary = "Summary must be between 5 and 120 characters.";
  }

  const description = values.description.trim();
  if (!description) {
    errors.description = "Description is required.";
  } else if (description.length < 10 || description.length > 4000) {
    errors.description = "Description must be between 10 and 4000 characters.";
  }

  if (!values.requestedPriority) {
    errors.requestedPriority = "Requested Priority is required.";
  }

  if (attachments.length > maxAttachmentCount) {
    errors.attachments = "You can attach up to 5 files.";
  }

  return errors;
}

export interface CreateTicketProps {
  requester: Requester;
}

export default function CreateTicket({ requester }: CreateTicketProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [referenceState, setReferenceState] = useState<ReferenceState>("loading");
  const [referenceError, setReferenceError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successTicket, setSuccessTicket] = useState<Ticket | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadReferences() {
    setReferenceState("loading");
    setReferenceError("");

    try {
      const [loadedCategories, loadedSystems] = await Promise.all([
        getCategories(),
        getRelatedSystems(),
      ]);
      setCategories(loadedCategories);
      setRelatedSystems(loadedSystems);
      setReferenceState("ready");
    } catch (error) {
      setReferenceState("error");
      setReferenceError(
        error instanceof Error ? error.message : "Unable to load ticket reference data.",
      );
    }
  }

  useEffect(() => {
    void loadReferences();
  }, []);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length > maxAttachmentCount) {
      setAttachments([]);
      setErrors((current) => ({ ...current, attachments: "You can attach up to 5 files." }));
      return;
    }

    const invalidFile = selected.map((file) => attachmentError(file)).find(Boolean);
    if (invalidFile) {
      setAttachments([]);
      setErrors((current) => ({ ...current, attachments: invalidFile }));
      return;
    }

    setAttachments(selected);
    setErrors((current) => ({ ...current, attachments: undefined }));
    setSubmitError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const validationErrors = validate(values, attachments);
    setErrors(validationErrors);
    setSubmitError("");
    setSuccessTicket(null);
    if (Object.keys(validationErrors).length > 0 || referenceState !== "ready") return;

    const input: CreateTicketInput = {
      categoryId: Number(values.categoryId),
      relatedSystemId: Number(values.relatedSystemId),
      summary: values.summary.trim(),
      description: values.description.trim(),
      requestedPriority: values.requestedPriority as TicketPriority,
    };

    setSubmitting(true);
    try {
      const ticket = await createTicket(requester.id, input);
      setSuccessTicket(ticket);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? `Unable to create ticket. ${error.message}`
          : "Unable to create ticket. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startAnotherTicket() {
    setValues(initialValues);
    setAttachments([]);
    setErrors({});
    setSubmitError("");
    setSuccessTicket(null);
  }

  const fieldError = (field: keyof FormValues | "attachments") =>
    errors[field] ? (
      <div id={`${field}-error`} className="text-danger small mt-1">
        {errors[field]}
      </div>
    ) : null;

  return (
    <section id="create-ticket" className="card border-0 shadow-sm mb-4" aria-labelledby="create-ticket-title">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
          <div>
            <h2 id="create-ticket-title" className="h4 mb-1">Create Ticket</h2>
            <p className="text-secondary mb-0">Describe the issue for the IT Service Desk.</p>
          </div>
          <span className="badge text-bg-light border">Requester context selected</span>
        </div>

        {referenceState === "loading" && (
          <p className="alert alert-info" role="status">Loading ticket reference data…</p>
        )}

        {referenceState === "error" && (
          <div className="alert alert-danger" role="alert">
            <p className="mb-2">Unable to load ticket reference data.</p>
            <p className="small mb-3">{referenceError}</p>
            <button className="btn btn-outline-danger" type="button" onClick={() => void loadReferences()}>
              Try again
            </button>
          </div>
        )}

        {submitError && <div className="alert alert-danger" role="alert">{submitError}</div>}

        {successTicket && (
          <div className="alert alert-success" role="status">
            <p className="fw-semibold mb-1">Ticket created successfully.</p>
            <p className="mb-2">Ticket Number: <strong>{successTicket.ticketNumber}</strong></p>
            <p className="mb-3">Status: {successTicket.currentStatus}</p>
            <button className="btn btn-outline-success" type="button" onClick={startAnotherTicket}>
              Create another ticket
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <fieldset disabled={referenceState !== "ready" || submitting}>
            <legend className="visually-hidden">Ticket details</legend>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="ticket-requester">Requester</label>
              <input
                id="ticket-requester"
                className="form-control bg-light"
                value={`${requester.name} (${requester.email})`}
                readOnly
                aria-describedby="ticket-requester-help"
              />
              <div id="ticket-requester-help" className="form-text">Selected Development Requester</div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="ticket-category">
                  Category <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <select
                  id="ticket-category"
                  className={`form-select${errors.categoryId ? " is-invalid" : ""}`}
                  value={values.categoryId}
                  onChange={(event) => updateValue("categoryId", event.target.value)}
                  aria-invalid={Boolean(errors.categoryId)}
                  aria-describedby={errors.categoryId ? "categoryId-error" : undefined}
                >
                  <option value="">Select a category…</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                {fieldError("categoryId")}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="ticket-related-system">
                  Related System <span className="text-danger" aria-hidden="true">*</span>
                </label>
                <select
                  id="ticket-related-system"
                  className={`form-select${errors.relatedSystemId ? " is-invalid" : ""}`}
                  value={values.relatedSystemId}
                  onChange={(event) => updateValue("relatedSystemId", event.target.value)}
                  aria-invalid={Boolean(errors.relatedSystemId)}
                  aria-describedby={errors.relatedSystemId ? "relatedSystemId-error" : undefined}
                >
                  <option value="">Select a related system…</option>
                  {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
                </select>
                {fieldError("relatedSystemId")}
              </div>
            </div>

            <div className="mb-3 mt-3">
              <label className="form-label fw-semibold" htmlFor="ticket-summary">
                Summary <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="ticket-summary"
                className={`form-control${errors.summary ? " is-invalid" : ""}`}
                value={values.summary}
                onChange={(event) => updateValue("summary", event.target.value)}
                aria-invalid={Boolean(errors.summary)}
                aria-describedby={errors.summary ? "summary-error" : undefined}
              />
              {fieldError("summary")}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="ticket-description">
                Description <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <textarea
                id="ticket-description"
                className={`form-control${errors.description ? " is-invalid" : ""}`}
                rows={5}
                value={values.description}
                onChange={(event) => updateValue("description", event.target.value)}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "description-error" : undefined}
              />
              {fieldError("description")}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="ticket-priority">
                Requested Priority <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <select
                id="ticket-priority"
                className={`form-select${errors.requestedPriority ? " is-invalid" : ""}`}
                value={values.requestedPriority}
                onChange={(event) => updateValue("requestedPriority", event.target.value)}
                aria-invalid={Boolean(errors.requestedPriority)}
                aria-describedby={errors.requestedPriority ? "requestedPriority-error" : undefined}
              >
                <option value="">Select requested priority…</option>
                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
              {fieldError("requestedPriority")}
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="ticket-attachments">Attachments</label>
              <input
                id="ticket-attachments"
                className={`form-control${errors.attachments ? " is-invalid" : ""}`}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFiles}
                aria-invalid={Boolean(errors.attachments)}
                aria-describedby={errors.attachments ? "attachments-error" : "attachments-help"}
              />
              <div id="attachments-help" className="form-text">JPG, JPEG, PNG, WEBP, or PDF; up to 5 MB each and 5 files.</div>
              {fieldError("attachments")}
              {attachments.length > 0 && (
                <ul className="small mt-2 mb-0" aria-label="Selected attachments">
                  {attachments.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} ({file.size} bytes)</li>)}
                </ul>
              )}
            </div>

            <button className="btn btn-success" type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Ticket"}
            </button>
          </fieldset>
        </form>
      </div>
    </section>
  );
}

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  AttachmentMetadata,
  downloadAttachment,
  removeAttachment,
  uploadAttachment,
} from "./api.js";

const maxAttachmentCount = 5;
const maxAttachmentBytes = 5 * 1024 * 1024;
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

type AttachmentSectionProps = {
  requesterId: number;
  ticketId: number;
  initialAttachments: AttachmentMetadata[];
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".0", "")} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".0", "")} MB`;
}

function validateFile(file: File): string | null {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!allowedMimeTypes.has(file.type) && !allowedExtensions.has(extension)) {
    return "Allowed attachment types: JPG, JPEG, PNG, WEBP, or PDF.";
  }
  if (file.size > maxAttachmentBytes) {
    return "Each attachment must be 5 MB or smaller.";
  }
  return null;
}

export default function AttachmentSection({
  requesterId,
  ticketId,
  initialAttachments,
}: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>(initialAttachments);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError(file ? validateFile(file) ?? "" : "");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError("");
    if (!selectedFile) {
      setUploadError("Choose a file to upload.");
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    const activeCount = attachments.filter(({ removedAt }) => !removedAt).length;
    if (activeCount >= maxAttachmentCount) {
      setUploadError("You can attach up to 5 active files.");
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadAttachment(requesterId, ticketId, selectedFile);
      setAttachments((current) => [...current, uploaded]);
      setSelectedFile(null);
      setInputKey((current) => current + 1);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to upload attachment.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attachment: AttachmentMetadata) {
    setActionError("");
    setDownloadingId(attachment.id);
    try {
      const blob = await downloadAttachment(requesterId, attachment.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.originalName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to download attachment.");
    } finally {
      setDownloadingId(null);
    }
  }

  function beginRemoval(attachmentId: number) {
    setActionError("");
    setRemovingId(attachmentId);
    setRemovalReason("");
  }

  function cancelRemoval() {
    setRemovingId(null);
    setRemovalReason("");
  }

  async function handleRemove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (removingId === null) return;

    const reason = removalReason.trim();
    if (reason.length < 5 || reason.length > 500) {
      setActionError("Removal reason must be between 5 and 500 characters.");
      return;
    }

    setActionError("");
    setRemoving(true);
    try {
      const removed = await removeAttachment(requesterId, removingId, reason);
      setAttachments((current) => current.map((attachment) => (
        attachment.id === removed.id ? removed : attachment
      )));
      cancelRemoval();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to remove attachment.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section aria-labelledby="ticket-attachments-title">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 id="ticket-attachments-title" className="h5 mb-0">Attachments</h3>
        <span className="small text-secondary">Active files: {attachments.filter(({ removedAt }) => !removedAt).length}/5</span>
      </div>

      <form className="border rounded p-3 mb-3 bg-light" onSubmit={handleUpload}>
        <label className="form-label fw-semibold" htmlFor={`attachment-upload-${ticketId}`}>
          Upload attachment
        </label>
        <div className="input-group">
          <input
            key={inputKey}
            id={`attachment-upload-${ticketId}`}
            className={`form-control${uploadError ? " is-invalid" : ""}`}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            aria-invalid={Boolean(uploadError)}
            aria-describedby={`attachment-upload-help-${ticketId}`}
          />
          <button className="btn btn-success" type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        <div id={`attachment-upload-help-${ticketId}`} className="form-text">
          JPG, JPEG, PNG, WEBP, or PDF; up to 5 MB each and 5 active files.
        </div>
        {uploadError && <div className="text-danger small mt-1" role="alert">{uploadError}</div>}
      </form>

      {actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}

      {attachments.length === 0 && (
        <p className="alert alert-info" role="status">No attachments for this ticket.</p>
      )}

      {attachments.length > 0 && (
        <ul className="list-group" aria-label="Ticket attachment metadata">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="list-group-item">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <strong className="text-break">{attachment.originalName}</strong>
                <span className={`badge ${attachment.removedAt ? "text-bg-secondary" : "text-bg-success"}`}>
                  {attachment.removedAt ? "Removed" : "Active"}
                </span>
              </div>
              <p className="small text-secondary mb-2">
                {attachment.mimeType} · {formatBytes(attachment.sizeBytes)} · Added {formatDateTime(attachment.createdAt)}
              </p>

              {!attachment.removedAt && (
                <div className="d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-outline-success btn-sm"
                    type="button"
                    onClick={() => void handleDownload(attachment)}
                    disabled={downloadingId !== null || removing}
                    aria-label={`Download ${attachment.originalName}`}
                  >
                    {downloadingId === attachment.id ? "Downloading…" : "Download"}
                  </button>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    type="button"
                    onClick={() => beginRemoval(attachment.id)}
                    disabled={downloadingId !== null || removing}
                  >
                    Remove
                  </button>
                </div>
              )}

              {attachment.removedAt && (
                <p className="small mb-0" role="status">
                  Unavailable for download. Removed {formatDateTime(attachment.removedAt)}
                  {attachment.removalReason ? `: ${attachment.removalReason}` : ""}
                </p>
              )}

              {removingId === attachment.id && (
                <form className="border rounded p-3 mt-3" onSubmit={handleRemove}>
                  <p className="small mb-2">Confirm removal of <strong>{attachment.originalName}</strong>.</p>
                  <label className="form-label fw-semibold" htmlFor={`removal-reason-${attachment.id}`}>
                    Removal reason
                  </label>
                  <textarea
                    id={`removal-reason-${attachment.id}`}
                    className="form-control mb-2"
                    rows={2}
                    value={removalReason}
                    onChange={(event) => setRemovalReason(event.target.value)}
                    maxLength={500}
                  />
                  <div className="d-flex flex-wrap gap-2">
                    <button className="btn btn-danger btn-sm" type="submit" disabled={removing}>
                      {removing ? "Removing…" : "Confirm removal"}
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={cancelRemoval} disabled={removing}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

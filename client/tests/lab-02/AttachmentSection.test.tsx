import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttachmentSection from "../../src/AttachmentSection.js";
import * as api from "../../src/api.js";

const activeAttachment: api.AttachmentMetadata = {
  id: 10,
  originalName: "network-log.png",
  mimeType: "image/png",
  sizeBytes: 2048,
  createdAt: "2026-08-31T02:30:00.000Z",
  removedAt: null,
  removalReason: null,
};

const removedAttachment: api.AttachmentMetadata = {
  id: 11,
  originalName: "old-log.pdf",
  mimeType: "application/pdf",
  sizeBytes: 4096,
  createdAt: "2026-08-31T02:31:00.000Z",
  removedAt: "2026-08-31T03:00:00.000Z",
  removalReason: "No longer needed",
};

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  if ("createObjectURL" in window.URL) delete (window.URL as { createObjectURL?: unknown }).createObjectURL;
  if ("revokeObjectURL" in window.URL) delete (window.URL as { revokeObjectURL?: unknown }).revokeObjectURL;
});

function renderAttachments(initialAttachments = [activeAttachment, removedAttachment]) {
  return render(
    <AttachmentSection requesterId={1} ticketId={101} initialAttachments={initialAttachments} />,
  );
}

describe("Attachment Section UI", () => {
  it("shows metadata, downloads active files, and hides download for removed files", async () => {
    const download = vi.spyOn(api, "downloadAttachment").mockResolvedValue(
      new Blob(["file contents"], { type: "image/png" }),
    );
    const createObjectUrl = vi.fn(() => "blob:test");
    const revokeObjectUrl = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(window.URL, "createObjectURL", { value: createObjectUrl, configurable: true });
    Object.defineProperty(window.URL, "revokeObjectURL", { value: revokeObjectUrl, configurable: true });
    const user = userEvent.setup();

    renderAttachments();

    expect(screen.getByText("network-log.png")).toBeInTheDocument();
    expect(screen.getByText("old-log.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download network-log.png" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download old-log.pdf" })).not.toBeInTheDocument();
    expect(screen.getByText(/Unavailable for download/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Download network-log.png" }));
    expect(download).toHaveBeenCalledWith(1, activeAttachment.id);
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test");
  });

  it("uploads a valid file and reports an upload failure", async () => {
    const upload = vi.spyOn(api, "uploadAttachment").mockResolvedValue({
      ...activeAttachment,
      id: 12,
      originalName: "new-evidence.pdf",
      mimeType: "application/pdf",
    });
    const user = userEvent.setup();
    renderAttachments([]);

    const file = new File(["evidence"], "new-evidence.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Upload attachment"), { target: { files: [file] } });
    await user.click(screen.getByRole("button", { name: "Upload" }));

    expect(upload).toHaveBeenCalledWith(1, 101, file);
    expect(await screen.findByText("new-evidence.pdf")).toBeInTheDocument();

    upload.mockRejectedValueOnce(new Error("Attachment upload failed (500)"));
    fireEvent.change(screen.getByLabelText("Upload attachment"), {
      target: { files: [new File(["retry"], "retry.pdf", { type: "application/pdf" })] },
    });
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Attachment upload failed (500)");
  });

  it("requires a reason before confirming soft removal", async () => {
    const remove = vi.spyOn(api, "removeAttachment").mockResolvedValue({
      ...activeAttachment,
      removedAt: "2026-08-31T04:00:00.000Z",
      removalReason: "No longer needed",
    });
    const user = userEvent.setup();
    renderAttachments([activeAttachment]);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Confirm removal" }));
    expect(remove).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Removal reason must be between 5 and 500 characters.");

    await user.type(screen.getByLabelText("Removal reason"), "No longer needed");
    await user.click(screen.getByRole("button", { name: "Confirm removal" }));
    expect(remove).toHaveBeenCalledWith(1, activeAttachment.id, "No longer needed");
    expect(await screen.findByText(/Unavailable for download/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download network-log.png" })).not.toBeInTheDocument();
  });
});

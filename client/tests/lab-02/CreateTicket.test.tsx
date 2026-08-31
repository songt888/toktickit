import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { id: 7, name: "Ari Suksan", email: "ari.suksan@example.com" };
const categories = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
];
const relatedSystems = [
  { id: 1, name: "Campus Wi-Fi" },
  { id: 2, name: "Student Portal" },
];
const createdTicket: api.Ticket = {
  id: 101,
  ticketNumber: "TKT-20260829-000101",
  ticketDate: "2026-08-29T00:00:00.000Z",
  requesterId: requester.id,
  categoryId: 1,
  relatedSystemId: 2,
  summary: "Laptop battery drains quickly",
  description: "The battery falls below 20 percent after a short session.",
  requestedPriority: "MEDIUM",
  currentStatus: "NEW",
};

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

async function openCreateTicket() {
  const user = userEvent.setup();
  vi.spyOn(api, "getRequesters").mockResolvedValue([requester]);
  vi.spyOn(api, "getCategories").mockResolvedValue(categories);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue(relatedSystems);

  render(<App />);
  const requesterSelect = await screen.findByLabelText(/Choose a Development Requester/);
  await user.selectOptions(requesterSelect, String(requester.id));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("link", { name: "Create Ticket" }));
  await screen.findByRole("heading", { name: "Create Ticket" });
  await screen.findByLabelText(/Category/);

  return user;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/Category/), "1");
  await user.selectOptions(screen.getByLabelText(/Related System/), "2");
  await user.type(screen.getByLabelText(/Summary/), "Laptop battery drains quickly");
  await user.type(
    screen.getByLabelText(/Description/),
    "The battery falls below 20 percent after a short session.",
  );
  await user.selectOptions(screen.getByLabelText(/Requested Priority/), "MEDIUM");
}

describe("Create Ticket UI", () => {
  it("shows the selected requester and reference data from the APIs", async () => {
    await openCreateTicket();

    expect(screen.getByDisplayValue("Ari Suksan (ari.suksan@example.com)")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Account and Access" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Student Portal" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Attachments/)).toBeInTheDocument();
  });

  it("shows field-level validation and does not call the create API for invalid input", async () => {
    const user = await openCreateTicket();
    const createSpy = vi.spyOn(api, "createTicket");

    await user.click(screen.getByRole("button", { name: "Create Ticket" }));

    expect(screen.getByText("Category is required.")).toBeInTheDocument();
    expect(screen.getByText("Related System is required.")).toBeInTheDocument();
    expect(screen.getByText("Summary is required.")).toBeInTheDocument();
    expect(screen.getByText("Description is required.")).toBeInTheDocument();
    expect(screen.getByText("Requested Priority is required.")).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("submits once, shows a busy state, and displays the generated ticket number", async () => {
    const user = await openCreateTicket();
    let resolveTicket: (ticket: api.Ticket) => void = () => undefined;
    const pendingTicket = new Promise<api.Ticket>((resolve) => {
      resolveTicket = resolve;
    });
    const createSpy = vi.spyOn(api, "createTicket").mockReturnValue(pendingTicket);

    await fillValidForm(user);
    const submit = screen.getByRole("button", { name: "Create Ticket" });
    await user.click(submit);

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Creating…" }));
    expect(createSpy).toHaveBeenCalledTimes(1);

    resolveTicket(createdTicket);
    expect(await screen.findByText("TKT-20260829-000101")).toBeInTheDocument();
    expect(screen.getByText("Status: NEW")).toBeInTheDocument();
    expect(createSpy).toHaveBeenCalledWith(requester.id, {
      categoryId: 1,
      relatedSystemId: 2,
      summary: "Laptop battery drains quickly",
      description: "The battery falls below 20 percent after a short session.",
      requestedPriority: "MEDIUM",
    });
  });

  it("uploads selected attachments after the ticket is created", async () => {
    const user = await openCreateTicket();
    vi.spyOn(api, "createTicket").mockResolvedValue(createdTicket);
    const upload = vi.spyOn(api, "uploadAttachment").mockResolvedValue({
      id: 501,
      originalName: "evidence.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8,
      createdAt: "2026-08-31T04:00:00.000Z",
      removedAt: null,
      removalReason: null,
    });

    await fillValidForm(user);
    const file = new File(["evidence"], "evidence.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/Attachments/), { target: { files: [file] } });
    await user.click(screen.getByRole("button", { name: "Create Ticket" }));

    expect(upload).toHaveBeenCalledWith(createdTicket.requesterId, createdTicket.id, file);
    expect(await screen.findByText("Attachments uploaded: 1/1.")).toBeInTheDocument();
  });

  it("preserves entered values and shows a safe error when creation fails", async () => {
    const user = await openCreateTicket();
    vi.spyOn(api, "createTicket").mockRejectedValue(new Error("Ticket request failed (500)"));

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create Ticket" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create ticket");
    expect(screen.getByDisplayValue("Laptop battery drains quickly")).toBeInTheDocument();
    expect(screen.getByDisplayValue("The battery falls below 20 percent after a short session.")).toBeInTheDocument();
  });

  it("reports unsupported, oversized, and excessive attachments clearly", async () => {
    const user = await openCreateTicket();
    const input = screen.getByLabelText(/Attachments/);

    fireEvent.change(input, {
      target: { files: [new File(["virus"], "virus.exe", { type: "application/octet-stream" })] },
    });
    expect(screen.getByText("Allowed attachment types: JPG, JPEG, PNG, WEBP, or PDF.")).toBeInTheDocument();

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(screen.getByText("Each attachment must be 5 MB or smaller.")).toBeInTheDocument();

    const sixFiles = Array.from(
      { length: 6 },
      (_, index) => new File(["file"], `file-${index}.pdf`, { type: "application/pdf" }),
    );
    fireEvent.change(input, { target: { files: sixFiles } });
    expect(screen.getByText("You can attach up to 5 files.")).toBeInTheDocument();
  });
});

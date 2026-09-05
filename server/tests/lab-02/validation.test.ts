import { describe, expect, it } from "vitest";
import { validateAttachment, validateCreateTicketInput } from "../../src/ticketValidation.js";

describe("Create Ticket validation", () => {
  it("trims and accepts a valid ticket payload", () => {
    const result = validateCreateTicketInput({
      categoryId: 1,
      relatedSystemId: 2,
      summary: "  Laptop battery issue  ",
      description: "  The battery drains during a short session.  ",
      requestedPriority: "MEDIUM",
    });

    expect(result.errors).toEqual({});
    expect(result.value).toEqual({
      categoryId: 1,
      relatedSystemId: 2,
      summary: "Laptop battery issue",
      description: "The battery drains during a short session.",
      requestedPriority: "MEDIUM",
    });
  });

  it("rejects missing, short, and unsupported values", () => {
    const result = validateCreateTicketInput({
      categoryId: 0,
      relatedSystemId: "2",
      summary: "bad",
      description: "too short",
      requestedPriority: "NORMAL",
    });

    expect(result.value).toBeUndefined();
    expect(result.errors).toEqual({
      categoryId: "Category is required.",
      relatedSystemId: "Related System is required.",
      summary: "Summary must be between 5 and 120 characters.",
      description: "Description must be between 10 and 4000 characters.",
      requestedPriority: "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.",
    });
  });

  it("enforces the permitted attachment type and size boundaries", () => {
    expect(validateAttachment({ mimetype: "application/pdf", size: 5 * 1024 * 1024 })).toBeNull();
    expect(validateAttachment({ mimetype: "application/octet-stream", size: 10 })).toBe(
      "Allowed attachment types: JPG, JPEG, PNG, WEBP, or PDF.",
    );
    expect(validateAttachment({ mimetype: "image/png", size: 5 * 1024 * 1024 + 1 })).toBe(
      "Each attachment must be 5 MB or smaller.",
    );
  });
});

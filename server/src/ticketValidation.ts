export const ticketPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TicketPriorityValue = (typeof ticketPriorities)[number];

export const attachmentLimits = {
  maxFiles: 5,
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const,
} as const;

export type CreateTicketInput = {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: TicketPriorityValue;
};

export type TicketValidationErrors = Partial<Record<keyof CreateTicketInput, string>>;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function validateCreateTicketInput(body: unknown): {
  value?: CreateTicketInput;
  errors: TicketValidationErrors;
} {
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const errors: TicketValidationErrors = {};

  if (!isPositiveInteger(input.categoryId)) {
    errors.categoryId = "Category is required.";
  }

  if (!isPositiveInteger(input.relatedSystemId)) {
    errors.relatedSystemId = "Related System is required.";
  }

  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  if (!summary) {
    errors.summary = "Summary is required.";
  } else if (summary.length < 5 || summary.length > 120) {
    errors.summary = "Summary must be between 5 and 120 characters.";
  }

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!description) {
    errors.description = "Description is required.";
  } else if (description.length < 10 || description.length > 4000) {
    errors.description = "Description must be between 10 and 4000 characters.";
  }

  if (!ticketPriorities.includes(input.requestedPriority as TicketPriorityValue)) {
    errors.requestedPriority = "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.";
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    value: {
      categoryId: input.categoryId as number,
      relatedSystemId: input.relatedSystemId as number,
      summary,
      description,
      requestedPriority: input.requestedPriority as TicketPriorityValue,
    },
    errors,
  };
}

export function validateAttachment(file: {
  mimetype: string;
  size: number;
}): string | null {
  if (!attachmentLimits.allowedMimeTypes.includes(file.mimetype as (typeof attachmentLimits.allowedMimeTypes)[number])) {
    return "Allowed attachment types: JPG, JPEG, PNG, WEBP, or PDF.";
  }

  if (file.size > attachmentLimits.maxBytes) {
    return "Each attachment must be 5 MB or smaller.";
  }

  return null;
}

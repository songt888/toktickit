import { createHash } from "node:crypto";
import type { ActionStatus } from "@prisma/client";

export type FieldErrors = Record<string, string>;

// Current editable values of an Action, after trimming (BR-04 to BR-06).
export type ActionFields = {
  actionAt: Date;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

export const actionStatuses = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

const permittedActionMoves: Record<ActionStatus, ActionStatus[]> = {
  PLANNED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// BR-07: exact lifecycle pairs; same-status requests are not moves.
export function isPermittedActionMove(from: ActionStatus, to: ActionStatus): boolean {
  return permittedActionMoves[from].includes(to);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const offsetIsoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

// Offset-qualified ISO timestamp, normalized to UTC; anything else is null.
export function parseOffsetDate(value: unknown): Date | null {
  if (typeof value !== "string" || !offsetIsoPattern.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isPositiveInt32(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;
}

// Unknown or write-protected fields are rejected, never ignored (BR-04).
export function unexpectedFields(body: Record<string, unknown>, allowed: readonly string[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) errors[key] = "This field cannot be set here.";
  }
  return errors;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

// Reads the editable fields present in a body into trimmed values; type errors go to `errors`.
export function readEditableFields(body: Record<string, unknown>, errors: FieldErrors): Partial<ActionFields> {
  const out: Partial<ActionFields> = {};
  if ("actionAt" in body) {
    const date = parseOffsetDate(body.actionAt);
    if (date) out.actionAt = date;
    else errors.actionAt = "Enter a valid date and time with a time zone.";
  }
  for (const key of ["description", "result"] as const) {
    if (key in body) {
      const value = text(body[key]);
      if (value === undefined) errors[key] = "Enter text.";
      else out[key] = value;
    }
  }
  for (const key of ["followUpNote", "attachmentNotes"] as const) {
    if (key in body) {
      if (body[key] === null) out[key] = null;
      else {
        const value = text(body[key]);
        if (value === undefined) errors[key] = "Enter text.";
        else out[key] = value || null;
      }
    }
  }
  if ("followUpRequired" in body) {
    if (typeof body.followUpRequired === "boolean") out.followUpRequired = body.followUpRequired;
    else errors.followUpRequired = "Choose whether follow-up is required.";
  }
  return out;
}

// Validates the resulting Action (not only the patch) against BR-04 to BR-06.
export function validateActionFields(
  fields: ActionFields,
  status: ActionStatus,
  ticketDate: Date,
  now: Date,
  errors: FieldErrors = {},
): FieldErrors {
  if (fields.description.length < 1) errors.description = "Describe the action.";
  else if (fields.description.length > 4000) errors.description = "Use 4000 characters or fewer.";
  if (fields.result.length > 4000) errors.result = "Use 4000 characters or fewer.";
  else if (status === "COMPLETED" && fields.result.length < 1) errors.result = "Record the result before completing.";
  if (fields.followUpNote && fields.followUpNote.length > 2000) errors.followUpNote = "Use 2000 characters or fewer.";
  else if (fields.followUpRequired && !fields.followUpNote) errors.followUpNote = "Describe the required follow-up.";
  else if (!fields.followUpRequired && fields.followUpNote) errors.followUpNote = "Remove the note or mark follow-up as required.";
  if (fields.attachmentNotes && fields.attachmentNotes.length > 2000) errors.attachmentNotes = "Use 2000 characters or fewer.";
  if (fields.actionAt.getTime() < ticketDate.getTime()) errors.actionAt = "The action cannot be before the Ticket date.";
  else if (fields.actionAt.getTime() > now.getTime()) errors.actionAt = "The action cannot be in the future.";
  return errors;
}

export function validateCancellationReason(value: unknown): string | null {
  const reason = text(value);
  return reason !== undefined && reason.length >= 5 && reason.length <= 500 ? reason : null;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return typeof value === "string" ? value.trim() : value;
}

// SHA-256 of the normalized command, including last-seen values; mutationId is the key, not the payload.
export function commandHash(method: string, route: string, body: Record<string, unknown>): string {
  const { mutationId: _key, ...payload } = body;
  return createHash("sha256").update(JSON.stringify(canonical({ method, route, payload }))).digest("hex");
}

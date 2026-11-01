import { describe, expect, it } from "vitest";
import {
  type ActionFields,
  commandHash,
  isUuid,
  parseOffsetDate,
  readEditableFields,
  unexpectedFields,
  validateActionFields,
  validateCancellationReason,
} from "../../src/actionValidation.js";

const ticketDate = new Date("2026-10-01T00:00:00Z");
const now = new Date("2026-10-05T00:00:00Z");
const base: ActionFields = {
  actionAt: new Date("2026-10-02T00:00:00Z"),
  description: "Check the adapter",
  result: "",
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
};
const check = (patch: Partial<ActionFields>, status: "PLANNED" | "COMPLETED" = "PLANNED") =>
  validateActionFields({ ...base, ...patch }, status, ticketDate, now);

describe("Action field validation (UNIT-01)", () => {
  it("accepts text at the length limits and rejects one character over", () => {
    expect(check({ description: "x".repeat(4000), result: "y".repeat(4000), attachmentNotes: "z".repeat(2000) })).toEqual({});
    expect(Object.keys(check({ description: "x".repeat(4001), result: "y".repeat(4001), attachmentNotes: "z".repeat(2001) }))).toEqual(
      ["description", "result", "attachmentNotes"],
    );
    expect(check({ followUpRequired: true, followUpNote: "n".repeat(2000) })).toEqual({});
    expect(check({ followUpRequired: true, followUpNote: "n".repeat(2001) })).toHaveProperty("followUpNote");
  });

  it("trims text, keeps literal markup, and treats blank optional notes as none", () => {
    const errors = {};
    const fields = readEditableFields({ description: "  <b>literal</b>  ", attachmentNotes: "   ", followUpNote: null }, errors);
    expect(errors).toEqual({});
    expect(fields).toEqual({ description: "<b>literal</b>", attachmentNotes: null, followUpNote: null });
    expect(check({ description: "   ".trim() })).toHaveProperty("description");
  });

  it("requires a result only when completed", () => {
    expect(check({ result: "" }, "PLANNED")).toEqual({});
    expect(check({ result: "" }, "COMPLETED")).toHaveProperty("result");
    expect(check({ result: "Fixed" }, "COMPLETED")).toEqual({});
  });

  it("ties the follow-up note to follow-up required", () => {
    expect(check({ followUpRequired: true, followUpNote: null })).toHaveProperty("followUpNote");
    expect(check({ followUpRequired: false, followUpNote: "Call back" })).toHaveProperty("followUpNote");
    expect(check({ followUpRequired: true, followUpNote: "Call back" })).toEqual({});
  });

  it("keeps actionAt between the Ticket date and now, inclusive", () => {
    expect(check({ actionAt: ticketDate })).toEqual({});
    expect(check({ actionAt: now })).toEqual({});
    expect(check({ actionAt: new Date(ticketDate.getTime() - 1) })).toHaveProperty("actionAt");
    expect(check({ actionAt: new Date(now.getTime() + 1) })).toHaveProperty("actionAt");
  });

  it("parses only offset-qualified ISO timestamps and normalizes them to UTC", () => {
    expect(parseOffsetDate("2026-10-05T08:00:00+07:00")?.toISOString()).toBe("2026-10-05T01:00:00.000Z");
    expect(parseOffsetDate("2026-10-05T01:00:00.123Z")?.toISOString()).toBe("2026-10-05T01:00:00.123Z");
    for (const bad of ["2026-10-05T01:00:00", "2026-10-05", "2026-13-40T01:00:00Z", 1_700_000_000_000, null]) {
      expect(parseOffsetDate(bad)).toBeNull();
    }
    const errors: Record<string, string> = {};
    readEditableFields({ actionAt: "yesterday", description: 5, followUpRequired: "yes" }, errors);
    expect(Object.keys(errors).sort()).toEqual(["actionAt", "description", "followUpRequired"]);
  });

  it("rejects unknown and protected fields instead of ignoring them", () => {
    expect(unexpectedFields({ description: "x", performedById: 1, status: "COMPLETED" }, ["description"])).toEqual({
      performedById: expect.any(String),
      status: expect.any(String),
    });
  });

  it("checks cancellation reasons, request ids, and command hashes", () => {
    expect(validateCancellationReason("abcd")).toBeNull();
    expect(validateCancellationReason("  abcde  ")).toBe("abcde");
    expect(validateCancellationReason("r".repeat(500))).toHaveLength(500);
    expect(validateCancellationReason("r".repeat(501))).toBeNull();
    expect(isUuid("872894a2-a557-4e1d-93f3-015a25746d37")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);

    const a = commandHash("PATCH", "/api/tickets/1/actions-taken/2", { mutationId: "x", version: 1, description: " Fix " });
    expect(commandHash("PATCH", "/api/tickets/1/actions-taken/2", { description: "Fix", version: 1, mutationId: "y" })).toBe(a);
    expect(commandHash("PATCH", "/api/tickets/9/actions-taken/2", { mutationId: "x", version: 1, description: "Fix" })).not.toBe(a);
    expect(commandHash("PATCH", "/api/tickets/1/actions-taken/2", { mutationId: "x", version: 2, description: "Fix" })).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

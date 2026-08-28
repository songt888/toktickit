import { describe, expect, it } from "vitest";
import { formatTicketNumber } from "../../src/ticketNumber.js";

describe("Ticket Number generation", () => {
  it("formats the database sequence value with the UTC ticket date", () => {
    expect(formatTicketNumber(42, new Date("2026-08-29T00:00:00.000Z"))).toBe(
      "TKT-20260829-000042",
    );
  });

  it("keeps different sequence values unique", () => {
    const date = new Date("2026-08-29T00:00:00.000Z");
    expect(formatTicketNumber(1, date)).not.toBe(formatTicketNumber(2, date));
  });
});

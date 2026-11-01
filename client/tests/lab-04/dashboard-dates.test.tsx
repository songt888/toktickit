import { describe, expect, it } from "vitest";
import { formatBangkok } from "../../src/ActionsTaken.js";

describe("Bangkok display of Dashboard times (UNIT-05 display part)", () => {
  it("shows UTC instants in Bangkok time, crossing the date line where needed", () => {
    expect(formatBangkok("2026-10-30T17:30:00.000Z")).toBe("31 Oct 2026, 00:30 (Bangkok)");
    expect(formatBangkok("2026-10-23T05:00:00.000Z")).toBe("23 Oct 2026, 12:00 (Bangkok)");
  });
});

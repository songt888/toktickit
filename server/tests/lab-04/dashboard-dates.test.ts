import { describe, expect, it } from "vitest";
import { dashboardWindow } from "../../src/dashboard.js";
import { drillDownWhere, parseDrillDown } from "../../src/ticketQuery.js";

describe("Dashboard date rules (UNIT-05)", () => {
  it("uses a rolling 7 x 24 h UTC window ending at the captured asOf, not Bangkok midnight", () => {
    // 00:30 on 31 Oct in Bangkok, still 30 Oct in UTC.
    const now = new Date("2026-10-30T17:30:00.000Z");
    const { asOf, recentFrom } = dashboardWindow(now);
    expect(asOf).toEqual(now);
    expect(recentFrom.toISOString()).toBe("2026-10-23T17:30:00.000Z");
    expect(asOf.getTime() - recentFrom.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("turns returned bounds into inclusive filters, so a null legacy resolution time never matches", () => {
    const from = "2026-10-23T17:30:00.000Z";
    const to = "2026-10-30T17:30:00.000Z";
    const parsed = parseDrillDown({ statusGroup: "resolved", resolvedFrom: from, resolvedTo: to, updatedFrom: from })!;
    const where = drillDownWhere(parsed);
    // gte/lte are inclusive; a range condition on lastResolvedAt is never true for NULL in SQL.
    expect(where.lastResolvedAt).toEqual({ gte: new Date(from), lte: new Date(to) });
    expect(where.updatedAt).toEqual({ gte: new Date(from) });
    expect(where.currentStatus).toEqual({ in: ["RESOLVED", "CLOSED"] });
  });

  it("accepts only ISO times with an explicit offset and rejects reversed bounds", () => {
    expect(parseDrillDown({ updatedFrom: "2026-10-30T07:30:00+07:00" })).toEqual({ updatedFrom: new Date("2026-10-30T00:30:00.000Z") });
    for (const value of ["2026-10-30", "2026-10-30T07:30:00", "yesterday"]) expect(parseDrillDown({ updatedFrom: value }), value).toBeNull();
    expect(parseDrillDown({ resolvedFrom: "2026-10-30T00:00:00Z", resolvedTo: "2026-10-29T00:00:00Z" })).toBeNull();
  });
});

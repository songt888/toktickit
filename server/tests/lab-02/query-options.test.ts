import { describe, expect, it } from "vitest";
import {
  buildTicketOrderBy,
  buildTicketWhere,
  parseTicketListQuery,
} from "../../src/ticketQuery.js";

describe("My Tickets query options", () => {
  it("provides the documented defaults", () => {
    const result = parseTicketListQuery({});

    expect(result).toEqual({
      value: {
        sort: "updatedAt",
        order: "desc",
        page: 1,
        pageSize: 10,
      },
    });
  });

  it("parses search, filters, sorting, and pagination", () => {
    const result = parseTicketListQuery({
      search: "  battery  ",
      categoryId: "2",
      relatedSystemId: "3",
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      sort: "ticketNumber",
      order: "asc",
      page: "2",
      pageSize: "25",
    });

    expect(result).toEqual({
      value: {
        search: "battery",
        categoryId: 2,
        relatedSystemId: 3,
        requestedPriority: "HIGH",
        currentStatus: "NEW",
        sort: "ticketNumber",
        order: "asc",
        page: 2,
        pageSize: 25,
      },
    });
  });

  it("rejects unsupported query values", () => {
    expect(parseTicketListQuery({ pageSize: "5" })).toEqual({
      error: "Invalid query parameters",
    });
    expect(parseTicketListQuery({ sort: "id" })).toEqual({
      error: "Invalid query parameters",
    });
    expect(parseTicketListQuery({ requestedPriority: "NORMAL" })).toEqual({
      error: "Invalid query parameters",
    });
  });

  it("always scopes the database filter to the selected requester", () => {
    const parsed = parseTicketListQuery({ search: "WiFi" });
    if (!parsed.value) throw new Error("Query should be valid");

    expect(buildTicketWhere(7, parsed.value)).toEqual({
      requesterId: 7,
      OR: [
        { ticketNumber: { contains: "WiFi", mode: "insensitive" } },
        { summary: { contains: "WiFi", mode: "insensitive" } },
        { description: { contains: "WiFi", mode: "insensitive" } },
      ],
    });
    expect(buildTicketOrderBy(parsed.value)).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
  });
});

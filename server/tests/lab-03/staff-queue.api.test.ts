import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "./testSession.js";

const prisma = getPrisma();
const createdTicketIds: number[] = [];

describe("GET /api/staff/tickets", () => {
  let staffId: number;
  let administratorId: number;
  let requesterId: number;
  let staffCookie: string;
  let administratorCookie: string;
  let requesterCookie: string;
  let categoryId: number;
  let relatedSystemId: number;
  let runToken: string;
  let firstTicketId = 0;

  beforeAll(async () => {
    await seedLab2Data(prisma);
    const [staff, administrator, requester, category, relatedSystem] = await Promise.all([
      createTestUser("lab3-issue6-queue-staff@example.test", "IT_STAFF"),
      createTestUser("lab3-issue6-queue-admin@example.test", "ADMINISTRATOR"),
      createTestUser("lab3-issue6-queue-requester@example.test", "REQUESTER"),
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!category || !relatedSystem) throw new Error("Seed data is missing");

    staffId = staff.id;
    administratorId = administrator.id;
    requesterId = requester.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    [staffCookie, administratorCookie, requesterCookie] = await Promise.all([
      sessionCookieFor(staffId),
      sessionCookieFor(administratorId),
      sessionCookieFor(requesterId),
    ]);

    runToken = `issue6-queue-${Date.now()}`;
    const ticketRunId = Date.now();
    const fixtures = Array.from({ length: 11 }, (_, index) => ({
      ticketNumber: `TKT-ISSUE6-${ticketRunId}-${String(index).padStart(2, "0")}`,
      requesterId,
      ownerId: index === 1 ? null : index === 2 ? administratorId : staffId,
      categoryId,
      relatedSystemId,
      summary: `${runToken} ticket ${String(index).padStart(2, "0")}`,
      description: `${runToken} description ${index}`,
      requestedPriority: (["HIGH", "LOW", "MEDIUM", "URGENT"] as const)[index % 4],
      itPriority: (["URGENT", "LOW", "HIGH", "MEDIUM"] as const)[index % 4],
      currentStatus: (["NEW", "OPEN", "IN_PROGRESS", "RESOLVED"] as const)[index % 4],
    }));

    for (const fixture of fixtures) {
      const created = await prisma.ticket.create({ data: fixture });
      createdTicketIds.push(created.id);
      if (firstTicketId === 0) firstTicketId = created.id;
    }

    // Keep the fixture timestamps identical so the API's id tiebreaker is observable.
    await prisma.ticket.updateMany({
      where: { id: { in: createdTicketIds } },
      data: { updatedAt: new Date("2026-09-19T00:00:00.000Z") },
    });
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await removeTestUsers([staffId, administratorId, requesterId]);
    await prisma.$disconnect();
  });

  it("allows Staff and Administrators while rejecting other roles", async () => {
    const [staffResponse, administratorResponse, requesterResponse, missingSession] = await Promise.all([
      request(app).get(`/api/staff/tickets?search=${encodeURIComponent(runToken)}`).set("Cookie", staffCookie),
      request(app).get(`/api/staff/tickets?search=${encodeURIComponent(runToken)}`).set("Cookie", administratorCookie),
      request(app).get("/api/staff/tickets").set("Cookie", requesterCookie),
      request(app).get("/api/staff/tickets"),
    ]);

    expect(staffResponse.status).toBe(200);
    expect(administratorResponse.status).toBe(200);
    expect(requesterResponse.status).toBe(403);
    expect(requesterResponse.body).toEqual({ error: "Forbidden" });
    expect(missingSession.status).toBe(401);
  });

  it("supports search, filters, stable sorting, owner display, and pagination metadata", async () => {
    const filtered = await request(app)
      .get(`/api/staff/tickets?search=${encodeURIComponent(runToken)}&itPriority=HIGH&sort=ticketNumber&order=asc`)
      .set("Cookie", staffCookie);

    expect(filtered.status).toBe(200);
    expect(filtered.body.items).toHaveLength(3);
    expect(filtered.body.items.every((item: { itPriority: string }) => item.itPriority === "HIGH")).toBe(true);
    expect(filtered.body.items[0]).toEqual(expect.objectContaining({
      ticketNumber: expect.stringContaining("TKT-ISSUE6-"),
      requestedPriority: "MEDIUM",
      itPriority: "HIGH",
      currentStatus: "IN_PROGRESS",
      requester: { id: requesterId, name: expect.any(String), email: expect.any(String) },
      category: { id: categoryId, name: expect.any(String) },
      relatedSystem: { id: relatedSystemId, name: expect.any(String) },
    }));
    expect(filtered.body.items.some((item: { owner: null }) => item.owner === null)).toBe(false);

    const unassigned = await request(app)
      .get(`/api/staff/tickets?search=${encodeURIComponent(runToken)}&ownerId=unassigned`)
      .set("Cookie", staffCookie);
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.items).toHaveLength(1);
    expect(unassigned.body.items[0].owner).toBeNull();

    const pageTwo = await request(app)
      .get(`/api/staff/tickets?search=${encodeURIComponent(runToken)}&sort=ticketNumber&order=asc&page=2&pageSize=10`)
      .set("Cookie", staffCookie);
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.pagination).toEqual({ page: 2, pageSize: 10, totalItems: 11, totalPages: 2 });
    expect(pageTwo.body.items).toHaveLength(1);
    expect(pageTwo.body.items[0].summary).toContain("ticket 10");
  });

  it("uses the default sort and id tiebreaker for equal updatedAt values", async () => {
    const response = await request(app)
      .get(`/api/staff/tickets?search=${encodeURIComponent(runToken)}&pageSize=25`)
      .set("Cookie", staffCookie);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(11);
    expect(response.body.items.map((item: { id: number }) => item.id)).toEqual(
      [...createdTicketIds].sort((left, right) => right - left),
    );
    expect(new Set(response.body.items.map((item: { updatedAt: string }) => item.updatedAt)).size).toBe(1);
  });

  it("searches ticket fields and requester names while treating wildcards literally", async () => {
    const searches = [
      "TKT-ISSUE6-",
      `${runToken} ticket`,
      `${runToken} description`,
      "Issue 4 REQUESTER fixture",
    ];

    for (const search of searches) {
      const response = await request(app)
        .get("/api/staff/tickets")
        .query({ search })
        .set("Cookie", staffCookie);
      expect(response.status).toBe(200);
      expect(response.body.pagination.totalItems).toBeGreaterThan(0);
    }

    for (const wildcardSearch of ["%", "_"]) {
      const wildcard = await request(app)
        .get("/api/staff/tickets")
        .query({ search: wildcardSearch })
        .set("Cookie", staffCookie);
      expect(wildcard.status).toBe(200);
      expect(wildcard.body.pagination.totalItems).toBe(0);
    }
  });

  it("rejects unsupported query values with a safe 400 response", async () => {
    for (const query of [
      "itPriority=INVALID",
      "currentStatus=INVALID",
      "ownerId=abc",
      "ownerId=2147483648",
      "categoryId=2147483648",
      "sort=summary",
      "pageSize=5",
    ]) {
      const response = await request(app)
        .get(`/api/staff/tickets?${query}`)
        .set("Cookie", staffCookie);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Invalid query parameters" });
    }
  });

  it("opens safe operational Ticket Detail and protects the route by role", async () => {
    const detail = await request(app)
      .get(`/api/staff/tickets/${firstTicketId}`)
      .set("Cookie", staffCookie);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(expect.objectContaining({
      id: firstTicketId,
      requesterId,
      description: expect.stringContaining(runToken),
      owner: expect.objectContaining({ id: staffId, role: "IT_STAFF" }),
      publicComments: expect.any(Array),
      internalNotes: expect.any(Array),
      attachments: expect.any(Array),
    }));
    expect(JSON.stringify(detail.body)).not.toContain("storedName");

    const requesterDetail = await request(app)
      .get(`/api/staff/tickets/${firstTicketId}`)
      .set("Cookie", requesterCookie);
    expect(requesterDetail.status).toBe(403);
    expect(requesterDetail.body).toEqual({ error: "Forbidden" });

    const missing = await request(app)
      .get("/api/staff/tickets/999999999")
      .set("Cookie", staffCookie);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "Resource not found" });
  });
});

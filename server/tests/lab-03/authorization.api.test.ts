import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "./testSession.js";

const prisma = getPrisma();
const createdTicketIds: number[] = [];

describe("Lab 3 requester authorization", () => {
  let requesterId: number;
  let otherRequesterId: number;
  let staffId: number;
  let administratorId: number;
  let requesterCookie: string;
  let otherRequesterCookie: string;
  let staffCookie: string;
  let administratorCookie: string;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketId: number;

  beforeAll(async () => {
    await seedLab2Data(prisma);
    const [requester, otherRequester, staff, administrator, category, relatedSystem] = await Promise.all([
      createTestUser("lab3-issue4-authorization-requester@example.test", "REQUESTER"),
      createTestUser("lab3-issue4-authorization-other@example.test", "REQUESTER"),
      createTestUser("lab3-issue4-authorization-staff@example.test", "IT_STAFF"),
      createTestUser("lab3-issue4-authorization-admin@example.test", "ADMINISTRATOR"),
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!category || !relatedSystem) throw new Error("Seed data is missing");

    requesterId = requester.id;
    otherRequesterId = otherRequester.id;
    staffId = staff.id;
    administratorId = administrator.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    [requesterCookie, otherRequesterCookie, staffCookie, administratorCookie] = await Promise.all([
      sessionCookieFor(requesterId),
      sessionCookieFor(otherRequesterId),
      sessionCookieFor(staffId),
      sessionCookieFor(administratorId),
    ]);

    const created = await request(app)
      .post("/api/tickets")
      .set("Cookie", requesterCookie)
      .send({
        categoryId,
        relatedSystemId,
        summary: "Authorization fixture ticket",
        description: "A ticket used to verify authenticated ownership boundaries.",
        requestedPriority: "MEDIUM",
      });
    expect(created.status).toBe(201);
    ticketId = created.body.id;
    createdTicketIds.push(ticketId);
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await removeTestUsers([requesterId, otherRequesterId, staffId, administratorId]);
    await prisma.$disconnect();
  });

  it("requires an authenticated session for requester-owned routes", async () => {
    const [list, create, detail, attachments, categories] = await Promise.all([
      request(app).get("/api/tickets"),
      request(app).post("/api/tickets").send({}),
      request(app).get(`/api/tickets/${ticketId}`),
      request(app).get(`/api/tickets/${ticketId}/attachments`),
      request(app).get("/api/categories"),
    ]);

    for (const response of [list, create, detail, attachments, categories]) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Authentication required" });
    }
  });

  it("allows only requester sessions on requester-owned APIs", async () => {
    const staffList = await request(app)
      .get("/api/tickets")
      .set("Cookie", staffCookie);
    const staffAttachments = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("Cookie", staffCookie);
    const administratorCreate = await request(app)
      .post("/api/tickets")
      .set("Cookie", administratorCookie)
      .send({});
    const staffCompatibility = await request(app)
      .get("/api/requesters?active=true")
      .set("Cookie", staffCookie);

    expect(staffList.status).toBe(403);
    expect(staffAttachments.status).toBe(403);
    expect(administratorCreate.status).toBe(403);
    expect(staffCompatibility.status).toBe(403);
    expect(staffList.body).toEqual({ error: "Forbidden" });

    const spoofedCreate = await request(app)
      .post("/api/tickets")
      .set("Cookie", requesterCookie)
      .set("X-Requester-Id", String(otherRequesterId))
      .send({
        categoryId,
        relatedSystemId,
        summary: "Session identity wins over spoofed header",
        description: "The ticket must belong to the authenticated requester.",
        requestedPriority: "LOW",
      });

    expect(spoofedCreate.status).toBe(201);
    expect(spoofedCreate.body.requesterId).toBe(requesterId);
    createdTicketIds.push(spoofedCreate.body.id);
  });

  it("derives ownership from the session and hides another requester's ticket", async () => {
    const ownerList = await request(app)
      .get("/api/tickets")
      .set("Cookie", requesterCookie)
      .set("X-Requester-Id", String(otherRequesterId));
    const otherList = await request(app)
      .get("/api/tickets")
      .set("Cookie", otherRequesterCookie);
    const otherDetail = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Cookie", otherRequesterCookie);

    expect(ownerList.status).toBe(200);
    expect(ownerList.body.items.map((item: { id: number }) => item.id)).toContain(ticketId);
    expect(otherList.status).toBe(200);
    expect(otherList.body.items.map((item: { id: number }) => item.id)).not.toContain(ticketId);
    expect(otherDetail.status).toBe(404);
    expect(otherDetail.body).toEqual({ error: "Resource not found" });
  });

  it("permits authenticated reference-data reads without exposing credentials", async () => {
    const [categories, systems] = await Promise.all([
      request(app).get("/api/categories").set("Cookie", requesterCookie),
      request(app).get("/api/related-systems").set("Cookie", staffCookie),
    ]);

    expect(categories.status).toBe(200);
    expect(categories.body.every((item: { id: number; name: string }) => item.id && item.name)).toBe(true);
    expect(systems.status).toBe(200);
    expect(systems.body.every((item: { id: number; name: string }) => item.id && item.name)).toBe(true);
    expect(JSON.stringify(categories.body)).not.toContain("passwordHash");
  });
});

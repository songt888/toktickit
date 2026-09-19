import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "./testSession.js";

const prisma = getPrisma();

describe("Requester session regression coverage", () => {
  let requesterId: number;
  let otherRequesterId: number;
  let requesterCookie: string;
  let otherRequesterCookie: string;
  let ticketId: number;

  beforeAll(async () => {
    await seedLab2Data(prisma);
    const [requester, otherRequester, category, relatedSystem] = await Promise.all([
      createTestUser("lab3-issue4-regression-requester@example.test"),
      createTestUser("lab3-issue4-regression-other@example.test"),
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!category || !relatedSystem) throw new Error("Seed data is missing");

    requesterId = requester.id;
    otherRequesterId = otherRequester.id;
    requesterCookie = await sessionCookieFor(requesterId);
    otherRequesterCookie = await sessionCookieFor(otherRequesterId);

    const response = await request(app)
      .post("/api/tickets")
      .set("Cookie", requesterCookie)
      .send({
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Session migration regression fixture",
        description: "This ticket verifies that the authenticated session owns the workflow.",
        requestedPriority: "LOW",
      });
    expect(response.status).toBe(201);
    ticketId = response.body.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await removeTestUsers([requesterId, otherRequesterId]);
    await prisma.$disconnect();
  });

  it("keeps create, list, detail, and attachment APIs on session identity", async () => {
    const [list, detail, attachments] = await Promise.all([
      request(app)
        .get("/api/tickets")
        .set("Cookie", requesterCookie)
        .set("X-Requester-Id", "999999999"),
      request(app)
        .get(`/api/tickets/${ticketId}`)
        .set("Cookie", requesterCookie)
        .set("X-Requester-Id", "not-a-number"),
      request(app)
        .get(`/api/tickets/${ticketId}/attachments`)
        .set("Cookie", requesterCookie),
    ]);

    expect(list.status).toBe(200);
    expect(list.body.items.map((item: { id: number }) => item.id)).toContain(ticketId);
    expect(detail.status).toBe(200);
    expect(detail.body.requesterId).toBe(requesterId);
    expect(attachments.status).toBe(200);
    expect(attachments.body).toEqual([]);
  });

  it("returns a safe 404 for another requester's session", async () => {
    const response = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Cookie", otherRequesterCookie);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Resource not found" });
  });
});

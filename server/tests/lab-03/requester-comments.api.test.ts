import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "./testSession.js";

const prisma = getPrisma();
const createdTicketIds: number[] = [];

describe("Requester public comments and problem resolution", () => {
  let requesterId: number;
  let otherRequesterId: number;
  let requesterCookie: string;
  let otherRequesterCookie: string;
  let ticketId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    await seedLab2Data(prisma);
    const [requester, otherRequester, category, relatedSystem] = await Promise.all([
      createTestUser("lab3-issue5-comments-owner@example.test"),
      createTestUser("lab3-issue5-comments-other@example.test"),
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!category || !relatedSystem) throw new Error("Seed data is missing");

    requesterId = requester.id;
    otherRequesterId = otherRequester.id;
    requesterCookie = await sessionCookieFor(requesterId);
    otherRequesterCookie = await sessionCookieFor(otherRequesterId);
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;

    const created = await request(app)
      .post("/api/tickets")
      .set("Cookie", requesterCookie)
      .send({
        categoryId,
        relatedSystemId,
        summary: "Requester comment fixture",
        description: "A ticket used to verify public comments and resolution indication.",
        requestedPriority: "MEDIUM",
      });
    expect(created.status).toBe(201);
    ticketId = created.body.id;
    createdTicketIds.push(ticketId);
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await removeTestUsers([requesterId, otherRequesterId]);
    await prisma.$disconnect();
  });

  it("creates append-only comments with backend author/time and safe text", async () => {
    const first = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Cookie", requesterCookie)
      .send({ content: "  <script>alert(1)</script>  " });
    const second = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Cookie", requesterCookie)
      .send({ content: "The issue is still happening." });

    expect(first.status).toBe(201);
    expect(first.body).toEqual(expect.objectContaining({
      content: "<script>alert(1)</script>",
      author: { id: requesterId, name: expect.any(String), email: expect.any(String) },
      createdAt: expect.any(String),
    }));
    expect(first.body).not.toHaveProperty("authorId");
    expect(second.status).toBe(201);

    const listed = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set("Cookie", requesterCookie);
    expect(listed.status).toBe(200);
    expect(listed.body.map(({ content }: { content: string }) => content)).toEqual([
      "<script>alert(1)</script>",
      "The issue is still happening.",
    ]);
  });

  it("protects comments and resolution by authenticated ownership", async () => {
    const missingSession = await request(app).get(`/api/tickets/${ticketId}/comments`);
    expect(missingSession.status).toBe(401);

    const otherComments = await request(app)
      .get(`/api/tickets/${ticketId}/comments`)
      .set("Cookie", otherRequesterCookie);
    const otherCreate = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set("Cookie", otherRequesterCookie)
      .send({ content: "This must not be saved." });
    const otherResolution = await request(app)
      .post(`/api/tickets/${ticketId}/problem-resolution`)
      .set("Cookie", otherRequesterCookie)
      .send({ appearsResolved: true });

    expect(otherComments.status).toBe(404);
    expect(otherCreate.status).toBe(404);
    expect(otherResolution.status).toBe(404);
  });

  it("rejects empty, whitespace-only, and oversized comments", async () => {
    const before = await prisma.publicComment.count({ where: { ticketId } });
    for (const content of ["", "   ", "x".repeat(4001)]) {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set("Cookie", requesterCookie)
        .send({ content });
      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({
        error: "Validation failed",
        fieldErrors: { content: expect.any(String) },
      }));
    }
    expect(await prisma.publicComment.count({ where: { ticketId } })).toBe(before);
  });

  it("updates only the requester resolution indication and never the Ticket status", async () => {
    const malformed = await request(app)
      .post(`/api/tickets/${ticketId}/problem-resolution`)
      .set("Cookie", requesterCookie)
      .send({ appearsResolved: "true" });
    expect(malformed.status).toBe(400);

    const marked = await request(app)
      .post(`/api/tickets/${ticketId}/problem-resolution`)
      .set("Cookie", requesterCookie)
      .send({ appearsResolved: true });
    expect(marked.status).toBe(200);
    expect(marked.body).toEqual(expect.objectContaining({
      id: ticketId,
      problemAppearsResolved: true,
      problemAppearsResolvedAt: expect.any(String),
      currentStatus: "NEW",
      updatedAt: expect.any(String),
    }));

    const cleared = await request(app)
      .post(`/api/tickets/${ticketId}/problem-resolution`)
      .set("Cookie", requesterCookie)
      .send({ appearsResolved: false });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toEqual(expect.objectContaining({
      problemAppearsResolved: false,
      problemAppearsResolvedAt: null,
      currentStatus: "NEW",
    }));

    const saved = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { currentStatus: true, problemAppearsResolved: true },
    });
    expect(saved).toEqual({ currentStatus: "NEW", problemAppearsResolved: false });
  });
});

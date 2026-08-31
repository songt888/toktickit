import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";

const prisma = getPrisma();
const createdTicketIds: number[] = [];
const createdAttachmentIds: number[] = [];

describe("GET /api/tickets/:id", () => {
  let ownedTicketId: number;
  let ownerId: number;
  let otherRequesterId: number;
  let categoryId: number;
  let relatedSystemId: number;

  beforeAll(async () => {
    await seedLab2Data(prisma);
    const [requesters, category, relatedSystem] = await Promise.all([
      prisma.requesterUser.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, take: 2 }),
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (requesters.length < 2 || !category || !relatedSystem) throw new Error("Seed data is missing");

    ownerId = requesters[0].id;
    otherRequesterId = requesters[1].id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;

    const ticketResponse = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(ownerId))
      .send({
        categoryId,
        relatedSystemId,
        summary: "Ticket detail fixture",
        description: "A ticket fixture for the requester-owned detail API test.",
        requestedPriority: "HIGH",
      });
    expect(ticketResponse.status).toBe(201);
    ownedTicketId = ticketResponse.body.id;
    createdTicketIds.push(ownedTicketId);

    const [activeAttachment, removedAttachment] = await Promise.all([
      prisma.attachment.create({
        data: {
          ticketId: ownedTicketId,
          originalName: "network-log.png",
          storedName: `issue22-active-${Date.now()}.png`,
          mimeType: "image/png",
          sizeBytes: 2048,
          createdAt: new Date("2026-08-29T00:30:00.000Z"),
        },
      }),
      prisma.attachment.create({
        data: {
          ticketId: ownedTicketId,
          originalName: "old-log.pdf",
          storedName: `issue22-removed-${Date.now()}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 4096,
          createdAt: new Date("2026-08-29T01:00:00.000Z"),
          removedAt: new Date("2026-08-29T01:00:00.000Z"),
          removalReason: "No longer needed",
        },
      }),
    ]);
    createdAttachmentIds.push(activeAttachment.id, removedAttachment.id);
  });

  afterAll(async () => {
    if (createdAttachmentIds.length > 0) {
      await prisma.attachment.deleteMany({ where: { id: { in: createdAttachmentIds } } });
    }
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await prisma.$disconnect();
  });

  it("returns read-only ticket fields and attachment metadata for the owner", async () => {
    const response = await request(app)
      .get(`/api/tickets/${ownedTicketId}`)
      .set("X-Requester-Id", String(ownerId));

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      id: ownedTicketId,
      ticketNumber: expect.stringMatching(/^TKT-/),
      summary: "Ticket detail fixture",
      description: "A ticket fixture for the requester-owned detail API test.",
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      requester: { id: ownerId, name: expect.any(String), email: expect.any(String) },
      category: { id: categoryId, name: expect.any(String) },
      relatedSystem: { id: relatedSystemId, name: expect.any(String) },
    }));
    expect(response.body.attachments).toEqual([
      expect.objectContaining({
        originalName: "network-log.png",
        mimeType: "image/png",
        sizeBytes: 2048,
        removedAt: null,
        removalReason: null,
      }),
      expect.objectContaining({
        originalName: "old-log.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4096,
        removedAt: "2026-08-29T01:00:00.000Z",
        removalReason: "No longer needed",
      }),
    ]);
  });

  it("does not reveal a ticket to another requester or an unknown ticket id", async () => {
    const crossRequesterResponse = await request(app)
      .get(`/api/tickets/${ownedTicketId}`)
      .set("X-Requester-Id", String(otherRequesterId));
    expect(crossRequesterResponse.status).toBe(404);
    expect(crossRequesterResponse.body).toEqual({ error: "Resource not found" });

    const unknownResponse = await request(app)
      .get("/api/tickets/999999999")
      .set("X-Requester-Id", String(ownerId));
    expect(unknownResponse.status).toBe(404);
    expect(unknownResponse.body).toEqual({ error: "Resource not found" });
  });

  it("validates requester context before looking up the ticket", async () => {
    const missingHeader = await request(app).get(`/api/tickets/${ownedTicketId}`);
    expect(missingHeader.status).toBe(400);
    expect(missingHeader.body).toEqual({ error: "Requester context is required" });

    const malformedHeader = await request(app)
      .get(`/api/tickets/${ownedTicketId}`)
      .set("X-Requester-Id", "not-a-number");
    expect(malformedHeader.status).toBe(400);
    expect(malformedHeader.body).toEqual({ error: "Requester context is required" });

    const unknownRequester = await request(app)
      .get(`/api/tickets/${ownedTicketId}`)
      .set("X-Requester-Id", "999999999");
    expect(unknownRequester.status).toBe(404);
    expect(unknownRequester.body).toEqual({ error: "Requester not found" });

    const inactiveRequester = await prisma.requesterUser.findFirst({ where: { isActive: false } });
    if (!inactiveRequester) throw new Error("Inactive requester fixture is missing");
    const inactiveResponse = await request(app)
      .get(`/api/tickets/${ownedTicketId}`)
      .set("X-Requester-Id", String(inactiveRequester.id));
    expect(inactiveResponse.status).toBe(404);
    expect(inactiveResponse.body).toEqual({ error: "Requester not found" });
  });
});

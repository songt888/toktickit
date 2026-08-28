import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";

const prisma = getPrisma();
const createdTicketIds: number[] = [];

describe("GET /api/tickets", () => {
  let requesterA: number;
  let requesterB: number;
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

    requesterA = requesters[0].id;
    requesterB = requesters[1].id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await prisma.$disconnect();
  });

  async function createFixture(requesterId: number, summary: string, priority = "MEDIUM") {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterId))
      .send({
        categoryId,
        relatedSystemId,
        summary,
        description: `${summary} description for the My Tickets test.`,
        requestedPriority: priority,
      });

    expect(response.status).toBe(201);
    createdTicketIds.push(response.body.id);
    return response.body;
  }

  it("returns only the selected requester's tickets with pagination metadata", async () => {
    const ownTicket = await createFixture(requesterA, "My Tickets ownership fixture");
    const otherTicket = await createFixture(requesterB, "Private ticket for another requester");

    const response = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", String(requesterA));

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(response.body.items.some(({ id }: { id: number }) => id === ownTicket.id)).toBe(true);
    expect(response.body.items.some(({ id }: { id: number }) => id === otherTicket.id)).toBe(false);
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        ticketNumber: expect.any(String),
        summary: expect.any(String),
        category: { id: categoryId, name: expect.any(String) },
        relatedSystem: { id: relatedSystemId, name: expect.any(String) },
      }),
    );
  });

  it("applies search, filters, sorting, and page-size options", async () => {
    await createFixture(requesterA, "Unique list alpha", "HIGH");
    await createFixture(requesterA, "Unique list beta", "LOW");

    const response = await request(app)
      .get("/api/tickets?search=unique%20list&requestedPriority=HIGH&sort=ticketNumber&order=asc&pageSize=25")
      .set("X-Requester-Id", String(requesterA));

    expect(response.status).toBe(200);
    expect(response.body.pagination).toMatchObject({ page: 1, pageSize: 25 });
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].summary).toBe("Unique list alpha");
  });

  it("rejects invalid query parameters safely", async () => {
    const response = await request(app)
      .get("/api/tickets?pageSize=5")
      .set("X-Requester-Id", String(requesterA));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid query parameters" });
  });

  it("validates requester context before listing tickets", async () => {
    const missingHeader = await request(app).get("/api/tickets");
    expect(missingHeader.status).toBe(400);
    expect(missingHeader.body).toEqual({ error: "Requester context is required" });

    const inactiveRequester = await prisma.requesterUser.findFirst({ where: { isActive: false } });
    if (!inactiveRequester) throw new Error("Inactive requester fixture is missing");
    const inactiveResponse = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", String(inactiveRequester.id));
    expect(inactiveResponse.status).toBe(404);
    expect(inactiveResponse.body).toEqual({ error: "Requester not found" });
  });
});

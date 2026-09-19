import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { seedLab2Data } from "../../prisma/seed.js";
import { getPrisma } from "../../src/prisma.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "../lab-03/testSession.js";

const prisma = getPrisma();
const createdTicketIds: number[] = [];
let requesterId: number;
let authCookie = "";

describe("Create Ticket API", () => {
  beforeAll(async () => {
    await seedLab2Data(prisma);
    const requester = await createTestUser("lab3-issue4-create@example.test");
    requesterId = requester.id;
    authCookie = await sessionCookieFor(requesterId);
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await removeTestUsers([requesterId]);
    await prisma.$disconnect();
  });

  it("returns active related systems in id order", async () => {
    const expected = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const response = await request(app)
      .get("/api/related-systems")
      .set("Cookie", authCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expected);
    expect(response.body.some(({ name }: { name: string }) => name === "Legacy System")).toBe(false);
  });

  it("creates one owned ticket with an official number and NEW status", async () => {
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!category || !relatedSystem) throw new Error("Seed data is missing");

    const response = await request(app)
      .post("/api/tickets")
      .set("Cookie", authCookie)
      .send({
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Laptop battery drains quickly",
        description: "The battery falls below 20 percent after a short session.",
        requestedPriority: "MEDIUM",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      requesterId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Laptop battery drains quickly",
      description: "The battery falls below 20 percent after a short session.",
      requestedPriority: "MEDIUM",
      currentStatus: "NEW",
    });
    expect(response.body.ticketNumber).toMatch(/^TKT-\d{8}-\d{6,}$/);
    expect(response.body.ticketDate).toEqual(expect.any(String));

    createdTicketIds.push(response.body.id);
    const saved = await prisma.ticket.findUnique({ where: { id: response.body.id } });
    expect(saved).toMatchObject({
      requesterId,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      currentStatus: "NEW",
      ticketNumber: response.body.ticketNumber,
    });
  });

  it("rejects invalid payloads without creating a ticket", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("Cookie", authCookie)
      .send({ summary: "bad" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({ error: "Validation failed" }));
    expect(response.body.fieldErrors).toEqual(
      expect.objectContaining({
        categoryId: expect.any(String),
        relatedSystemId: expect.any(String),
        description: expect.any(String),
        requestedPriority: expect.any(String),
      }),
    );
  });

  it("rejects missing requester context and inactive reference records safely", async () => {
    const missingHeader = await request(app).post("/api/tickets").send({});
    expect(missingHeader.status).toBe(401);
    expect(missingHeader.body).toEqual({ error: "Authentication required" });

    const [inactiveCategory, activeSystem] = await Promise.all([
      prisma.category.findFirst({ where: { isActive: false } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!inactiveCategory || !activeSystem) throw new Error("Seed data is missing");

    const response = await request(app)
      .post("/api/tickets")
      .set("Cookie", authCookie)
      .send({
        categoryId: inactiveCategory.id,
        relatedSystemId: activeSystem.id,
        summary: "Inactive category should fail",
        description: "This must not create a ticket using inactive reference data.",
        requestedPriority: "LOW",
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Requester or reference data not found" });
  });
});

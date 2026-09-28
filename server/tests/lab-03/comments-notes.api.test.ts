import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "./testSession.js";

const prisma = getPrisma();
const createdUserIds: number[] = [];
const createdTicketIds: number[] = [];

describe("Public Comments and Internal Notes API", () => {
  let staffId: number;
  let administratorId: number;
  let requesterId: number;
  let otherRequesterId: number;
  let staffCookie: string;
  let administratorCookie: string;
  let requesterCookie: string;
  let otherRequesterCookie: string;
  let ownedTicketId: number;

  async function createTicket(requesterIdForTicket: number, suffix: string) {
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!category || !relatedSystem) throw new Error("Seed data is missing");

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-LAB3-I8-${suffix}`,
        requesterId: requesterIdForTicket,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: `Issue 8 ${suffix} comments fixture`,
        description: "Ticket fixture for role-controlled comments and internal notes.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "NEW",
      },
      select: { id: true },
    });
    createdTicketIds.push(ticket.id);
    return ticket.id;
  }

  beforeAll(async () => {
    await seedLab2Data(prisma);
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const [staff, administrator, requester, otherRequester] = await Promise.all([
      createTestUser(`lab3-issue8-staff-${suffix}@example.test`, "IT_STAFF"),
      createTestUser(`lab3-issue8-admin-${suffix}@example.test`, "ADMINISTRATOR"),
      createTestUser(`lab3-issue8-requester-${suffix}@example.test`, "REQUESTER"),
      createTestUser(`lab3-issue8-other-${suffix}@example.test`, "REQUESTER"),
    ]);

    staffId = staff.id;
    administratorId = administrator.id;
    requesterId = requester.id;
    otherRequesterId = otherRequester.id;
    createdUserIds.push(staffId, administratorId, requesterId, otherRequesterId);
    [staffCookie, administratorCookie, requesterCookie, otherRequesterCookie] = await Promise.all([
      sessionCookieFor(staffId),
      sessionCookieFor(administratorId),
      sessionCookieFor(requesterId),
      sessionCookieFor(otherRequesterId),
    ]);
    ownedTicketId = await createTicket(requesterId, `${suffix}-A`);
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await removeTestUsers(createdUserIds);
    await prisma.$disconnect();
  });

  it("serves ordered Public Comments to their owner, Staff, and Administrators", async () => {
    const suppliedTimestamp = "2000-01-01T00:00:00.000Z";
    const first = await request(app)
      .post(`/api/tickets/${ownedTicketId}/comments`)
      .set("Cookie", staffCookie)
      .send({
        content: "  <script>comment text</script>  ",
        authorId: administratorId,
        createdAt: suppliedTimestamp,
      });
    expect(first.status).toBe(201);
    expect(first.body).toEqual(expect.objectContaining({
      content: "<script>comment text</script>",
      author: { id: staffId, name: expect.any(String), email: expect.any(String) },
      createdAt: expect.any(String),
    }));
    expect(first.body).not.toHaveProperty("authorId");
    expect(first.body.createdAt).not.toBe(suppliedTimestamp);

    const second = await request(app)
      .post(`/api/tickets/${ownedTicketId}/comments`)
      .set("Cookie", administratorCookie)
      .send({ content: "Administrator update." });
    expect(second.status).toBe(201);
    expect(second.body.author.id).toBe(administratorId);

    for (const cookie of [staffCookie, administratorCookie, requesterCookie]) {
      const listed = await request(app)
        .get(`/api/tickets/${ownedTicketId}/comments`)
        .set("Cookie", cookie);
      expect(listed.status).toBe(200);
      expect(listed.body.map(({ content }: { content: string }) => content)).toEqual([
        "<script>comment text</script>",
        "Administrator update.",
      ]);
    }

    const crossOwner = await request(app)
      .get(`/api/tickets/${ownedTicketId}/comments`)
      .set("Cookie", otherRequesterCookie);
    expect(crossOwner.status).toBe(404);
    expect(crossOwner.body).toEqual({ error: "Resource not found" });
  });

  it("restricts Internal Notes to Staff and Administrators without leaking them", async () => {
    const first = await request(app)
      .post(`/api/tickets/${ownedTicketId}/internal-notes`)
      .set("Cookie", staffCookie)
      .send({ content: "  Checked device inventory.  ", authorId: administratorId });
    const second = await request(app)
      .post(`/api/tickets/${ownedTicketId}/internal-notes`)
      .set("Cookie", administratorCookie)
      .send({ content: "Replacement is available." });

    expect(first.status).toBe(201);
    expect(first.body).toEqual(expect.objectContaining({
      content: "Checked device inventory.",
      author: { id: staffId, name: expect.any(String), email: expect.any(String) },
      createdAt: expect.any(String),
    }));
    expect(first.body).not.toHaveProperty("authorId");
    expect(second.status).toBe(201);
    expect(second.body.author.id).toBe(administratorId);

    const listed = await request(app)
      .get(`/api/tickets/${ownedTicketId}/internal-notes`)
      .set("Cookie", administratorCookie);
    expect(listed.status).toBe(200);
    expect(listed.body.map(({ content }: { content: string }) => content)).toEqual([
      "Checked device inventory.",
      "Replacement is available.",
    ]);

    const missingSession = await request(app).get(`/api/tickets/${ownedTicketId}/internal-notes`);
    expect(missingSession.status).toBe(401);

    const requesterRead = await request(app)
      .get(`/api/tickets/${ownedTicketId}/internal-notes`)
      .set("Cookie", requesterCookie);
    const requesterWrite = await request(app)
      .post(`/api/tickets/${ownedTicketId}/internal-notes`)
      .set("Cookie", requesterCookie)
      .send({ content: "Requester must not add notes." });
    expect(requesterRead.status).toBe(403);
    expect(requesterRead.body).toEqual({ error: "Forbidden" });
    expect(requesterWrite.status).toBe(403);
    expect(requesterWrite.body).toEqual({ error: "Forbidden" });

    const crossOwnerRead = await request(app)
      .get(`/api/tickets/${ownedTicketId}/internal-notes`)
      .set("Cookie", otherRequesterCookie);
    const crossOwnerWrite = await request(app)
      .post(`/api/tickets/${ownedTicketId}/internal-notes`)
      .set("Cookie", otherRequesterCookie)
      .send({ content: "Must not reveal another Ticket." });
    expect(crossOwnerRead.status).toBe(404);
    expect(crossOwnerRead.body).toEqual({ error: "Resource not found" });
    expect(crossOwnerWrite.status).toBe(404);
    expect(crossOwnerWrite.body).toEqual({ error: "Resource not found" });

    expect(await prisma.internalNote.count({ where: { ticketId: ownedTicketId } })).toBe(2);
  });

  it("rejects blank and oversized public comments and internal notes without inserting rows", async () => {
    const beforeComments = await prisma.publicComment.count({ where: { ticketId: ownedTicketId } });
    const beforeNotes = await prisma.internalNote.count({ where: { ticketId: ownedTicketId } });

    for (const content of ["", "   ", "x".repeat(4001)]) {
      const comment = await request(app)
        .post(`/api/tickets/${ownedTicketId}/comments`)
        .set("Cookie", staffCookie)
        .send({ content });
      const note = await request(app)
        .post(`/api/tickets/${ownedTicketId}/internal-notes`)
        .set("Cookie", staffCookie)
        .send({ content });

      expect(comment.status).toBe(400);
      expect(comment.body).toMatchObject({ error: "Validation failed", fieldErrors: { content: expect.any(String) } });
      expect(note.status).toBe(400);
      expect(note.body).toMatchObject({ error: "Validation failed", fieldErrors: { content: expect.any(String) } });
    }

    expect(await prisma.publicComment.count({ where: { ticketId: ownedTicketId } })).toBe(beforeComments);
    expect(await prisma.internalNote.count({ where: { ticketId: ownedTicketId } })).toBe(beforeNotes);
  });

  it("keeps comments and notes append-only", async () => {
    const comment = await request(app)
      .post(`/api/tickets/${ownedTicketId}/comments`)
      .set("Cookie", staffCookie)
      .send({ content: "This comment must remain unchanged." });
    const note = await request(app)
      .post(`/api/tickets/${ownedTicketId}/internal-notes`)
      .set("Cookie", staffCookie)
      .send({ content: "This note must remain unchanged." });

    expect(comment.status).toBe(201);
    expect(note.status).toBe(201);

    const unsupportedMutations = await Promise.all([
      request(app).patch(`/api/tickets/${ownedTicketId}/comments/${comment.body.id}`).set("Cookie", staffCookie).send({ content: "Edited" }),
      request(app).delete(`/api/tickets/${ownedTicketId}/comments/${comment.body.id}`).set("Cookie", staffCookie),
      request(app).patch(`/api/tickets/${ownedTicketId}/internal-notes/${note.body.id}`).set("Cookie", staffCookie).send({ content: "Edited" }),
      request(app).delete(`/api/tickets/${ownedTicketId}/internal-notes/${note.body.id}`).set("Cookie", staffCookie),
    ]);

    expect(unsupportedMutations.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
    expect((await prisma.publicComment.findUniqueOrThrow({ where: { id: comment.body.id } })).content)
      .toBe("This comment must remain unchanged.");
    expect((await prisma.internalNote.findUniqueOrThrow({ where: { id: note.body.id } })).content)
      .toBe("This note must remain unchanged.");
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";

const prisma = getPrisma();
const storageDir = path.resolve(process.env.ATTACHMENT_STORAGE_DIR ?? path.join(process.cwd(), "uploads"));
const createdTicketIds: number[] = [];
const createdAttachmentIds: number[] = [];

describe("Attachment lifecycle API", () => {
  let ownerId: number;
  let otherRequesterId: number;
  let ticketId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let uploadedAttachmentId: number;

  async function createTicket(summary: string) {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(ownerId))
      .send({
        categoryId,
        relatedSystemId,
        summary,
        description: `${summary} attachment fixture description.`,
        requestedPriority: "MEDIUM",
      });
    expect(response.status).toBe(201);
    createdTicketIds.push(response.body.id);
    return response.body.id as number;
  }

  async function upload(targetTicketId: number, filename = "error.png", contentType = "image/png", contents = Buffer.from("attachment-data")) {
    const response = await request(app)
      .post(`/api/tickets/${targetTicketId}/attachments`)
      .set("X-Requester-Id", String(ownerId))
      .attach("file", contents, { filename, contentType });
    if (response.status === 201) createdAttachmentIds.push(response.body.id);
    return response;
  }

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
    ticketId = await createTicket("Attachment lifecycle fixture");
  });

  afterAll(async () => {
    const attachments = await prisma.attachment.findMany({
      where: { id: { in: createdAttachmentIds } },
      select: { storedName: true },
    });
    await Promise.all(attachments.map(({ storedName }) => unlink(path.join(storageDir, storedName)).catch(() => undefined)));
    if (createdAttachmentIds.length > 0) {
      await prisma.attachment.deleteMany({ where: { id: { in: createdAttachmentIds } } });
    }
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await prisma.$disconnect();
  });

  it("uploads a permitted file with generated storage and retrievable metadata", async () => {
    const contents = Buffer.from("png-like attachment bytes");
    const response = await upload(ticketId, "network-log.png", "image/png", contents);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      originalName: "network-log.png",
      mimeType: "image/png",
      sizeBytes: contents.length,
      removedAt: null,
      removalReason: null,
    }));
    expect(response.body.storedName).toBeUndefined();
    uploadedAttachmentId = response.body.id;

    const stored = await prisma.attachment.findUnique({
      where: { id: uploadedAttachmentId },
      select: { storedName: true },
    });
    expect(stored?.storedName).toBeTruthy();
    expect(stored?.storedName).not.toBe("network-log.png");
    await expect(readFile(path.join(storageDir, stored!.storedName))).resolves.toEqual(contents);

    const metadata = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", String(ownerId));
    expect(metadata.status).toBe(200);
    expect(metadata.body).toEqual([
      expect.objectContaining({ id: uploadedAttachmentId, originalName: "network-log.png" }),
    ]);
  });

  it("rejects unsupported, oversized, and sixth active files safely", async () => {
    const unsupported = await upload(ticketId, "malware.exe", "application/octet-stream");
    expect(unsupported.status).toBe(415);

    const oversized = await upload(
      ticketId,
      "large.pdf",
      "application/pdf",
      Buffer.alloc(5 * 1024 * 1024 + 1),
    );
    expect(oversized.status).toBe(413);

    const countTicketId = await createTicket("Attachment count fixture");
    for (let index = 0; index < 5; index += 1) {
      const response = await upload(countTicketId, `file-${index}.pdf`, "application/pdf");
      expect(response.status).toBe(201);
    }
    const sixth = await upload(countTicketId, "file-six.pdf", "application/pdf");
    expect(sixth.status).toBe(409);

    const concurrentTicketId = await createTicket("Concurrent attachment count fixture");
    for (let index = 0; index < 4; index += 1) {
      const response = await upload(concurrentTicketId, `concurrent-${index}.png`);
      expect(response.status).toBe(201);
    }

    const concurrentResponses = await Promise.all([
      upload(concurrentTicketId, "concurrent-a.png"),
      upload(concurrentTicketId, "concurrent-b.png"),
    ]);
    expect(concurrentResponses.map((response) => response.status).sort()).toEqual([201, 409]);

    const concurrentMetadata = await request(app)
      .get(`/api/tickets/${concurrentTicketId}/attachments`)
      .set("X-Requester-Id", String(ownerId));
    expect(concurrentMetadata.status).toBe(200);
    expect(concurrentMetadata.body).toHaveLength(5);
  });

  it("allows owner download but rejects cross-requester and removed-file access", async () => {
    const ownerDownload = await request(app)
      .get(`/api/attachments/${uploadedAttachmentId}/download`)
      .set("X-Requester-Id", String(ownerId));
    expect(ownerDownload.status).toBe(200);
    expect(ownerDownload.headers["content-type"]).toContain("image/png");
    expect(ownerDownload.headers["content-disposition"]).toContain("network-log.png");
    expect(ownerDownload.body).toEqual(Buffer.from("png-like attachment bytes"));

    const crossRequesterDownload = await request(app)
      .get(`/api/attachments/${uploadedAttachmentId}/download`)
      .set("X-Requester-Id", String(otherRequesterId));
    expect(crossRequesterDownload.status).toBe(404);

    const crossRequesterRemove = await request(app)
      .patch(`/api/attachments/${uploadedAttachmentId}/remove`)
      .set("X-Requester-Id", String(otherRequesterId))
      .send({ reason: "Cross requester attempt" });
    expect(crossRequesterRemove.status).toBe(404);
  });

  it("soft-removes an attachment with a reason and keeps metadata", async () => {
    const invalidReason = await request(app)
      .patch(`/api/attachments/${uploadedAttachmentId}/remove`)
      .set("X-Requester-Id", String(ownerId))
      .send({ reason: "no" });
    expect(invalidReason.status).toBe(400);

    const removed = await request(app)
      .patch(`/api/attachments/${uploadedAttachmentId}/remove`)
      .set("X-Requester-Id", String(ownerId))
      .send({ reason: "No longer needed" });
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual(expect.objectContaining({
      id: uploadedAttachmentId,
      removedAt: expect.any(String),
      removalReason: "No longer needed",
    }));

    const repeated = await request(app)
      .patch(`/api/attachments/${uploadedAttachmentId}/remove`)
      .set("X-Requester-Id", String(ownerId))
      .send({ reason: "Try again" });
    expect(repeated.status).toBe(409);

    const removedDownload = await request(app)
      .get(`/api/attachments/${uploadedAttachmentId}/download`)
      .set("X-Requester-Id", String(ownerId));
    expect(removedDownload.status).toBe(404);

    const metadata = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", String(ownerId));
    expect(metadata.body).toEqual([
      expect.objectContaining({
        id: uploadedAttachmentId,
        removedAt: expect.any(String),
        removalReason: "No longer needed",
      }),
    ]);
  });

  it("validates requester context before attachment access", async () => {
    const missing = await request(app).get(`/api/tickets/${ticketId}/attachments`);
    expect(missing.status).toBe(400);

    const malformed = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", "abc");
    expect(malformed.status).toBe(400);

    const unknown = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", "999999999");
    expect(unknown.status).toBe(404);
  });
});

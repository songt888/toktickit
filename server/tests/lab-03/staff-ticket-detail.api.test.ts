import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "./testSession.js";

const prisma = getPrisma();
const createdUserIds: number[] = [];
let ticketId = 0;
let attachmentId = 0;
let attachmentPath = "";
let categoryId = 0;
let relatedSystemId = 0;
let staffId = 0;
let secondStaffId = 0;
let administratorId = 0;
let requesterId = 0;
let inactiveStaffId = 0;
let staffCookie = "";
let administratorCookie = "";
let requesterCookie = "";

describe("IT Staff Ticket workflow API", () => {
  beforeAll(async () => {
    await seedLab2Data(prisma);
    const suffix = Date.now();
    const [staff, secondStaff, administrator, requester, inactiveStaff, category, relatedSystem] = await Promise.all([
      createTestUser(`lab3-issue7-staff-${suffix}@example.test`, "IT_STAFF"),
      createTestUser(`lab3-issue7-second-staff-${suffix}@example.test`, "IT_STAFF"),
      createTestUser(`lab3-issue7-admin-${suffix}@example.test`, "ADMINISTRATOR"),
      createTestUser(`lab3-issue7-requester-${suffix}@example.test`, "REQUESTER"),
      createTestUser(`lab3-issue7-inactive-${suffix}@example.test`, "IT_STAFF"),
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!category || !relatedSystem) throw new Error("Seed data is missing");

    staffId = staff.id;
    secondStaffId = secondStaff.id;
    administratorId = administrator.id;
    requesterId = requester.id;
    inactiveStaffId = inactiveStaff.id;
    createdUserIds.push(staffId, secondStaffId, administratorId, requesterId, inactiveStaffId);
    await prisma.user.update({ where: { id: inactiveStaffId }, data: { isActive: false } });
    [staffCookie, administratorCookie, requesterCookie] = await Promise.all([
      sessionCookieFor(staffId),
      sessionCookieFor(administratorId),
      sessionCookieFor(requesterId),
    ]);
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-ISSUE7-${suffix}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary: "Issue 7 staff workflow fixture",
        description: "A private test Ticket for Staff ownership and status operations.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "NEW",
      },
    });
    ticketId = ticket.id;

    const storageDirectory = path.resolve(
      process.env.ATTACHMENT_STORAGE_DIR ?? path.join(process.cwd(), "uploads"),
    );
    const contents = Buffer.from("Issue 7 attachment access fixture");
    const storedName = `${randomUUID()}.txt`;
    attachmentPath = path.join(storageDirectory, storedName);
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(attachmentPath, contents, { flag: "wx" });
    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        originalName: "workflow-evidence.txt",
        storedName,
        mimeType: "text/plain",
        sizeBytes: contents.length,
      },
    });
    attachmentId = attachment.id;
  });

  afterAll(async () => {
    if (attachmentId) await prisma.attachment.deleteMany({ where: { id: attachmentId } });
    if (ticketId) await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await removeTestUsers(createdUserIds);
    if (attachmentPath) await unlink(attachmentPath).catch(() => undefined);
    await prisma.$disconnect();
  });

  async function resetTicket(currentStatus: "NEW" | "RESOLVED" = "NEW") {
    const previous = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { updatedAt: true } });
    const updatedAt = new Date(Math.max(Date.now(), (previous?.updatedAt.getTime() ?? 0) + 5));
    return prisma.ticket.update({
      where: { id: ticketId },
      data: {
        ownerId: null,
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus,
        updatedAt,
      },
    });
  }

  it("lists only active Staff and Administrators as safe assignees", async () => {
    const [staff, admin, requester, anonymous] = await Promise.all([
      request(app).get("/api/staff/assignees").set("Cookie", staffCookie),
      request(app).get("/api/staff/assignees").set("Cookie", administratorCookie),
      request(app).get("/api/staff/assignees").set("Cookie", requesterCookie),
      request(app).get("/api/staff/assignees"),
    ]);

    for (const response of [staff, admin]) {
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: staffId, role: "IT_STAFF" }),
        expect.objectContaining({ id: administratorId, role: "ADMINISTRATOR" }),
      ]));
      expect(response.body).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: requesterId }),
        expect.objectContaining({ id: inactiveStaffId }),
      ]));
      expect(JSON.stringify(response.body)).not.toMatch(/password|session/i);
    }
    expect(requester.status).toBe(403);
    expect(anonymous.status).toBe(401);
  });

  it("keeps operational attachment metadata and download available to Staff", async () => {
    const detail = await request(app)
      .get(`/api/staff/tickets/${ticketId}`)
      .set("Cookie", staffCookie);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(expect.objectContaining({
      ownerId: null,
      attachments: [expect.objectContaining({ id: attachmentId, originalName: "workflow-evidence.txt" })],
    }));
    expect(JSON.stringify(detail.body)).not.toContain("storedName");

    const list = await request(app)
      .get(`/api/tickets/${ticketId}/attachments`)
      .set("Cookie", staffCookie);
    expect(list.status).toBe(200);
    expect(list.body).toEqual([expect.objectContaining({ id: attachmentId, originalName: "workflow-evidence.txt" })]);

    const download = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set("Cookie", staffCookie);
    expect(download.status).toBe(200);
    expect(download.text).toBe("Issue 7 attachment access fixture");
  });

  it("supports claiming, assigning, reassigning, and unassigning with fresh versions", async () => {
    await resetTicket();
    const version = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } });

    const claimed = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Cookie", staffCookie)
      .send({ ownerId: staffId, updatedAt: version.updatedAt.toISOString() });
    expect(claimed.status).toBe(200);
    expect(claimed.body).toEqual(expect.objectContaining({
      ownerId: staffId,
      owner: expect.objectContaining({ id: staffId, role: "IT_STAFF" }),
      updatedAt: expect.any(String),
    }));
    expect(new Date(claimed.body.updatedAt).getTime()).toBeGreaterThan(version.updatedAt.getTime());

    const reassigned = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Cookie", administratorCookie)
      .send({ ownerId: secondStaffId, updatedAt: claimed.body.updatedAt });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.ownerId).toBe(secondStaffId);

    const assignedToAdmin = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Cookie", staffCookie)
      .send({ ownerId: administratorId, updatedAt: reassigned.body.updatedAt });
    expect(assignedToAdmin.status).toBe(200);
    expect(assignedToAdmin.body.owner.role).toBe("ADMINISTRATOR");

    const unassigned = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Cookie", staffCookie)
      .send({ ownerId: null, updatedAt: assignedToAdmin.body.updatedAt });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.ownerId).toBeNull();
    expect(unassigned.body.owner).toBeNull();
  });

  it("rejects invalid or inactive owners without changing the Ticket", async () => {
    await resetTicket();
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { ownerId: true, updatedAt: true } });

    for (const ownerId of [requesterId, inactiveStaffId, 2_147_483_648]) {
      const response = await request(app)
        .patch(`/api/staff/tickets/${ticketId}/owner`)
        .set("Cookie", staffCookie)
        .send({ ownerId, updatedAt: before.updatedAt.toISOString() });
      expect(response.status).toBe(400);
    }
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { ownerId: true, updatedAt: true } });
    expect(after).toEqual(before);
  });

  it("updates only IT Priority and rejects Requester mutations", async () => {
    await resetTicket();
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } });
    const changed = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/it-priority`)
      .set("Cookie", staffCookie)
      .send({ itPriority: "URGENT", updatedAt: before.updatedAt.toISOString() });
    expect(changed.status).toBe(200);
    expect(changed.body.itPriority).toBe("URGENT");
    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { requestedPriority: true, itPriority: true } });
    expect(saved).toEqual({ requestedPriority: "MEDIUM", itPriority: "URGENT" });

    const forbidden = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/it-priority`)
      .set("Cookie", requesterCookie)
      .send({ itPriority: "LOW", updatedAt: changed.body.updatedAt });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: "Forbidden" });

    const forbiddenOwner = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/owner`)
      .set("Cookie", requesterCookie)
      .send({ ownerId: staffId, updatedAt: changed.body.updatedAt });
    const forbiddenStatus = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("Cookie", requesterCookie)
      .send({ status: "OPEN", updatedAt: changed.body.updatedAt });
    expect(forbiddenOwner.status).toBe(403);
    expect(forbiddenStatus.status).toBe(403);
  });

  it("enforces allowed transitions and requires confirmation for terminal changes", async () => {
    await resetTicket();
    let current = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } });

    const invalid = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("Cookie", staffCookie)
      .send({ status: "RESOLVED", updatedAt: current.updatedAt.toISOString() });
    expect(invalid.status).toBe(409);

    const toOpen = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("Cookie", staffCookie)
      .send({ status: "OPEN", updatedAt: current.updatedAt.toISOString() });
    expect(toOpen.status).toBe(200);
    expect(toOpen.body.currentStatus).toBe("OPEN");

    await resetTicket("RESOLVED");
    current = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } });
    const unconfirmedClose = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("Cookie", staffCookie)
      .send({ status: "CLOSED", updatedAt: current.updatedAt.toISOString() });
    expect(unconfirmedClose.status).toBe(400);

    const confirmedClose = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/status`)
      .set("Cookie", staffCookie)
      .send({ status: "CLOSED", confirm: true, updatedAt: current.updatedAt.toISOString() });
    expect(confirmedClose.status).toBe(200);
    expect(confirmedClose.body.currentStatus).toBe("CLOSED");
  });

  it("rejects stale concurrent mutations and leaves the winner intact", async () => {
    await resetTicket();
    const version = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } });
    const updatedAt = version.updatedAt.toISOString();
    const [priority, owner] = await Promise.all([
      request(app)
        .patch(`/api/staff/tickets/${ticketId}/it-priority`)
        .set("Cookie", staffCookie)
        .send({ itPriority: "HIGH", updatedAt }),
      request(app)
        .patch(`/api/staff/tickets/${ticketId}/owner`)
        .set("Cookie", administratorCookie)
        .send({ ownerId: administratorId, updatedAt }),
    ]);

    expect([priority.status, owner.status].sort()).toEqual([200, 409]);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { ownerId: true, itPriority: true } });
    if (priority.status === 200) expect(stored.itPriority).toBe("HIGH");
    if (owner.status === 200) expect(stored.ownerId).toBe(administratorId);
  });

  it("returns safe missing and stale responses", async () => {
    await resetTicket();
    const old = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } });
    const refresh = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/it-priority`)
      .set("Cookie", staffCookie)
      .send({ itPriority: "HIGH", updatedAt: old.updatedAt.toISOString() });
    expect(refresh.status).toBe(200);

    const stale = await request(app)
      .patch(`/api/staff/tickets/${ticketId}/it-priority`)
      .set("Cookie", staffCookie)
      .send({ itPriority: "LOW", updatedAt: old.updatedAt.toISOString() });
    expect(stale.status).toBe(409);

    const missing = await request(app)
      .patch("/api/staff/tickets/2147483000/owner")
      .set("Cookie", staffCookie)
      .send({ ownerId: null, updatedAt: old.updatedAt.toISOString() });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "Resource not found" });
  });
});

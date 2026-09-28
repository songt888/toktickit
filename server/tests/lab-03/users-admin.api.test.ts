import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { wouldRemoveLastActiveAdministrator } from "../../src/adminUserRules.js";
import { getPrisma } from "../../src/prisma.js";
import { verifyPassword } from "../../src/password.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "./testSession.js";

const prisma = getPrisma();
const createdIds: number[] = [];
const prefix = `lab3-issue9-${Date.now()}`;

describe("Administrator user management API", () => {
  let adminId: number;
  let requesterId: number;
  let targetAdminId: number;
  let adminCookie: string;
  let requesterCookie: string;
  let staffCookie: string;

  beforeAll(async () => {
    const [admin, requester, targetAdmin, staff] = await Promise.all([
      createTestUser(`${prefix}-admin@example.test`, "ADMINISTRATOR"),
      createTestUser(`${prefix}-requester@example.test`, "REQUESTER"),
      createTestUser(`${prefix}-target@example.test`, "ADMINISTRATOR"),
      createTestUser(`${prefix}-staff@example.test`, "IT_STAFF"),
    ]);
    adminId = admin.id;
    requesterId = requester.id;
    targetAdminId = targetAdmin.id;
    createdIds.push(admin.id, requester.id, targetAdmin.id, staff.id);
    [adminCookie, requesterCookie, staffCookie] = await Promise.all([
      sessionCookieFor(admin.id),
      sessionCookieFor(requester.id),
      sessionCookieFor(staff.id),
    ]);
  });

  afterAll(async () => {
    const created = await prisma.user.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true },
    });
    await removeTestUsers([...new Set([...createdIds, ...created.map(({ id }) => id)])]);
    await prisma.$disconnect();
  });

  it("requires Administrator role and returns only safe, stable user data", async () => {
    const [anonymous, requester, staff, listed] = await Promise.all([
      request(app).get("/api/admin/users"),
      request(app).get("/api/admin/users").set("Cookie", requesterCookie),
      request(app).get("/api/admin/users").set("Cookie", staffCookie),
      request(app).get(`/api/admin/users?search=${prefix.toUpperCase()}&role=ADMINISTRATOR`).set("Cookie", adminCookie),
    ]);
    expect(anonymous.status).toBe(401);
    expect(requester.status).toBe(403);
    expect(staff.status).toBe(403);
    expect(listed.status).toBe(200);
    expect(listed.body.map(({ id }: { id: number }) => id)).toEqual(
      [...listed.body.map(({ id }: { id: number }) => id)].sort((a: number, b: number) => {
        const aUser = listed.body.find((user: { id: number }) => user.id === a);
        const bUser = listed.body.find((user: { id: number }) => user.id === b);
        return aUser.name.localeCompare(bUser.name) || a - b;
      }),
    );
    expect(listed.body.map(({ id }: { id: number }) => id)).toContain(adminId);
    expect(listed.body.map(({ id }: { id: number }) => id)).toContain(targetAdminId);
    expect(listed.body.every((user: object) =>
      !("passwordHash" in user) && !("password" in user) && !("sessions" in user),
    )).toBe(true);

    const requesterFilter = await request(app)
      .get(`/api/admin/users?role=REQUESTER&search=${prefix}`)
      .set("Cookie", adminCookie);
    expect(requesterFilter.status).toBe(200);
    expect(requesterFilter.body.map(({ id }: { id: number }) => id)).toEqual([requesterId]);
  });

  it("rejects invalid filters and treats wildcard characters as literal search text", async () => {
    const invalidRole = await request(app).get("/api/admin/users?role=ROOT").set("Cookie", adminCookie);
    const wildcard = await request(app).get("/api/admin/users?search=%25%25%25").set("Cookie", adminCookie);
    const longSearch = await request(app).get(`/api/admin/users?search=${"x".repeat(101)}`).set("Cookie", adminCookie);
    expect(invalidRole.status).toBe(400);
    expect(wildcard.status).toBe(200);
    expect(wildcard.body).toEqual([]);
    expect(longSearch.status).toBe(400);
  });

  it("creates normalized users with a hashed initial password and rejects duplicate email", async () => {
    const created = await request(app)
      .post("/api/admin/users")
      .set("Cookie", adminCookie)
      .send({
        name: "  New Test User  ",
        email: `  ${prefix}-new-user@Example.Test `,
        role: "REQUESTER",
        isActive: true,
        initialPassword: "InitialPassword123",
      });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      user: expect.objectContaining({ name: "New Test User", email: `${prefix}-new-user@example.test`, role: "REQUESTER", isActive: true }),
      mustChangePassword: true,
    });
    expect(created.body.user).not.toHaveProperty("passwordHash");
    const stored = await prisma.user.findUnique({ where: { id: created.body.user.id } });
    expect(stored?.passwordHash).not.toBe("InitialPassword123");
    expect(verifyPassword("InitialPassword123", stored!.passwordHash)).toBe(true);

    const duplicate = await request(app)
      .post("/api/admin/users")
      .set("Cookie", adminCookie)
      .send({ name: "Duplicate", email: ` ${prefix.toUpperCase()}-NEW-USER@example.test`, role: "REQUESTER", isActive: true, initialPassword: "InitialPassword123" });
    expect(duplicate.status).toBe(409);
  });

  it("validates create and edit values, normalizes email, and prevents duplicate email", async () => {
    const invalidCreate = await request(app)
      .post("/api/admin/users")
      .set("Cookie", adminCookie)
      .send({ name: "", email: "bad", role: "ROOT", isActive: "yes", initialPassword: "weak" });
    expect(invalidCreate.status).toBe(400);
    expect(invalidCreate.body.fieldErrors).toEqual(expect.objectContaining({ name: expect.any(String), email: expect.any(String), role: expect.any(String), isActive: expect.any(String), initialPassword: expect.any(String) }));

    const duplicateEmail = await request(app)
      .patch(`/api/admin/users/${targetAdminId}`)
      .set("Cookie", adminCookie)
      .send({ email: `${prefix}-requester@example.test` });
    expect(duplicateEmail.status).toBe(409);

    const update = await request(app)
      .patch(`/api/admin/users/${targetAdminId}`)
      .set("Cookie", adminCookie)
      .send({ name: "Renamed Admin", email: `  ${prefix}-renamed@example.test `, role: "IT_STAFF", isActive: false });
    expect(update.status).toBe(200);
    expect(update.body).toEqual({ id: targetAdminId, name: "Renamed Admin", email: `${prefix}-renamed@example.test`, role: "IT_STAFF", isActive: false });
    expect(update.body).not.toHaveProperty("passwordHash");

    const invalidId = await request(app)
      .patch("/api/admin/users/2147483648")
      .set("Cookie", adminCookie)
      .send({ isActive: false });
    expect(invalidId.status).toBe(404);
  });

  it("resets a user's password without returning it and requires a change at next login", async () => {
    const reset = await request(app)
      .post(`/api/admin/users/${requesterId}/initial-password`)
      .set("Cookie", adminCookie)
      .send({ initialPassword: "NextLoginPassword123" });
    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({
      user: expect.objectContaining({ id: requesterId, email: `${prefix}-requester@example.test` }),
      mustChangePassword: true,
    });
    expect(JSON.stringify(reset.body)).not.toContain("NextLoginPassword123");
    const stored = await prisma.user.findUnique({ where: { id: requesterId } });
    expect(stored?.mustChangePassword).toBe(true);
    expect(verifyPassword("NextLoginPassword123", stored!.passwordHash)).toBe(true);
  });

  it("rejects self-deactivation and evaluates the last-active-Administrator rule", async () => {
    const self = await request(app)
      .patch(`/api/admin/users/${adminId}`)
      .set("Cookie", adminCookie)
      .send({ isActive: false });
    expect(self.status).toBe(409);
    expect((await prisma.user.findUnique({ where: { id: adminId } }))?.isActive).toBe(true);

    const currentAdmin = { role: "ADMINISTRATOR", isActive: true };
    expect(wouldRemoveLastActiveAdministrator(currentAdmin, { isActive: false }, 1)).toBe(true);
    expect(wouldRemoveLastActiveAdministrator(currentAdmin, { role: "IT_STAFF" }, 1)).toBe(true);
    expect(wouldRemoveLastActiveAdministrator(currentAdmin, { role: "REQUESTER" }, 2)).toBe(false);
    expect(wouldRemoveLastActiveAdministrator(currentAdmin, { role: "ADMINISTRATOR" }, 1)).toBe(false);
    expect(wouldRemoveLastActiveAdministrator({ role: "IT_STAFF", isActive: true }, { isActive: false }, 1)).toBe(false);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { app } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";

const prisma = getPrisma();
const password = "AuthTestPassword123";
const replacementPassword = "ReplacementPassword456";
const activeEmail = "lab3-auth-test@example.com";
const inactiveEmail = "lab3-auth-inactive@example.com";
let activeUserId: number;
let inactiveUserId: number;

describe("Lab 3 authentication API", () => {
  beforeAll(async () => {
    const activeUser = await prisma.user.upsert({
      where: { email: activeEmail },
      update: {
        name: "Lab 3 Auth Test",
        passwordHash: hashPassword(password),
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: true,
        passwordChangedAt: null,
      },
      create: {
        name: "Lab 3 Auth Test",
        email: activeEmail,
        passwordHash: hashPassword(password),
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: true,
      },
    });
    const inactiveUser = await prisma.user.upsert({
      where: { email: inactiveEmail },
      update: {
        name: "Lab 3 Inactive Auth Test",
        passwordHash: hashPassword(password),
        role: "IT_STAFF",
        isActive: false,
        mustChangePassword: false,
      },
      create: {
        name: "Lab 3 Inactive Auth Test",
        email: inactiveEmail,
        passwordHash: hashPassword(password),
        role: "IT_STAFF",
        isActive: false,
        mustChangePassword: false,
      },
    });
    activeUserId = activeUser.id;
    inactiveUserId = inactiveUser.id;
  });

  afterAll(async () => {
    await prisma.authSession.deleteMany({ where: { userId: { in: [activeUserId, inactiveUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [activeUserId, inactiveUserId] } } });
  });

  it("validates input and returns the same safe failure for invalid or inactive accounts", async () => {
    const malformed = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "" });
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({
      error: "Validation failed",
      fieldErrors: {
        email: "Enter a valid email address.",
        password: "Password is required.",
      },
    });

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: activeEmail, password: "WrongPassword123" });
    const inactive = await request(app)
      .post("/api/auth/login")
      .send({ email: inactiveEmail, password });

    expect(wrongPassword.status).toBe(401);
    expect(inactive.status).toBe(401);
    expect(wrongPassword.body).toEqual({ error: "Invalid email or password" });
    expect(inactive.body).toEqual(wrongPassword.body);
  });

  it("creates a safe session, exposes current user, changes the initial password, and logs out", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .send({ email: activeEmail, password });

    expect(login.status).toBe(200);
    expect(login.body).toEqual({
      user: {
        id: activeUserId,
        name: "Lab 3 Auth Test",
        email: activeEmail,
        role: "IT_STAFF",
        isActive: true,
        mustChangePassword: true,
      },
      requiresPasswordChange: true,
    });
    expect(login.body).not.toHaveProperty("user.passwordHash");
    expect(login.headers["set-cookie"][0]).toMatch(/toktickit_session=/);
    expect(login.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(login.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
    expect(login.headers["set-cookie"][0]).toMatch(/Path=\//);

    const meBeforeChange = await agent.get("/api/auth/me");
    expect(meBeforeChange.status).toBe(200);
    expect(meBeforeChange.body.requiresPasswordChange).toBe(true);

    const blockedApplication = await agent.get("/api/categories");
    expect(blockedApplication.status).toBe(403);
    expect(blockedApplication.body).toEqual({ error: "Password change required" });

    const invalidChange = await agent
      .post("/api/auth/change-password")
      .send({
        currentPassword: "WrongPassword123",
        newPassword: replacementPassword,
        confirmPassword: replacementPassword,
      });
    expect(invalidChange.status).toBe(400);
    expect(invalidChange.body).toEqual({ error: "Current password is incorrect" });

    const changed = await agent
      .post("/api/auth/change-password")
      .send({
        currentPassword: password,
        newPassword: replacementPassword,
        confirmPassword: replacementPassword,
      });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(changed.body.requiresPasswordChange).toBe(false);
    expect(changed.body.user).not.toHaveProperty("passwordHash");

    const meAfterChange = await agent.get("/api/auth/me");
    expect(meAfterChange.status).toBe(200);
    expect(meAfterChange.body.requiresPasswordChange).toBe(false);

    const availableApplication = await agent.get("/api/categories");
    expect(availableApplication.status).toBe(200);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(204);
    expect(logout.headers["set-cookie"][0]).toMatch(/Max-Age=0/);

    const afterLogout = await agent.get("/api/auth/me");
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body).toEqual({ error: "Authentication required" });
  });

  it("rejects credentialed state-changing requests from an unknown origin", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", "https://malicious.example")
      .send({ email: activeEmail, password });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Request origin is not allowed" });
  });
});

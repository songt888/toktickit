import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "../lab-03/testSession.js";

let authCookie = "";
let testUserId: number;

describe("GET /api/requesters", () => {
  beforeAll(async () => {
    const user = await createTestUser("lab3-issue4-requesters@example.test");
    testUserId = user.id;
    authCookie = await sessionCookieFor(user.id);
  });

  afterAll(async () => {
    await removeTestUsers([testUserId]);
    await getPrisma().$disconnect();
  });

  it("returns only the authenticated requester for compatibility", async () => {
    const res = await request(app)
      .get("/api/requesters?active=true")
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: testUserId, name: "Issue 4 REQUESTER fixture", email: "lab3-issue4-requesters@example.test" }]);
  });
});

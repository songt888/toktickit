import { afterAll, beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { createTestUser, removeTestUsers, sessionCookieFor } from "../lab-03/testSession.js";

let authCookie = "";
let testUserId: number;

// Issue 4 — write this test yourself, using health.test.ts as the pattern.
// Requires the DB to be migrated and seeded first.
// It should assert: GET /api/categories returns 200 and the four seeded
// category names in id order.
describe("GET /api/categories", () => {
  beforeAll(async () => {
    const user = await createTestUser("lab3-issue4-categories@example.test");
    testUserId = user.id;
    authCookie = await sessionCookieFor(user.id);
  });

  afterAll(async () => {
    await removeTestUsers([testUserId]);
    await getPrisma().$disconnect();
  });

  it("returns the four seeded categories in id order", async () => {
    const res = await request(app).get("/api/categories").set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
      { id: 4, name: "Network" },
    ]);
  });
});

import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("GET /api/requesters", () => {
  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("returns active requesters in id order without inactive users", async () => {
    const expected = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" },
    });
    const res = await request(app).get("/api/requesters?active=true");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expected);
    expect(res.body).toHaveLength(4);
    expect(res.body.map(({ id }: { id: number }) => id)).toEqual(
      [...res.body.map(({ id }: { id: number }) => id)].sort((a, b) => a - b),
    );
    expect(res.body.some(({ name }: { name: string }) => name === "Ploy Inactive")).toBe(false);
  });
});

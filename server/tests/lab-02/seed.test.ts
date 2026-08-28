import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { requesterSeeds, relatedSystemNames, seedLab2Data } from "../../prisma/seed.js";
import { categoryNames } from "../../src/categorySeed.js";

const prisma = getPrisma();

describe("Lab 2 seed", () => {
  beforeAll(async () => {
    await seedLab2Data(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds the required reference data and active/inactive requester split", async () => {
    const [categories, systems, requesters] = await Promise.all([
      prisma.category.findMany({ orderBy: { id: "asc" } }),
      prisma.relatedSystem.findMany({ orderBy: { id: "asc" } }),
      prisma.requesterUser.findMany({ orderBy: { id: "asc" } }),
    ]);

    expect(categories.map(({ name }) => name)).toEqual(categoryNames);
    expect(systems.map(({ name }) => name)).toEqual(relatedSystemNames);
    expect(requesters.map(({ email }) => email)).toEqual(
      requesterSeeds.map(({ email }) => email),
    );
    expect(requesters.filter(({ isActive }) => isActive)).toHaveLength(4);
    expect(requesters.filter(({ isActive }) => !isActive)).toHaveLength(1);
  });

  it("is safe to run repeatedly without creating duplicates", async () => {
    await seedLab2Data(prisma);
    await seedLab2Data(prisma);

    expect(await prisma.category.count()).toBe(categoryNames.length);
    expect(await prisma.relatedSystem.count()).toBe(relatedSystemNames.length);
    expect(await prisma.requesterUser.count()).toBe(requesterSeeds.length);
  });
});

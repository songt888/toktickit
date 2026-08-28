import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import {
  inactiveRelatedSystemNames,
  requesterSeeds,
  relatedSystemNames,
  seedLab2Data,
} from "../../prisma/seed.js";
import { categoryNames, inactiveCategoryNames } from "../../src/categorySeed.js";

const prisma = getPrisma();

describe("Lab 2 seed", () => {
  beforeAll(async () => {
    await seedLab2Data(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds the required reference data and active/inactive reference split", async () => {
    const [categories, systems, requesters] = await Promise.all([
      prisma.category.findMany({ orderBy: { id: "asc" } }),
      prisma.relatedSystem.findMany({ orderBy: { id: "asc" } }),
      prisma.requesterUser.findMany({ orderBy: { id: "asc" } }),
    ]);

    expect(categories.filter(({ isActive }) => isActive).map(({ name }) => name)).toEqual(
      categoryNames,
    );
    expect(categories.filter(({ isActive }) => !isActive).map(({ name }) => name)).toEqual(
      inactiveCategoryNames,
    );
    expect(systems.filter(({ isActive }) => isActive).map(({ name }) => name)).toEqual(
      relatedSystemNames,
    );
    expect(systems.filter(({ isActive }) => !isActive).map(({ name }) => name)).toEqual(
      inactiveRelatedSystemNames,
    );
    expect(requesters.map(({ email }) => email)).toEqual(
      requesterSeeds.map(({ email }) => email),
    );
    expect(requesters.filter(({ isActive }) => isActive)).toHaveLength(4);
    expect(requesters.filter(({ isActive }) => !isActive)).toHaveLength(1);
  });

  it("is safe to run repeatedly without creating duplicates", async () => {
    await seedLab2Data(prisma);
    await seedLab2Data(prisma);

    expect(await prisma.category.count()).toBe(
      categoryNames.length + inactiveCategoryNames.length,
    );
    expect(await prisma.relatedSystem.count()).toBe(
      relatedSystemNames.length + inactiveRelatedSystemNames.length,
    );
    expect(await prisma.requesterUser.count()).toBe(requesterSeeds.length);
  });
});

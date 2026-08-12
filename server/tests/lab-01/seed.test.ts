import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { categoryNames, seedCategories } from "../../src/categorySeed.js";

describe("category seed", () => {
  it("is safe to run twice without creating duplicates", async () => {
    const records = new Map<string, { id: number; name: string }>();
    const upsert = vi.fn(async ({
      where,
      create,
    }: {
      where: { name: string };
      create: { name: string };
    }) => {
      if (!records.has(where.name)) {
        records.set(where.name, { id: records.size + 1, name: create.name });
      }

      return records.get(where.name);
    });

    const prisma = {
      category: { upsert },
    } as unknown as Pick<PrismaClient, "category">;

    await seedCategories(prisma);
    await seedCategories(prisma);

    expect([...records.values()].map((record) => record.name)).toEqual(categoryNames);
    expect(records.size).toBe(categoryNames.length);
    expect(upsert).toHaveBeenCalledTimes(categoryNames.length * 2);
  });
});

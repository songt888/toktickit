import type { PrismaClient } from "@prisma/client";

export const categoryNames = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
] as const;

export async function seedCategories(prisma: Pick<PrismaClient, "category">) {
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

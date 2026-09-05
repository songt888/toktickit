import type { PrismaClient } from "@prisma/client";

export const categoryNames = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
] as const;

export const inactiveCategoryNames = ["Legacy Requests"] as const;

export async function seedCategories(prisma: Pick<PrismaClient, "category">) {
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }
}

export async function seedInactiveCategories(
  prisma: Pick<PrismaClient, "category">,
) {
  for (const name of inactiveCategoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: false },
      create: { name, isActive: false },
    });
  }
}

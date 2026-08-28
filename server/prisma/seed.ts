import type { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import { getPrisma } from "../src/prisma.js";
import { categoryNames, seedCategories } from "../src/categorySeed.js";

export const relatedSystemNames = [
  "Email and Collaboration",
  "Network and Internet",
  "Laptop and Desktop",
  "Printer and Peripheral",
  "Business Application",
  "Identity and Access",
] as const;

export const requesterSeeds = [
  { name: "Ari Suksan", email: "ari.suksan@example.com", isActive: true },
  { name: "Ben Chaiyo", email: "ben.chaiyo@example.com", isActive: true },
  { name: "Mali Prasert", email: "mali.prasert@example.com", isActive: true },
  { name: "Narin Wattan", email: "narin.wattan@example.com", isActive: true },
  { name: "Ploy Inactive", email: "ploy.inactive@example.com", isActive: false },
] as const;

// Lab 2 seed data is deterministic and safe to run repeatedly.
// Every reference record uses a natural unique key in its upsert.
export async function seedLab2Data(
  prisma: Pick<PrismaClient, "category" | "relatedSystem" | "requesterUser">,
) {
  await seedCategories(prisma);

  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const requester of requesterSeeds) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: requester,
    });
  }

  console.log(
    `Seeded ${categoryNames.length} categories, ${relatedSystemNames.length} related systems, and ${requesterSeeds.length} requesters.`,
  );
}

async function main() {
  await seedLab2Data(getPrisma());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await getPrisma().$disconnect();
    });
}

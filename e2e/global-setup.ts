import { execFileSync } from "node:child_process";
import path from "node:path";
import { getPrisma } from "../server/src/prisma.js";
import { hashPassword } from "../server/src/password.js";

const e2eStaffEmail = "e2e.staff@example.com";
const e2eStaffPassword = "E2EStaffPassword123";
const e2eRequesterAEmail = "e2e.requester.a@example.com";
const e2eRequesterBEmail = "e2e.requester.b@example.com";
const e2eRequesterPassword = "E2ERequesterPassword123";

type E2ERole = "REQUESTER" | "IT_STAFF";

async function upsertE2EUser(
  prisma: ReturnType<typeof getPrisma>,
  input: { email: string; name: string; role: E2ERole; password: string },
): Promise<void> {
  const passwordHash = hashPassword(input.password);
  await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      role: input.role,
      isActive: true,
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
    create: {
      name: input.name,
      email: input.email,
      role: input.role,
      isActive: true,
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });
}

export default async function globalSetup(): Promise<void> {
  execFileSync("npm", ["run", "prisma:seed"], {
    cwd: path.resolve("server"),
    stdio: "inherit",
  });

  const prisma = getPrisma();
  try {
    await upsertE2EUser(prisma, {
      email: e2eStaffEmail,
      name: "E2E Staff User",
      role: "IT_STAFF",
      password: e2eStaffPassword,
    });
    await upsertE2EUser(prisma, {
      email: e2eRequesterAEmail,
      name: "E2E Requester A",
      role: "REQUESTER",
      password: e2eRequesterPassword,
    });
    await upsertE2EUser(prisma, {
      email: e2eRequesterBEmail,
      name: "E2E Requester B",
      role: "REQUESTER",
      password: e2eRequesterPassword,
    });
  } finally {
    await prisma.$disconnect();
  }
}

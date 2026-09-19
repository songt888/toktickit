import type { Response } from "express";
import type { UserRole } from "@prisma/client";
import { createSession } from "../../src/auth.js";
import { MIGRATION_PLACEHOLDER_HASH } from "../../src/password.js";
import { getPrisma } from "../../src/prisma.js";

export async function createTestUser(
  email: string,
  role: UserRole = "REQUESTER",
) {
  return getPrisma().user.upsert({
    where: { email },
    update: {
      name: `Issue 4 ${role} fixture`,
      role,
      isActive: true,
      passwordHash: MIGRATION_PLACEHOLDER_HASH,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
    create: {
      name: `Issue 4 ${role} fixture`,
      email,
      role,
      isActive: true,
      passwordHash: MIGRATION_PLACEHOLDER_HASH,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });
}

export async function sessionCookieFor(userId: number): Promise<string> {
  let cookieHeader = "";
  const response = {
    setHeader(_name: string, value: string | string[]) {
      cookieHeader = Array.isArray(value) ? value[0] : value;
    },
  } as unknown as Response;

  await createSession(getPrisma(), userId, response);
  if (!cookieHeader) throw new Error("Session cookie was not created");
  return cookieHeader.split(";")[0];
}

export async function removeTestUsers(userIds: number[]): Promise<void> {
  await getPrisma().authSession.deleteMany({ where: { userId: { in: userIds } } });
  await getPrisma().user.deleteMany({ where: { id: { in: userIds } } });
}

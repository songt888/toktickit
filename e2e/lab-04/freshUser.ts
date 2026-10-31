import { randomUUID } from "node:crypto";
import { getPrisma } from "../../server/src/prisma.js";
import { hashPassword } from "../../server/src/password.js";

// A new active account per test, so specs never share (or change) the seeded E2E accounts.
export async function freshUser(label: string, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR") {
  const tag = randomUUID().slice(0, 8);
  const email = `e2e.${label}.${tag}@example.com`;
  const password = "E2EFreshPassword123";
  const user = await getPrisma().user.create({
    data: { name: `E2E ${label} ${tag}`, email, role, isActive: true, passwordHash: hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date() },
  });
  return { id: user.id, name: user.name, email, password };
}

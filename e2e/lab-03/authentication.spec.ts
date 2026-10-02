import { expect, test } from "@playwright/test";
import { getPrisma } from "../../server/src/prisma.js";
import { hashPassword } from "../../server/src/password.js";
import path from "node:path";

const initialPassword = "InitialE2EPassword123";
const nextPassword = "ChangedE2EPassword123";
const apiBaseURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const prisma = getPrisma();

test("requires an initial password change and revokes the session on logout", async ({ page, request }, testInfo) => {
  const email = `e2e.first-login.${testInfo.project.name}@example.test`;
  const passwordHash = hashPassword(initialPassword);
  await prisma.authSession.deleteMany({ where: { user: { email } } });
  await prisma.user.upsert({
    where: { email },
    update: {
      name: "E2E First Login User",
      role: "REQUESTER",
      isActive: true,
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: null,
    },
    create: {
      name: "E2E First Login User",
      email,
      role: "REQUESTER",
      isActive: true,
      passwordHash,
      mustChangePassword: true,
    },
  });

  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.screenshot({
      path: path.resolve(`artifacts/lab-03/screenshots/${testInfo.project.name}-login.png`),
      fullPage: true,
    });

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("alert")).toHaveText("Unable to sign in. Check your details and try again.");

    await page.getByLabel("Password").fill(initialPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await page.screenshot({
      path: path.resolve(`artifacts/lab-03/screenshots/${testInfo.project.name}-change-password.png`),
      fullPage: true,
    });

    const blockedRequest = await request.get(`${apiBaseURL}/api/tickets`, {
      headers: { Cookie: (await page.context().cookies()).map(({ name, value }) => `${name}=${value}`).join("; ") },
    });
    expect(blockedRequest.status()).toBe(403);

    await page.getByLabel("Current password").fill(initialPassword);
    await page.getByLabel("New password", { exact: true }).fill(nextPassword);
    await page.getByLabel("Confirm new password").fill(nextPassword);
    const passwordResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/change-password") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Continue" }).click();
    expect((await passwordResponsePromise).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

    const session = (await page.context().cookies()).find(({ name }) => name === "toktickit_session");
    if (!session) throw new Error("Authenticated session cookie was not set");
    const logoutPromise = page.waitForResponse((response) => response.url().endsWith("/api/auth/logout"));
    await page.getByRole("button", { name: "Logout" }).click();
    expect((await logoutPromise).status()).toBe(204);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    const replayedSession = await request.get(`${apiBaseURL}/api/auth/me`, {
      headers: { Cookie: `${session.name}=${session.value}` },
    });
    expect(replayedSession.status()).toBe(401);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(nextPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await prisma.authSession.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

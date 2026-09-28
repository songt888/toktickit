import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { getPrisma } from "../../server/src/prisma.js";

const adminEmail = "e2e.admin@example.com";
const adminPassword = "E2EAdminPassword123";
const prisma = getPrisma();

async function cleanIssue42Users() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: "e2e.issue42." } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  if (userIds.length === 0) return;
  await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

test.beforeAll(cleanIssue42Users);
test.afterAll(async () => {
  await cleanIssue42Users();
  await prisma.$disconnect();
});

async function expectNoHorizontalOverflow(page: Page) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

test("Administrator can manage users, reset an initial password, and use the responsive screen", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
  await expect(page.getByRole("link", { name: "User Management" })).toHaveAttribute("aria-current", "page");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.resolve("artifacts/lab-03/screenshots/admin-user-management-desktop.png"), fullPage: true });

  const unique = Date.now();
  const email = `e2e.issue42.${unique}@example.test`;
  const initialPassword = "InitialPassword123";
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Issue 42 E2E User");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Initial password").fill(initialPassword);
  const createResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/admin/users") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save user" }).click();
  expect((await createResponse).status()).toBe(201);
  await expect(page.getByText("User created. They must change the initial password at next sign-in.")).toBeVisible();

  await page.getByLabel("Search name or email").fill(email);
  await page.getByLabel("Filter by role").selectOption("REQUESTER");
  const listResponse = page.waitForResponse((response) =>
    response.url().includes("/api/admin/users?") && response.request().method() === "GET" && response.status() === 200,
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  await listResponse;
  const userCard = page.locator("article").filter({ hasText: email });
  await expect(userCard.getByText("Issue 42 E2E User")).toBeVisible();
  await userCard.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Issue 42 Updated User");
  await page.getByLabel("Role", { exact: true }).selectOption("IT_STAFF");
  const updateResponse = page.waitForResponse((response) =>
    response.url().includes("/api/admin/users/") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save user" }).click();
  expect((await updateResponse).status()).toBe(200);
  await page.getByLabel("Filter by role").selectOption("IT_STAFF");
  const updatedListResponse = page.waitForResponse((response) =>
    response.url().includes("/api/admin/users?") && response.request().method() === "GET" && response.status() === 200,
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  await updatedListResponse;
  await expect(page.locator("article").filter({ hasText: email }).getByText("Issue 42 Updated User")).toBeVisible();

  const updatedCard = page.locator("article").filter({ hasText: email });
  await updatedCard.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Active account").uncheck();
  await expect(page.getByRole("button", { name: "Save user" })).toBeDisabled();
  await page.getByLabel("I understand and want to continue.").check();
  const deactivateResponse = page.waitForResponse((response) =>
    response.url().includes("/api/admin/users/") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save user" }).click();
  expect((await deactivateResponse).status()).toBe(200);
  await expect(updatedCard.getByText("Inactive", { exact: true })).toBeVisible();

  await updatedCard.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Active account").check();
  const activateResponse = page.waitForResponse((response) =>
    response.url().includes("/api/admin/users/") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save user" }).click();
  expect((await activateResponse).status()).toBe(200);
  await expect(updatedCard.getByText("Active", { exact: true })).toBeVisible();

  await updatedCard.getByRole("button", { name: "Set New Initial Password" }).click();
  await page.getByLabel("New initial password").fill("ResetPassword123");
  const resetResponse = page.waitForResponse((response) =>
    response.url().endsWith("/initial-password") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Set password" }).click();
  expect((await resetResponse).status()).toBe(200);
  await expect(page.getByText(`Initial password set for Issue 42 Updated User; it must be changed at next sign-in.`)).toBeVisible();

  for (const viewport of [
    { name: "tablet", width: 820, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();
    await page.screenshot({
      path: path.resolve(`artifacts/lab-03/screenshots/${viewport.name}-admin-user-management.png`),
      fullPage: true,
    });
  }

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  const loginEmail = page.getByLabel("Email", { exact: true });
  await loginEmail.fill(email);
  await expect(loginEmail).toHaveValue(email);
  await page.getByLabel("Password").fill("ResetPassword123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
});

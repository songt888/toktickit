import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const requesterPassword = "E2ERequesterPassword123";
const staffPassword = "E2EStaffPassword123";
const adminPassword = "E2EAdminPassword123";

async function signIn(page: Page, email: string, password: string, heading: string) {
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(Math.max(widths.document, widths.body)).toBeLessThanOrEqual(widths.viewport + 1);
}

async function capture(page: Page, testName: string, screen: string) {
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.resolve(`artifacts/lab-03/screenshots/${testName}-${screen}.png`),
    fullPage: true,
  });
}

test("checks the requester, Staff, and Administrator screens at this viewport", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const label = testInfo.project.name;
  const viewport = label === "responsive" ? "desktop" : label;
  await page.goto("/");
  await expect(page.getByLabel("Email")).toBeVisible();
  await capture(page, viewport, "login");

  await signIn(page, "e2e.requester.a@example.com", requesterPassword, "My Tickets");
  await capture(page, viewport, "requester-my-tickets");
  await page.getByRole("link", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await expect(page.locator("#ticket-category")).toBeVisible();
  await expect(page.getByLabel("Description")).toBeVisible();
  await capture(page, viewport, "requester-create-ticket");

  await page.locator("#ticket-category").selectOption({ label: "Network" });
  await page.locator("#ticket-related-system").selectOption({ label: "Network and Internet" });
  const summary = `Responsive ${viewport} ${Date.now()}`;
  await page.getByLabel("Summary").fill(summary);
  await page.getByLabel("Description").fill("Ticket fixture for responsive screen verification.");
  await page.locator("#ticket-priority").selectOption("MEDIUM");
  const createPromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/tickets") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create Ticket" }).click();
  expect((await createPromise).status()).toBe(201);

  await page.getByRole("link", { name: "My Tickets" }).click();
  const requesterRow = page.locator("tr:visible, article:visible").filter({ hasText: summary }).first();
  await expect(requesterRow).toBeVisible();
  await capture(page, viewport, "requester-filtered-tickets");
  await requesterRow.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await capture(page, viewport, "requester-ticket-detail");

  await page.getByRole("button", { name: "Logout" }).click();
  await signIn(page, "e2e.staff@example.com", staffPassword, "Ticket Queue");
  await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
  await page.getByLabel("Search Queue").fill(summary);
  const queuePromise = page.waitForResponse((response) =>
    response.url().includes("/api/staff/tickets?") && response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  expect((await queuePromise).status()).toBe(200);
  const queueRow = page.locator('tr:visible, article[aria-label^="Ticket "]:visible').filter({ hasText: summary }).first();
  await expect(queueRow).toBeVisible();
  await expect(page.getByLabel("Search Queue")).toBeVisible();
  await capture(page, viewport, "staff-ticket-queue");
  await queueRow.getByRole("button", { name: "Open Detail" }).click();
  await expect(page.getByRole("heading", { name: "Operational Ticket Detail" })).toBeVisible();
  await expect(page.locator("#staff-ticket-priority")).toBeVisible();
  await capture(page, viewport, "staff-ticket-detail");

  await page.getByRole("button", { name: "Logout" }).click();
  await signIn(page, "e2e.admin@example.com", adminPassword, "User Management");
  await expect(page.getByRole("link", { name: "User Management" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Search name or email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();
  await page.getByLabel("Search name or email").fill("ari.suksan@example.com");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("ari.suksan@example.com")).toBeVisible();
  await capture(page, viewport, "administrator-user-management");
});

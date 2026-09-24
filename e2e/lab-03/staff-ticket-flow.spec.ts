import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const staffEmail = "e2e.staff@example.com";
const staffPassword = "E2EStaffPassword123";

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function visibleQueueContent(page: Page) {
  const queueContent = page.locator('table:visible, article[aria-label^="Ticket "]:visible').first();
  await expect(queueContent).toBeVisible();
  const table = page.locator("table:visible");
  if (await table.count()) return table;
  return page.locator('article[aria-label^="Ticket "]:visible').first();
}

test("covers the staff queue, operational detail, and responsive layouts", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByLabel("Password").fill(staffPassword);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
  const initialQueue = await visibleQueueContent(page);
  await expect(initialQueue.getByRole("button", { name: "Open Detail" }).first()).toBeVisible();

  const queueResponse = page.waitForResponse((response) =>
    response.url().includes("/api/staff/tickets?") && response.request().method() === "GET" && response.status() === 200,
  );
  await page.getByLabel("Search Queue").fill("Laptop battery");
  await page.getByLabel("Sort by").selectOption("ticketNumber");
  await page.getByLabel("Order").selectOption("asc");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await queueResponse;
  await expect((await visibleQueueContent(page)).getByText("Laptop battery drains quickly")).toBeVisible();
  await expect(page.getByText("No tickets match the current queue filters.")).toHaveCount(0);

  await page.screenshot({
    path: path.resolve(`artifacts/lab-03/screenshots/${testInfo.project.name}-queue-desktop.png`),
    fullPage: true,
  });

  for (const viewport of [
    { name: "tablet", width: 820, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await expect((await visibleQueueContent(page))).toBeVisible();
    await page.screenshot({
      path: path.resolve(`artifacts/lab-03/screenshots/${viewport.name}-staff-queue.png`),
      fullPage: true,
    });
  }

  const visibleList = await visibleQueueContent(page);
  await visibleList.getByRole("button", { name: "Open Detail" }).click();
  const detail = page.locator("#staff-ticket-detail");
  await expect(detail.getByRole("heading", { name: "Operational Ticket Detail" })).toBeVisible();
  await expect(detail.getByText("Laptop battery drains quickly")).toBeVisible();
  await expect(detail.getByText("Requested Priority")).toBeVisible();
  await expect(detail.getByText("IT Priority")).toBeVisible();
  await expect(detail.getByText("Problem Appears Resolved")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.resolve("artifacts/lab-03/screenshots/mobile-staff-ticket-detail.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Back to Ticket Queue" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
});

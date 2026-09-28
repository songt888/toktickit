import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const staffEmail = "e2e.staff@example.com";
const staffPassword = "E2EStaffPassword123";
const workflowSummary = "E2E Issue 44 staff workflow";

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
  const ticketInformation = detail.getByRole("region", { name: "Ticket Information" });
  await expect(ticketInformation.getByText("Requested Priority")).toBeVisible();
  await expect(ticketInformation.getByText("IT Priority")).toBeVisible();
  await expect(ticketInformation.getByText("Problem Appears Resolved")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.resolve("artifacts/lab-03/screenshots/mobile-staff-ticket-detail.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Back to Ticket Queue" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
});

test("claims, reassigns, unassigns, reprioritizes, and changes status with confirmation", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByLabel("Password").fill(staffPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();

  await page.getByLabel("Search Queue").fill(workflowSummary);
  const queueResponse = page.waitForResponse((response) =>
    response.url().includes("/api/staff/tickets?") && response.request().method() === "GET" && response.status() === 200,
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  await queueResponse;

  const row = page.getByRole("row").filter({ hasText: workflowSummary });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Open Detail" }).click();

  const detail = page.locator("#staff-ticket-detail");
  await expect(detail.getByRole("heading", { name: "Operational Ticket Detail" })).toBeVisible();
  await expect(detail.getByText("Unassigned", { exact: true })).toBeVisible();
  await expect(detail.getByText(workflowSummary)).toBeVisible();

  const ownerResponse = () => page.waitForResponse((response) =>
    response.url().includes("/api/staff/tickets/") && response.url().endsWith("/owner") && response.status() === 200,
  );
  let response = ownerResponse();
  await page.getByRole("button", { name: "Claim Ticket" }).click();
  await response;
  await expect(page.getByText("You claimed this Ticket.")).toBeVisible();
  await expect(detail.getByText("E2E Staff User", { exact: true })).toBeVisible();

  await page.getByLabel("Assign to").selectOption({ label: "Nattakit Support — IT_STAFF" });
  response = ownerResponse();
  await page.getByRole("button", { name: "Reassign Ticket" }).click();
  await response;
  await expect(page.getByText("Ticket reassigned.")).toBeVisible();
  await expect(detail.getByText("Nattakit Support", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim Ticket" })).toHaveCount(0);

  response = ownerResponse();
  await page.getByRole("button", { name: "Unassign" }).click();
  await response;
  await expect(page.getByText("Ticket unassigned.")).toBeVisible();
  await expect(detail.getByText("Unassigned", { exact: true })).toBeVisible();

  const priorityResponse = page.waitForResponse((result) =>
    result.url().includes("/api/staff/tickets/") && result.url().endsWith("/it-priority") && result.status() === 200,
  );
  await detail.getByLabel("IT Priority").selectOption("URGENT");
  await page.getByRole("button", { name: "Save IT Priority" }).click();
  await priorityResponse;
  await expect(page.getByText("IT Priority was updated.")).toBeVisible();
  const information = detail.getByRole("region", { name: "Ticket Information" });
  await expect(information.getByText("Requested Priority").locator(".." )).toContainText("HIGH");
  await expect(information.getByText("IT Priority").locator(".." )).toContainText("URGENT");

  const statusResponse = () => page.waitForResponse((result) =>
    result.url().includes("/api/staff/tickets/") && result.url().endsWith("/status"),
  );
  let statusUpdate = statusResponse();
  await detail.getByLabel("Status").selectOption("OPEN");
  await detail.getByRole("button", { name: "Update Status" }).click();
  expect((await statusUpdate).status()).toBe(200);
  await expect(page.getByText("Ticket status was updated to OPEN.")).toBeVisible();

  statusUpdate = statusResponse();
  const confirmDialog = page.waitForEvent("dialog");
  await detail.getByLabel("Status").selectOption("CANCELLED");
  const clickStatusUpdate = detail.getByRole("button", { name: "Update Status" }).click();
  const dialog = await confirmDialog;
  expect(dialog.message()).toContain("CANCELLED");
  await dialog.accept();
  await clickStatusUpdate;
  expect((await statusUpdate).status()).toBe(200);
  await expect(page.getByText("Ticket status was updated to CANCELLED.")).toBeVisible();
  await expect(information.getByText("Requested Priority").locator(".." )).toContainText("HIGH");

  await page.screenshot({
    path: path.resolve("artifacts/lab-03/screenshots/staff-ticket-workflow-desktop.png"),
    fullPage: true,
  });

  for (const viewport of [
    { name: "tablet", width: 820, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectNoHorizontalOverflow(page);
    await expect(detail.getByRole("heading", { name: "Operational Ticket Detail" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Update Status" })).toBeVisible();
    await page.screenshot({
      path: path.resolve(`artifacts/lab-03/screenshots/${viewport.name}-staff-ticket-workflow.png`),
      fullPage: true,
    });
  }
});

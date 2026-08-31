import { expect, test } from "@playwright/test";
import path from "node:path";

const requesterA = "Ari Suksan (ari.suksan@example.com)";

test("keeps the requester shell usable, labelled, keyboard reachable, and free of horizontal overflow", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByLabel("Choose a Development Requester")).toBeVisible();
  await page.getByLabel("Choose a Development Requester").selectOption({ label: requesterA });
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("Current Development Requester")).toContainText("Ari Suksan");
  await page.getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");

  await page.getByLabel("Search Tickets").focus();
  await expect(page.locator("#ticket-search")).toBeFocused();
  await page.getByRole("link", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await expect(page.getByLabel("Category")).toHaveAccessibleName("Category");
  await expect(page.getByLabel("Related System")).toHaveAccessibleName("Related System");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  await page.screenshot({
    path: path.resolve(`artifacts/lab-02/screenshots/${testInfo.project.name}-create-ticket.png`),
    fullPage: true,
  });
});

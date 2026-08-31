import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const requesterA = "Ari Suksan (ari.suksan@example.com)";
const apiBaseURL = "http://127.0.0.1:3000";

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test("keeps the requester shell usable, labelled, keyboard reachable, and free of horizontal overflow", async ({ page, request }, testInfo) => {
  await page.goto("/");
  await expect(page.getByLabel("Choose a Development Requester")).toBeVisible();
  await page.getByLabel("Choose a Development Requester").selectOption({ label: requesterA });
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue" }).click();

  const requestersResponse = await request.get(`${apiBaseURL}/api/requesters?active=true`);
  expect(requestersResponse.status()).toBe(200);
  const requesters = await requestersResponse.json() as Array<{ id: number; name: string }>;
  const ari = requesters.find((requester) => requester.name === "Ari Suksan");
  if (!ari) throw new Error("Ari Suksan was not returned by the active requester API");

  const [categoriesResponse, systemsResponse] = await Promise.all([
    request.get(`${apiBaseURL}/api/categories`),
    request.get(`${apiBaseURL}/api/related-systems`),
  ]);
  expect(categoriesResponse.status()).toBe(200);
  expect(systemsResponse.status()).toBe(200);
  const categories = await categoriesResponse.json() as Array<{ id: number; name: string }>;
  const systems = await systemsResponse.json() as Array<{ id: number; name: string }>;
  const category = categories.find((item) => item.name === "Network");
  const system = systems.find((item) => item.name === "Network and Internet");
  if (!category || !system) throw new Error("Responsive test reference data is missing");

  const summary = `Responsive layout ${testInfo.project.name} ${Date.now()}`;
  const ticketResponse = await request.post(`${apiBaseURL}/api/tickets`, {
    headers: { "X-Requester-Id": String(ari.id) },
    data: {
      categoryId: category.id,
      relatedSystemId: system.id,
      summary,
      description: "Verify the ticket list and detail layouts at this viewport.",
      requestedPriority: "MEDIUM",
    },
  });
  expect(ticketResponse.status()).toBe(201);

  await expect(page.getByLabel("Current Development Requester")).toContainText("Ari Suksan");
  await page.getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
  const visibleTicketList = page.locator(
    '[aria-label="My Tickets list"]:visible, [aria-label="My Tickets cards"]:visible',
  );
  await expect(visibleTicketList).toHaveCount(1);
  await expect(visibleTicketList.getByText(summary)).toBeVisible();

  await page.getByLabel("Search Tickets").focus();
  await expect(page.locator("#ticket-search")).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.resolve(`artifacts/lab-02/screenshots/${testInfo.project.name}-my-tickets.png`),
    fullPage: true,
  });

  await visibleTicketList.getByText(summary).locator("..")
    .getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.resolve(`artifacts/lab-02/screenshots/${testInfo.project.name}-ticket-detail.png`),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Back to My Tickets" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByRole("link", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await expect(page.getByLabel("Category")).toHaveAccessibleName("Category");
  await expect(page.getByLabel("Related System")).toHaveAccessibleName("Related System");

  await expectNoHorizontalOverflow(page);

  await page.screenshot({
    path: path.resolve(`artifacts/lab-02/screenshots/${testInfo.project.name}-create-ticket.png`),
    fullPage: true,
  });
});

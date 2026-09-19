import { expect, test, type Page } from "@playwright/test";

const requesterEmail = "e2e.requester.a@example.com";
const requesterPassword = "E2ERequesterPassword123";
const apiBaseURL = "http://127.0.0.1:3000";

async function signIn(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(requesterEmail);
  await page.getByLabel("Password").fill(requesterPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
}

async function cookieHeader(page: Page): Promise<string> {
  const state = await page.context().storageState();
  return state.cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test("keeps the authenticated requester shell usable and free of horizontal overflow", async ({ page, request }, testInfo) => {
  await signIn(page);

  const sessionCookie = await cookieHeader(page);
  const [categoriesResponse, systemsResponse] = await Promise.all([
    request.get(`${apiBaseURL}/api/categories`, { headers: { Cookie: sessionCookie } }),
    request.get(`${apiBaseURL}/api/related-systems`, { headers: { Cookie: sessionCookie } }),
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
    headers: { Cookie: sessionCookie },
    data: {
      categoryId: category.id,
      relatedSystemId: system.id,
      summary,
      description: "Verify the ticket list and detail layouts at this viewport.",
      requestedPriority: "MEDIUM",
    },
  });
  expect(ticketResponse.status()).toBe(201);

  await expect(page.getByLabel("Current user")).toContainText("E2E Requester A");
  await page.reload();
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
    path: `artifacts/lab-02/screenshots/${testInfo.project.name}-my-tickets.png`,
    fullPage: true,
  });

  await visibleTicketList.getByRole("button", { name: "View details" }).first().click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/lab-02/screenshots/${testInfo.project.name}-ticket-detail.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Back to My Tickets" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByRole("link", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await expect(page.locator("#ticket-category")).toHaveAccessibleName("Category");
  await expect(page.locator("#ticket-related-system")).toHaveAccessibleName("Related System");
  await expectNoHorizontalOverflow(page);

  await page.screenshot({
    path: `artifacts/lab-02/screenshots/${testInfo.project.name}-create-ticket.png`,
    fullPage: true,
  });
});

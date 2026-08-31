import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const requesterA = "Ari Suksan (ari.suksan@example.com)";
const requesterB = "Ben Chaiyo (ben.chaiyo@example.com)";
const apiBaseURL = "http://127.0.0.1:3000";

async function chooseRequester(page: Page, label: string) {
  await expect(page.getByLabel("Choose a Development Requester")).toBeVisible();
  await page.getByLabel("Choose a Development Requester").selectOption({ label });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Current Development Requester")).toContainText(label.split(" (")[0]);
}

test("covers requester selection, ticket creation, detail, attachments, and requester switching", async ({ page, request }, testInfo) => {
  await page.goto("/");
  await chooseRequester(page, requesterA);

  await page.getByRole("link", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: "Network" });
  await page.getByLabel("Related System").selectOption({ label: "Network and Internet" });

  const summary = `E2E attachment workflow ${Date.now()}`;
  await page.getByLabel("Summary").fill(summary);
  await page.getByLabel("Description").fill("Verify the complete requester ticket and attachment workflow.");
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await page.getByLabel("Attachments").setInputFiles(path.resolve("docs/lab-01/screenshots/01-health.png"));

  const ticketCreated = page.waitForResponse((response) =>
    response.url().endsWith("/api/tickets") && response.request().method() === "POST" && response.status() === 201,
  );
  await page.getByRole("button", { name: "Create Ticket" }).click();
  await ticketCreated;
  await expect(page.getByText("Ticket created successfully.")).toBeVisible();
  await expect(page.getByText("Attachments uploaded: 1/1.")).toBeVisible();

  const ticketNumber = await page.locator("strong").filter({ hasText: /^TKT-/ }).innerText();
  await expect(page.getByText(ticketNumber)).toBeVisible();
  await page.screenshot({
    path: path.resolve("artifacts/lab-02/screenshots/desktop-create-ticket-success.png"),
    fullPage: true,
  });

  const listResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/tickets?") && response.request().method() === "GET" && response.status() === 200,
  );
  await page.getByRole("link", { name: "My Tickets" }).click();
  const listResponse = await listResponsePromise;
  const listPayload = await listResponse.json() as { items: Array<{ id: number; summary: string }> };
  const createdTicket = listPayload.items.find((item) => item.summary === summary);
  expect(createdTicket).toBeTruthy();

  const createdRow = page.locator("tr").filter({ hasText: summary });
  await expect(createdRow).toBeVisible();
  await createdRow.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  const ticketInformation = page.getByRole("region", { name: "Ticket Information" });
  await expect(ticketInformation.getByText(ticketNumber)).toBeVisible();
  await expect(ticketInformation.getByText("Network", { exact: true })).toBeVisible();
  await expect(ticketInformation.getByText("Network and Internet", { exact: true })).toBeVisible();
  await expect(ticketInformation.getByText(summary)).toBeVisible();
  await expect(page.getByText("01-health.png", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download 01-health.png" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download 01-health.png" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("01-health.png");

  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByLabel("Removal reason").fill("E2E cleanup after lifecycle verification");
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(page.getByText("Removed", { exact: true })).toBeVisible();
  await expect(page.getByText(/Unavailable for download/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Download 01-health.png" })).toHaveCount(0);
  await page.screenshot({
    path: path.resolve("artifacts/lab-02/screenshots/desktop-ticket-detail-removed.png"),
    fullPage: true,
  });

  const requestersResponse = await request.get(`${apiBaseURL}/api/requesters?active=true`);
  expect(requestersResponse.status()).toBe(200);
  const requesters = await requestersResponse.json() as Array<{ id: number; name: string }>;
  const ben = requesters.find((requester) => requester.name === "Ben Chaiyo");
  if (!ben) throw new Error("Ben Chaiyo was not returned by the active requester API");

  const forbidden = await request.get(`${apiBaseURL}/api/tickets/${createdTicket!.id}`, {
    headers: { "X-Requester-Id": String(ben.id) },
  });
  expect(forbidden.status()).toBe(404);
  await expect(forbidden.json()).resolves.toEqual({ error: "Resource not found" });

  await page.getByRole("button", { name: "Change Requester" }).click();
  await chooseRequester(page, requesterB);
  await page.getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByText("Tickets created by Ben Chaiyo.")).toBeVisible();
  await expect(page.getByText(summary)).toHaveCount(0);

  await testInfo.attach("workflow-summary", {
    body: Buffer.from(`Created ${ticketNumber}; owner download succeeded; removal completed; cross-requester access returned 404.`),
    contentType: "text/plain",
  });
});

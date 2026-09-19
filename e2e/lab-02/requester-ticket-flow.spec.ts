import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const requesterAEmail = "e2e.requester.a@example.com";
const requesterBEmail = "e2e.requester.b@example.com";
const requesterPassword = "E2ERequesterPassword123";
const apiBaseURL = "http://127.0.0.1:3000";

async function signIn(page: Page, email: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(requesterPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
}

async function cookieHeader(page: Page): Promise<string> {
  const state = await page.context().storageState();
  return state.cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

test("covers authenticated requester ticket creation, detail, attachments, and isolation", async ({ page, request }, testInfo) => {
  await signIn(page, requesterAEmail);

  await page.getByRole("link", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await page.locator("#ticket-category").selectOption({ label: "Network" });
  await page.locator("#ticket-related-system").selectOption({ label: "Network and Internet" });

  const summary = `E2E attachment workflow ${Date.now()}`;
  await page.getByLabel("Summary").fill(summary);
  await page.getByLabel("Description").fill("Verify the complete requester ticket and attachment workflow.");
  await page.locator("#ticket-priority").selectOption("HIGH");
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

  const ownerCookie = await cookieHeader(page);
  const ownerDetail = await request.get(`${apiBaseURL}/api/tickets/${createdTicket!.id}`, {
    headers: { Cookie: ownerCookie },
  });
  expect(ownerDetail.status()).toBe(200);
  const ownerTicket = await ownerDetail.json() as {
    attachments: Array<{ id: number; originalName: string; removedAt: string | null }>;
  };
  const activeAttachment = ownerTicket.attachments.find(
    (attachment) => attachment.originalName === "01-health.png" && attachment.removedAt === null,
  );
  if (!activeAttachment) throw new Error("The uploaded active attachment was not returned in Ticket Detail");

  const bLogin = await request.post(`${apiBaseURL}/api/auth/login`, {
    data: { email: requesterBEmail, password: requesterPassword },
  });
  expect(bLogin.status()).toBe(200);
  const bCookie = bLogin.headersArray()
    .find((header) => header.name.toLowerCase() === "set-cookie")?.value.split(";")[0];
  if (!bCookie) throw new Error("The second requester login did not return a session cookie");

  const crossRequesterURL = `${apiBaseURL}/api/attachments/${activeAttachment.id}/download`;
  const forbiddenAttachment = await request.get(crossRequesterURL, {
    headers: { Cookie: bCookie },
  });
  expect(forbiddenAttachment.status()).toBe(404);
  await expect(forbiddenAttachment.json()).resolves.toEqual({ error: "Resource not found" });

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

  const forbiddenTicket = await request.get(`${apiBaseURL}/api/tickets/${createdTicket!.id}`, {
    headers: { Cookie: bCookie },
  });
  expect(forbiddenTicket.status()).toBe(404);
  await expect(forbiddenTicket.json()).resolves.toEqual({ error: "Resource not found" });

  await page.getByRole("button", { name: "Logout" }).click();
  await signIn(page, requesterBEmail);
  await expect(page.getByText("Tickets created by E2E Requester B.")).toBeVisible();
  await expect(page.getByText(summary)).toHaveCount(0);

  await testInfo.attach("workflow-summary", {
    body: Buffer.from(`Created ${ticketNumber}; owner download succeeded; cross-requester ticket and attachment access returned 404; removal completed.`),
    contentType: "text/plain",
  });
});

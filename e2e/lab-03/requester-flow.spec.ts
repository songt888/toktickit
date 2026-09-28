import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const apiBaseURL = "http://127.0.0.1:3000";
const requesterPassword = "E2ERequesterPassword123";

async function signIn(page: Page, email: string, password = requesterPassword) {
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

test("covers requester ownership, comments, resolution, and Staff collaboration with attachments", async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await signIn(page, "e2e.requester.a@example.com");
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByRole("link", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await page.locator("#ticket-category").selectOption({ label: "Network" });
  await page.locator("#ticket-related-system").selectOption({ label: "Network and Internet" });

  const marker = Date.now();
  const summary = `Lab 3 cross-role workflow ${marker}`;
  const requesterComment = `Requester update ${marker}`;
  const staffComment = `Support update ${marker}`;
  const internalNote = `Private troubleshooting note ${marker}`;
  await page.getByLabel("Summary").fill(summary);
  await page.getByLabel("Description").fill("Verify authenticated requester, staff collaboration, and attachment access.");
  await page.locator("#ticket-priority").selectOption("HIGH");
  await page.getByLabel("Attachments").setInputFiles(path.resolve("docs/lab-01/screenshots/01-health.png"));

  const uploadPromise = page.waitForResponse((response) =>
    /\/api\/tickets\/\d+\/attachments$/.test(response.url()) && response.request().method() === "POST",
  );
  const createdPromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/tickets") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create Ticket" }).click();
  const createdResponse = await createdPromise;
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json() as { id: number; ticketNumber: string; currentStatus: string };
  expect(created.currentStatus).toBe("NEW");

  const uploadResponse = await uploadPromise;
  expect(uploadResponse.status()).toBe(201);
  await expect(page.getByText("Attachments uploaded: 1/1.")).toBeVisible();
  await expect(page.getByText(created.ticketNumber)).toBeVisible();

  await page.getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  const ticketRow = page.getByRole("row").filter({ hasText: summary });
  await expect(ticketRow).toBeVisible();
  await ticketRow.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  const ticketInformation = page.getByRole("region", { name: "Ticket Information" });
  await expect(ticketInformation.getByText(created.ticketNumber)).toBeVisible();
  await expect(ticketInformation.getByText("NEW", { exact: true })).toBeVisible();
  await expect(page.getByText("01-health.png", { exact: true })).toBeVisible();

  await page.getByLabel("Add Public Comment").fill(requesterComment);
  const requesterCommentPromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/tickets/${created.id}/comments`) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Add Public Comment" }).click();
  expect((await requesterCommentPromise).status()).toBe(201);
  await expect(page.getByText(requesterComment, { exact: true })).toBeVisible();

  const resolutionPromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/tickets/${created.id}/problem-resolution`) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Mark problem as resolved" }).click();
  expect((await resolutionPromise).status()).toBe(200);
  await expect(page.getByText("Problem marked as appearing resolved. Ticket status was not changed.")).toBeVisible();
  await expect(ticketInformation.getByText("NEW", { exact: true })).toBeVisible();

  const ownerCookie = await cookieHeader(page);
  const ownerTicketResponse = await request.get(`${apiBaseURL}/api/tickets/${created.id}`, {
    headers: { Cookie: ownerCookie },
  });
  expect(ownerTicketResponse.status()).toBe(200);
  const ownerTicket = await ownerTicketResponse.json() as { attachments: Array<{ id: number; originalName: string }> };
  const attachment = ownerTicket.attachments.find(({ originalName }) => originalName === "01-health.png");
  if (!attachment) throw new Error("The created Ticket did not retain its uploaded attachment");

  const otherLogin = await request.post(`${apiBaseURL}/api/auth/login`, {
    data: { email: "e2e.requester.b@example.com", password: requesterPassword },
  });
  expect(otherLogin.status()).toBe(200);
  const otherCookie = otherLogin.headersArray()
    .find(({ name }) => name.toLowerCase() === "set-cookie")?.value.split(";")[0];
  if (!otherCookie) throw new Error("The second Requester login did not return a session cookie");
  const [foreignTicket, foreignAttachment] = await Promise.all([
    request.get(`${apiBaseURL}/api/tickets/${created.id}`, { headers: { Cookie: otherCookie } }),
    request.get(`${apiBaseURL}/api/attachments/${attachment.id}/download`, { headers: { Cookie: otherCookie } }),
  ]);
  expect(foreignTicket.status()).toBe(404);
  await expect(foreignTicket.json()).resolves.toEqual({ error: "Resource not found" });
  expect(foreignAttachment.status()).toBe(404);
  await expect(foreignAttachment.json()).resolves.toEqual({ error: "Resource not found" });
  await request.post(`${apiBaseURL}/api/auth/logout`, { headers: { Cookie: otherCookie } });

  await logout(page);
  await signIn(page, "e2e.requester.b@example.com");
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expect(page.getByText(summary)).toHaveCount(0);

  await logout(page);
  await signIn(page, "e2e.staff@example.com", "E2EStaffPassword123");
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await page.getByLabel("Search Queue").fill(summary);
  const queuePromise = page.waitForResponse((response) =>
    response.url().includes("/api/staff/tickets?") && response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  expect((await queuePromise).status()).toBe(200);
  const staffRow = page.getByRole("row").filter({ hasText: summary });
  await expect(staffRow).toBeVisible();
  await staffRow.getByRole("button", { name: "Open Detail" }).click();
  const staffDetail = page.locator("#staff-ticket-detail");
  await expect(staffDetail.getByText(requesterComment, { exact: true })).toBeVisible();
  await expect(staffDetail.getByText("01-health.png", { exact: true })).toBeVisible();

  await page.getByLabel("Add a public comment").fill(staffComment);
  const staffCommentPromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/tickets/${created.id}/comments`) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Post Public Comment" }).click();
  expect((await staffCommentPromise).status()).toBe(201);
  await expect(staffDetail.getByText(staffComment, { exact: true })).toBeVisible();

  await page.getByLabel("Add an internal note").fill(internalNote);
  const notePromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/tickets/${created.id}/internal-notes`) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Post Internal Note" }).click();
  expect((await notePromise).status()).toBe(201);
  await expect(staffDetail.getByText(internalNote, { exact: true })).toBeVisible();

  await logout(page);
  await signIn(page, "e2e.requester.a@example.com");
  await page.getByLabel("Search Tickets").fill(summary);
  const requesterListPromise = page.waitForResponse((response) =>
    response.url().includes("/api/tickets?") && response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  expect((await requesterListPromise).status()).toBe(200);
  const requesterRow = page.getByRole("row").filter({ hasText: summary });
  await requesterRow.getByRole("button", { name: "View details" }).click();
  await expect(page.getByText(requesterComment, { exact: true })).toBeVisible();
  await expect(page.getByText(staffComment, { exact: true })).toBeVisible();
  await expect(page.getByText(internalNote, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download 01-health.png" })).toBeVisible();

  await testInfo.attach("lab3-role-workflow", {
    body: Buffer.from(`${created.ticketNumber}: Requester ownership, public comments, resolution indication, attachment retention, Staff collaboration, and private notes verified.`),
    contentType: "text/plain",
  });
});

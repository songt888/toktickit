import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getPrisma } from "../../server/src/prisma.js";
import { hashPassword } from "../../server/src/password.js";

// E2E-04: Lab 1-3 behaviour still works with Lab 4 in place. Fresh users, so shared E2E accounts never change.
const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const password = "E2ERegressionPassword123";
const prisma = getPrisma();
test.afterAll(() => prisma.$disconnect());

async function freshUser(label: string, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR") {
  const email = `e2e.regression.${label}.${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: { name: `E2E Regression ${label}`, email, role, isActive: true, passwordHash: hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date() },
  });
  return { id: user.id, email, password };
}

async function apiAs(user: { email: string; password: string }): Promise<APIRequestContext> {
  const context = await request.newContext({ baseURL: apiURL });
  expect((await context.post("/api/auth/login", { data: user })).ok()).toBe(true);
  return context;
}

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("E2E-04 auth, password and logout still work", async ({ page }) => {
  const user = await freshUser("auth", "REQUESTER");
  const anonymous = await request.newContext({ baseURL: apiURL });
  expect((await anonymous.get("/api/tickets")).status()).toBe(401);
  expect((await anonymous.post("/api/auth/login", { data: { email: user.email, password: "WrongPassword123" } })).status()).toBe(401);

  await signIn(page, { email: user.email, password: "WrongPassword123" });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await signIn(page, user);
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

  // Changing the password: the old one stops working, the new one signs in.
  const api = await apiAs(user);
  const newPassword = "E2ERegressionChanged456";
  expect((await api.post("/api/auth/change-password", { data: { currentPassword: password, newPassword, confirmPassword: newPassword } })).ok()).toBe(true);
  expect((await anonymous.post("/api/auth/login", { data: { email: user.email, password } })).status()).toBe(401);

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  // Logged out in the browser means the browser's session no longer reads data.
  expect((await page.request.get(`${apiURL}/api/tickets`)).status()).toBe(401);
  await signIn(page, { email: user.email, password: newPassword });
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await Promise.all([anonymous.dispose(), api.dispose()]);
});

test("E2E-04 tickets, attachments, comments, queue owner, IT priority and Internal Notes still work", async ({ page }) => {
  const [requester, other, staff] = [await freshUser("requester", "REQUESTER"), await freshUser("other", "REQUESTER"), await freshUser("staff", "IT_STAFF")];
  const requesterApi = await apiAs(requester);
  const otherApi = await apiAs(other);
  const staffApi = await apiAs(staff);
  const category = (await (await requesterApi.get("/api/categories")).json())[0];
  const system = (await (await requesterApi.get("/api/related-systems")).json())[0];
  const summary = `E2E regression ticket ${Date.now()}`;
  const created = await requesterApi.post("/api/tickets", {
    data: { categoryId: category.id, relatedSystemId: system.id, summary, description: "Monitor flickers.", requestedPriority: "LOW" },
  });
  expect(created.status()).toBe(201);
  const ticketId = (await created.json()).id as number;

  // Attachment upload by the owner; another Requester cannot see the Ticket at all.
  const upload = await requesterApi.post(`/api/tickets/${ticketId}/attachments`, {
    multipart: { file: { name: "01-health.png", mimeType: "image/png", buffer: readFileSync(path.resolve("docs/lab-01/screenshots/01-health.png")) } },
  });
  expect(upload.status()).toBe(201);
  expect((await otherApi.get(`/api/tickets/${ticketId}`)).status()).toBe(404);
  expect((await otherApi.get(`/api/tickets/${ticketId}/attachments`)).status()).toBe(404);

  // Public comment both ways; Internal Notes are Staff-only.
  expect((await requesterApi.post(`/api/tickets/${ticketId}/comments`, { data: { content: "Still flickering this morning." } })).status()).toBe(201);
  expect((await staffApi.post(`/api/tickets/${ticketId}/comments`, { data: { content: "We will swap the cable." } })).status()).toBe(201);
  expect((await staffApi.post(`/api/tickets/${ticketId}/internal-notes`, { data: { content: "Cable stock is in room 4." } })).status()).toBe(201);
  expect((await requesterApi.get(`/api/tickets/${ticketId}/internal-notes`)).status()).toBe(403);
  expect((await requesterApi.post(`/api/tickets/${ticketId}/internal-notes`, { data: { content: "Let me in" } })).status()).toBe(403);
  expect((await requesterApi.get(`/api/staff/tickets/${ticketId}`)).status()).toBe(403);

  // Queue owner and IT priority with optimistic concurrency.
  let detail = await (await staffApi.get(`/api/staff/tickets/${ticketId}`)).json();
  const claimed = await staffApi.patch(`/api/staff/tickets/${ticketId}/owner`, { data: { ownerId: staff.id, updatedAt: detail.updatedAt } });
  expect(claimed.status()).toBe(200);
  expect((await staffApi.patch(`/api/staff/tickets/${ticketId}/it-priority`, { data: { itPriority: "HIGH", updatedAt: detail.updatedAt } })).status()).toBe(409);
  detail = await (await staffApi.get(`/api/staff/tickets/${ticketId}`)).json();
  expect((await staffApi.patch(`/api/staff/tickets/${ticketId}/it-priority`, { data: { itPriority: "HIGH", updatedAt: detail.updatedAt } })).status()).toBe(200);
  detail = await (await staffApi.get(`/api/staff/tickets/${ticketId}`)).json();
  expect([detail.owner?.id, detail.itPriority, detail.requestedPriority]).toEqual([staff.id, "HIGH", "LOW"]);

  // The Requester sees comments and the attachment, never the Internal Note.
  await signIn(page, requester);
  await page.getByRole("link", { name: "My Tickets" }).click();
  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "View details" }).click();
  await expect(page.getByText("We will swap the cable.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download 01-health.png" })).toBeVisible();
  await expect(page.getByText("Cable stock is in room 4.")).toHaveCount(0);
  await page.getByRole("button", { name: "Logout" }).click();

  // Staff sees the Internal Note in the Operational Detail.
  await signIn(page, staff);
  await page.getByRole("link", { name: "Ticket Queue" }).click();
  await page.getByLabel("Search Queue").fill(summary);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "Open Detail" }).click();
  await expect(page.getByText("Cable stock is in room 4.")).toBeVisible();
  await Promise.all([requesterApi.dispose(), otherApi.dispose(), staffApi.dispose()]);
});

test("E2E-04 Administrator safety rules still hold", async ({ page }) => {
  const admin = await freshUser("admin", "ADMINISTRATOR");
  const staff = await freshUser("admin-target", "IT_STAFF");
  const adminApi = await apiAs(admin);
  const staffApi = await apiAs(staff);
  expect((await staffApi.get("/api/admin/users")).status()).toBe(403);
  expect((await adminApi.patch(`/api/admin/users/${admin.id}`, { data: { isActive: false } })).status()).toBe(409);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).isActive).toBe(true);
  // Deactivating someone else works and ends their access.
  expect((await adminApi.patch(`/api/admin/users/${staff.id}`, { data: { isActive: false } })).status()).toBe(200);
  expect((await staffApi.get("/api/staff/tickets")).status()).toBe(401);

  await signIn(page, admin);
  await page.getByRole("link", { name: "User Management" }).click();
  await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();
  await Promise.all([adminApi.dispose(), staffApi.dispose()]);
});

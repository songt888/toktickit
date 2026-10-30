import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import path from "node:path";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const staff = { email: "e2e.staff@example.com", password: "E2EStaffPassword123", name: "E2E Staff User" };
const admin = { email: "e2e.admin@example.com", password: "E2EAdminPassword123", name: "E2E Administrator" };
const requesterA = { email: "e2e.requester.a@example.com", password: "E2ERequesterPassword123" };
const requesterB = { email: "e2e.requester.b@example.com", password: "E2ERequesterPassword123" };

async function apiAs(user: { email: string; password: string }): Promise<APIRequestContext> {
  const context = await request.newContext({ baseURL: apiURL });
  const response = await context.post("/api/auth/login", { data: user });
  expect(response.ok()).toBe(true);
  return context;
}

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

async function openOperationalDetail(page: Page, summary: string) {
  await page.getByRole("link", { name: "Ticket Queue" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  await page.getByLabel("Search Queue").fill(summary);
  await page.getByRole("button", { name: "Apply filters" }).click();
  const row = page.getByRole("row").filter({ hasText: summary });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Open Detail" }).click();
  await expect(page.getByRole("heading", { name: "Operational Ticket Detail" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
}

// Screenshot at desktop, tablet and mobile widths, failing on any page-level horizontal overflow.
async function captureLayouts(page: Page, name: string) {
  for (const { label, width, height } of [{ label: "desktop", width: 1280, height: 900 }, { label: "tablet", width: 820, height: 1000 }, { label: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize({ width, height });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(scrollWidth, `${name} ${label}`).toBeLessThanOrEqual(clientWidth + 1);
    await page.getByRole("heading", { name: "Actions Taken" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.resolve(`artifacts/lab-04/screenshots/actions-taken/${name}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

const actionCard = (page: Page, description: string) => page.getByRole("listitem", { name: `Action: ${description}` });

test("E2E-01 records Actions by different staff, runs the lifecycle and shows them read-only to the Requester", async ({ page }) => {
  const summary = `E2E Lab 4 actions ${Date.now()}`;

  // Requester A raises the Ticket; the Administrator owns it, so Action performers differ from the Owner.
  const requesterApi = await apiAs(requesterA);
  const category = (await (await requesterApi.get("/api/categories")).json())[0];
  const system = (await (await requesterApi.get("/api/related-systems")).json())[0];
  const created = await requesterApi.post("/api/tickets", {
    data: { categoryId: category.id, relatedSystemId: system.id, summary, description: "Shared drive is slow for the whole team.", requestedPriority: "HIGH" },
  });
  expect(created.status()).toBe(201);
  const ticketId = (await created.json()).id as number;
  const adminApi = await apiAs(admin);
  const detail = await (await adminApi.get(`/api/staff/tickets/${ticketId}`)).json();
  const me = await (await adminApi.get("/api/auth/me")).json();
  expect((await adminApi.patch(`/api/staff/tickets/${ticketId}/owner`, { data: { ownerId: me.user.id, updatedAt: detail.updatedAt } })).ok()).toBe(true);

  // Staff records the first Action and starts it.
  await signIn(page, staff);
  await openOperationalDetail(page, summary);
  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByRole("textbox", { name: "Description" }).fill("Checked the file server load");
  await page.getByRole("button", { name: "Save Action" }).click();
  await expect(page.getByText("Action added.")).toBeVisible();
  const first = actionCard(page, "Checked the file server load");
  await expect(first.getByText("Planned")).toBeVisible();
  await expect(first.getByText("Performed by").locator("+ dd")).toHaveText(staff.name);
  await first.getByRole("button", { name: "Start" }).click();
  await expect(first.getByText("In progress")).toBeVisible();
  await signOut(page);

  // The Administrator records a second Action assigned to Staff, then reassigns the first one.
  await signIn(page, admin);
  await openOperationalDetail(page, summary);
  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByRole("textbox", { name: "Description" }).fill("Plan a switch replacement");
  await page.getByRole("combobox", { name: "Assigned to" }).selectOption({ label: `${staff.name} (IT Staff)` });
  await page.getByRole("button", { name: "Save Action" }).click();
  await expect(page.getByText("Action added.")).toBeVisible();
  const second = actionCard(page, "Plan a switch replacement");
  await expect(second.getByText("Performed by").locator("+ dd")).toHaveText(admin.name);
  await expect(second.getByText("Assigned to").locator("+ dd")).toContainText(staff.name);
  await expect(page.getByText("Owner", { exact: true }).locator("+ dd")).toHaveText(admin.name);

  // Complete the first Action (result required), cancel the second with a reason.
  await first.getByRole("button", { name: "Complete" }).click();
  await page.getByRole("button", { name: "Complete Action" }).click();
  await expect(page.getByRole("textbox", { name: "Result (required to complete)" })).toHaveAccessibleDescription("Record the result before completing.");
  await page.getByRole("textbox", { name: "Result (required to complete)" }).fill("Moved backups off peak hours");
  await page.getByRole("button", { name: "Complete Action" }).click();
  await expect(first.getByText("Completed")).toBeVisible();
  await expect(first.getByRole("button", { name: "Start" })).toHaveCount(0);

  await second.getByRole("button", { name: "Cancel Action" }).click();
  await page.getByRole("textbox", { name: "Cancellation Reason" }).fill("Load issue already solved");
  await page.getByRole("checkbox", { name: /I confirm cancelling this Action/ }).check();
  await page.getByRole("button", { name: "Cancel this Action" }).click();
  await expect(second.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(second.getByRole("button")).toHaveText(["View History"]);

  await first.getByRole("button", { name: "View History" }).click();
  await expect(first.getByText(/Version 1: CREATE by E2E Staff User/)).toBeVisible();
  await expect(first.getByText(/Version 3: STATUS by E2E Administrator/)).toBeVisible();
  await captureLayouts(page, "staff");
  await signOut(page);

  // The Requester sees both Actions read-only; another Requester cannot read or write them.
  await signIn(page, requesterA);
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
  await expect(actionCard(page, "Checked the file server load").getByText("Moved backups off peak hours")).toBeVisible();
  await expect(actionCard(page, "Plan a switch replacement").getByText("Load issue already solved")).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Add Action|Edit|Reassign|Start|Complete|Cancel Action)$/ })).toHaveCount(0);
  await captureLayouts(page, "requester");

  const write = await requesterApi.post(`/api/tickets/${ticketId}/actions-taken`, {
    data: { mutationId: crypto.randomUUID(), ticketUpdatedAt: new Date().toISOString(), actionAt: new Date().toISOString(), description: "Requester try", followUpRequired: false },
  });
  expect(write.status()).toBe(403);
  const otherApi = await apiAs(requesterB);
  expect((await otherApi.get(`/api/tickets/${ticketId}/actions-taken`)).status()).toBe(404);
  await Promise.all([requesterApi.dispose(), adminApi.dispose(), otherApi.dispose()]);
});

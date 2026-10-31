import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";
import path from "node:path";
import { getPrisma } from "../../server/src/prisma.js";
import { hashPassword } from "../../server/src/password.js";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const staff = { email: "e2e.staff@example.com", password: "E2EStaffPassword123" };
const requesterA = { email: "e2e.requester.a@example.com", password: "E2ERequesterPassword123" };

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
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
}

const actionCard = (page: Page, description: string) => page.getByRole("listitem", { name: `Action: ${description}` });

async function addAction(page: Page, description: string) {
  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByRole("textbox", { name: "Description" }).fill(description);
  await page.getByRole("button", { name: "Save Action" }).click();
  await expect(page.getByText("Action added.")).toBeVisible();
}

// Confirmed status changes (Closed/Cancelled) raise a browser confirm; accept it when asked.
async function changeStatus(page: Page, status: string, confirm = false) {
  if (confirm) page.once("dialog", (dialog) => void dialog.accept());
  await page.locator("#staff-ticket-status").selectOption(status);
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText(`Ticket status was updated to ${status}.`)).toBeVisible();
  await expect(page.getByText("Current Status").locator("+ dd")).toHaveText(status);
}

async function gate(page: Page, completed: number, pending: number, unsettled: number) {
  await expect(page.getByText(`Completed Actions: ${completed}`)).toBeVisible();
  await expect(page.getByText(`Pending Actions: ${pending}`)).toBeVisible();
  await expect(page.getByText(`Unsettled follow-up: ${unsettled}`)).toBeVisible();
}

test("E2E-02 records ordered work, blocks resolving until work and follow-up settle, then resolves, closes, reopens and cancels", async ({ page }) => {
  const summary = `E2E Lab 4 resolution ${Date.now()}`;
  const requesterApi = await apiAs(requesterA);
  const category = (await (await requesterApi.get("/api/categories")).json())[0];
  const system = (await (await requesterApi.get("/api/related-systems")).json())[0];
  const created = await requesterApi.post("/api/tickets", {
    data: { categoryId: category.id, relatedSystemId: system.id, summary, description: "VPN drops every few minutes.", requestedPriority: "MEDIUM" },
  });
  expect(created.status()).toBe(201);
  const ticketId = (await created.json()).id as number;

  await signIn(page, staff);
  await page.getByRole("link", { name: "Ticket Queue" }).click();
  await page.getByLabel("Search Queue").fill(summary);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "Open Detail" }).click();
  await expect(page.getByRole("heading", { name: "Operational Ticket Detail" })).toBeVisible();
  await changeStatus(page, "IN_PROGRESS");

  // No work yet: Resolved is offered but disabled, with the reason linked to the Status field.
  const resolvedOption = page.locator("#staff-ticket-status").locator('option[value="RESOLVED"]');
  await expect(resolvedOption).toBeDisabled();
  await expect(resolvedOption).toHaveText("RESOLVED (work not complete)");
  await gate(page, 0, 0, 0);
  await expect(page.locator("#staff-ticket-status")).toHaveAccessibleDescription(/complete at least one Action/);

  // Ordered work: two Actions listed in the order performed.
  await addAction(page, "Replaced the VPN client profile");
  await addAction(page, "Re-test the VPN for one hour");
  expect(await page.locator('li[aria-label^="Action: "]').evaluateAll((items) => items.map((item) => item.getAttribute("aria-label"))))
    .toEqual(["Action: Replaced the VPN client profile", "Action: Re-test the VPN for one hour"]);

  // First Action completes but still needs follow-up; the second is pending: gate fails.
  const first = actionCard(page, "Replaced the VPN client profile");
  await first.getByRole("button", { name: "Complete" }).click();
  await page.getByRole("textbox", { name: "Result (required to complete)" }).fill("Profile replaced");
  await page.getByRole("checkbox", { name: "Follow-Up Required?" }).check();
  await page.getByRole("textbox", { name: "Follow-up Note" }).fill("Confirm with the Requester after one day");
  await page.getByRole("button", { name: "Complete Action" }).click();
  await expect(first.getByText("Completed")).toBeVisible();
  await gate(page, 1, 1, 1);
  await expect(resolvedOption).toBeDisabled();
  await page.getByText("Resolution readiness").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.resolve("artifacts/lab-04/screenshots/ticket-resolution/gate-failed.png") });

  // The server enforces the same gate if the UI is bypassed.
  const staffApi = await apiAs(staff);
  const current = await (await staffApi.get(`/api/staff/tickets/${ticketId}`)).json();
  const forced = await staffApi.patch(`/api/staff/tickets/${ticketId}/status`, { data: { status: "RESOLVED", updatedAt: current.updatedAt } });
  expect(forced.status()).toBe(409);
  expect(await forced.json()).toMatchObject({ code: "RESOLUTION_GATE_FAILED", resolutionGate: { canResolve: false, completedActions: 1, pendingActions: 1, unsettledFollowUpActions: 1 } });

  const second = actionCard(page, "Re-test the VPN for one hour");
  await second.getByRole("button", { name: "Complete" }).click();
  await page.getByRole("textbox", { name: "Result (required to complete)" }).fill("Stable for one hour");
  await page.getByRole("button", { name: "Complete Action" }).click();
  await expect(second.getByText("Completed")).toBeVisible();
  await gate(page, 2, 0, 1);
  await expect(resolvedOption).toBeDisabled();

  // Settle the follow-up: turning it off asks before removing the note.
  await first.getByRole("button", { name: "Edit" }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("checkbox", { name: "Follow-Up Required?" }).uncheck();
  await page.getByRole("button", { name: "Save Action" }).click();
  await expect(page.getByText("Action updated.")).toBeVisible();
  await expect(first.getByText("Follow-Up Required?").locator("+ dd")).toHaveText("No");
  await gate(page, 2, 0, 0);
  await expect(page.getByText("Ready to resolve.")).toBeVisible();

  await changeStatus(page, "RESOLVED");
  await expect(page.getByRole("button", { name: "Add Action" })).toHaveCount(0);
  await expect(page.getByText("Actions cannot change while the Ticket is RESOLVED.", { exact: false })).toBeVisible();
  await changeStatus(page, "CLOSED", true);
  await changeStatus(page, "REOPENED");
  await expect(page.getByRole("button", { name: "Add Action" })).toBeVisible();
  await changeStatus(page, "CANCELLED", true);
  await expect(page.getByRole("button", { name: "Add Action" })).toHaveCount(0);
  await page.screenshot({ path: path.resolve("artifacts/lab-04/screenshots/ticket-resolution/staff-cancelled.png"), fullPage: true });
  await page.getByRole("button", { name: "Logout" }).click();

  // The Requester sees the same Actions, results and history, read-only.
  await signIn(page, requesterA);
  await page.getByRole("link", { name: "My Tickets" }).click();
  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "View details" }).click();
  await expect(page.getByText("Current Status").locator("+ dd")).toHaveText("CANCELLED");
  await expect(actionCard(page, "Replaced the VPN client profile").getByText("Profile replaced")).toBeVisible();
  await expect(actionCard(page, "Re-test the VPN for one hour").getByText("Stable for one hour")).toBeVisible();
  const shared = actionCard(page, "Replaced the VPN client profile");
  await shared.getByRole("button", { name: "View History" }).click();
  await expect(shared.getByText(/Version 1: CREATE by E2E Staff User/)).toBeVisible();
  await expect(shared.getByText(/follow-up: Confirm with the Requester after one day/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Add Action|Edit|Reassign|Start|Complete|Cancel Action)$/ })).toHaveCount(0);
  await page.screenshot({ path: path.resolve("artifacts/lab-04/screenshots/ticket-resolution/requester-shared-history.png"), fullPage: true });
  await Promise.all([requesterApi.dispose(), staffApi.dispose()]);
});

test("E2E-02 an Action whose assignee was deactivated is flagged and cannot be worked until reassigned", async ({ page }) => {
  const prisma = getPrisma();
  const helper = await prisma.user.create({
    data: { name: `E2E Leaving Staff ${Date.now()}`, email: `e2e.leaving.${Date.now()}@example.com`, role: "IT_STAFF", isActive: true,
      passwordHash: hashPassword("E2ELeavingPassword123"), mustChangePassword: false, passwordChangedAt: new Date() },
  });
  const summary = `E2E Lab 4 inactive assignee ${Date.now()}`;
  const requesterApi = await apiAs(requesterA);
  const category = (await (await requesterApi.get("/api/categories")).json())[0];
  const system = (await (await requesterApi.get("/api/related-systems")).json())[0];
  const ticketId = (await (await requesterApi.post("/api/tickets", {
    data: { categoryId: category.id, relatedSystemId: system.id, summary, description: "Badge reader offline.", requestedPriority: "LOW" },
  })).json()).id as number;

  const staffApi = await apiAs(staff);
  const detail = await (await staffApi.get(`/api/staff/tickets/${ticketId}`)).json();
  const action = await staffApi.post(`/api/tickets/${ticketId}/actions-taken`, {
    data: { mutationId: crypto.randomUUID(), ticketUpdatedAt: detail.updatedAt, actionAt: new Date().toISOString(), description: "Replace the badge reader", assigneeId: helper.id, followUpRequired: false },
  });
  expect(action.status()).toBe(201);
  await prisma.user.update({ where: { id: helper.id }, data: { isActive: false } });

  await signIn(page, staff);
  await page.getByRole("link", { name: "Ticket Queue" }).click();
  await page.getByLabel("Search Queue").fill(summary);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "Open Detail" }).click();
  const card = actionCard(page, "Replace the badge reader");
  await expect(card.getByText("Not eligible: reassign first")).toBeVisible();
  for (const name of ["Edit", "Start", "Complete"]) await expect(card.getByRole("button", { name, exact: true })).toBeDisabled();
  await card.getByRole("button", { name: "Reassign" }).click();
  await expect(page.getByRole("combobox", { name: "Assigned to" }).locator("option[disabled]")).toHaveText(`${helper.name} (not eligible)`);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.resolve("artifacts/lab-04/screenshots/actions-taken/invalid-assignee.png"), fullPage: true });

  // The server rejects a new Action for the inactive user too.
  const fresh = await (await staffApi.get(`/api/staff/tickets/${ticketId}`)).json();
  const rejected = await staffApi.post(`/api/tickets/${ticketId}/actions-taken`, {
    data: { mutationId: crypto.randomUUID(), ticketUpdatedAt: fresh.updatedAt, actionAt: new Date().toISOString(), description: "Try again", assigneeId: helper.id, followUpRequired: false },
  });
  expect(rejected.status()).toBe(400);
  await Promise.all([requesterApi.dispose(), staffApi.dispose(), prisma.$disconnect()]);
});

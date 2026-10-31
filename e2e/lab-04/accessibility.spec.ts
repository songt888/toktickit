import { expect, request, test, type Page } from "@playwright/test";
import path from "node:path";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const staff = { email: "e2e.staff@example.com", password: "E2EStaffPassword123" };
const requesterA = { email: "e2e.requester.a@example.com", password: "E2ERequesterPassword123" };

async function expectLabeledFields(page: Page) {
  const unlabeled = await page.locator("main input:not([type=hidden]), main select, main textarea").evaluateAll((controls) =>
    controls.filter((field) => !(field as HTMLInputElement).labels?.length && !field.getAttribute("aria-label") && !field.getAttribute("aria-labelledby"))
      .map((field) => field.outerHTML));
  expect(unlabeled).toEqual([]);
}

async function expectVisibleFocus(page: Page) {
  const indicated = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  });
  expect(indicated).toBe(true);
}

test("A11Y-01 Lab 4 screens work by keyboard with labels, focus, skip link, active nav and announced errors", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  const summary = `E2E Lab 4 a11y ${Date.now()}`;
  const requesterApi = await request.newContext({ baseURL: apiURL });
  expect((await requesterApi.post("/api/auth/login", { data: requesterA })).ok()).toBe(true);
  const category = (await (await requesterApi.get("/api/categories")).json())[0];
  const system = (await (await requesterApi.get("/api/related-systems")).json())[0];
  expect((await requesterApi.post("/api/tickets", {
    data: { categoryId: category.id, relatedSystemId: system.id, summary, description: "Keyboard check Ticket.", requestedPriority: "LOW" },
  })).status()).toBe(201);
  await requesterApi.dispose();

  await page.goto("/");
  await page.getByLabel("Email").fill(staff.email);
  await page.getByLabel("Password").fill(staff.password);
  await page.getByRole("button", { name: "Sign In" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Unassigned Tickets", exact: true })).toBeVisible();

  // Skip link and active navigation on the Dashboard.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Unassigned Tickets", exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expectLabeledFields(page);

  // Metric cards and buckets have descriptive names and open by keyboard.
  await expect(page.getByRole("button", { name: /^Urgent: \d+ active Tickets, view in the Ticket Queue$/ })).toBeVisible();
  const view = page.getByRole("button", { name: "View Unassigned Tickets in the Ticket Queue" });
  await view.focus();
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Unassigned active Tickets")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");

  await page.getByLabel("Search Queue").fill(summary);
  await page.getByRole("button", { name: "Apply filters" }).press("Enter");
  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "Open Detail" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
  await expectLabeledFields(page);

  // Opening the form by keyboard moves focus into it; an empty save is announced and tied to the field.
  await page.getByRole("button", { name: "Add Action" }).press("Enter");
  await expect(page.locator("#action-form-title")).toBeFocused();
  await expectLabeledFields(page);
  await page.getByRole("button", { name: "Save Action" }).press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "The Action was not saved." })).toBeVisible();
  const descriptionField = page.getByRole("textbox", { name: "Description" });
  await expect(descriptionField).toHaveAttribute("aria-invalid", "true");
  await expect(descriptionField).toHaveAttribute("aria-required", "true");
  await expect(descriptionField).toHaveAccessibleDescription(/Describe the action\./);
  await descriptionField.fill("Checked the keyboard flow");
  await page.getByRole("button", { name: "Save Action" }).press("Enter");
  await expect(page.getByText("Action added.")).toBeVisible();

  // Cancel panel: focus enters the panel, errors are announced, Discard returns focus to the same Action.
  const card = page.getByRole("listitem", { name: "Action: Checked the keyboard flow" });
  await card.getByRole("button", { name: "Cancel Action" }).press("Enter");
  await expect(page.locator("#action-form-title")).toBeFocused();
  await expect(page.locator("#action-form-title")).toContainText("Cancel Action");
  await page.getByRole("button", { name: "Cancel this Action" }).press("Enter");
  await expect(page.getByRole("textbox", { name: "Cancellation Reason" })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("checkbox", { name: /I confirm cancelling this Action/ })).toHaveAccessibleDescription(/Confirm that you want to cancel this Action\./);
  await page.screenshot({ path: path.resolve("artifacts/lab-04/screenshots/accessibility/cancel-panel-errors.png"), fullPage: true });
  await page.getByRole("button", { name: "Discard form" }).press("Enter");
  await expect(card).toBeFocused();
  await expectVisibleFocus(page);

  // History opens and closes by keyboard with focus kept on the toggle's place.
  await card.getByRole("button", { name: "View History" }).press("Enter");
  await expect(card.getByText(/Version 1: CREATE/)).toBeVisible();
  await card.getByRole("button", { name: "Close History" }).press("Enter");
  await expect(card.getByRole("button", { name: "View History" })).toBeFocused();

  // My Pending Actions: reachable by keyboard and its controls are named.
  await page.getByRole("link", { name: "Dashboard" }).press("Enter");
  await page.getByRole("button", { name: "View all My Pending Actions" }).press("Enter");
  await expect(page.getByRole("heading", { name: "My Pending Actions" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open Action on TKT-/ }).first()).toBeVisible();
  await expectLabeledFields(page);
});

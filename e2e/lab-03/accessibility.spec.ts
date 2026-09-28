import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const requesterPassword = "E2ERequesterPassword123";
const staffPassword = "E2EStaffPassword123";
const adminPassword = "E2EAdminPassword123";

async function signIn(page: Page, email: string, password: string, heading: string) {
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

async function expectLabeledFields(page: Page) {
  const fields = page.locator("main input:not([type=hidden]), main select, main textarea");
  const unlabeled = await fields.evaluateAll((controls) =>
    controls.filter((field) => {
      const control = field as HTMLInputElement;
      return !control.labels?.length && !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby");
    }).map((field) => field.outerHTML),
  );
  const unnamed = await fields.evaluateAll((controls) =>
    controls.filter((field) => !field.getAttribute("name")).map((field) => field.outerHTML),
  );
  expect(unlabeled).toEqual([]);
  expect(unnamed).toEqual([]);
}

test("keyboard navigation, labels, active navigation, and feedback are accessible", async ({ page }) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  await signIn(page, "e2e.requester.a@example.com", requesterPassword, "My Tickets");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Create Ticket" }).click();
  await expectLabeledFields(page);
  await page.locator("#ticket-requester").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#ticket-category")).toBeFocused();
  const focusIndicator = await page.locator("#ticket-category").evaluate((field) => {
    const style = getComputedStyle(field);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  });
  expect(focusIndicator).toBe(true);
  await page.screenshot({
    path: path.resolve("artifacts/lab-03/screenshots/accessibility-keyboard-focus.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Logout" }).click();
  await signIn(page, "e2e.staff@example.com", staffPassword, "Ticket Queue");
  await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
  await expectLabeledFields(page);

  await page.getByRole("button", { name: "Logout" }).click();
  await signIn(page, "e2e.admin@example.com", adminPassword, "User Management");
  await expect(page.getByRole("link", { name: "User Management" })).toHaveAttribute("aria-current", "page");
  await expectLabeledFields(page);
  await expect(page.getByRole("button", { name: "Add user" })).toBeVisible();
});

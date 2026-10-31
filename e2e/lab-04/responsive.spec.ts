import { expect, request, test, type Page } from "@playwright/test";
import path from "node:path";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const staff = { email: "e2e.staff@example.com", password: "E2EStaffPassword123" };
const requesterA = { email: "e2e.requester.a@example.com", password: "E2ERequesterPassword123" };
const widths = [{ label: "desktop", width: 1280, height: 900 }, { label: "tablet", width: 820, height: 1000 }, { label: "mobile", width: 390, height: 844 }];

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
}

// RESP-01: no page-level horizontal scroll and no visible control cut off at the right edge, at every width.
async function checkLayouts(page: Page, name: string, anchor: string) {
  for (const { label, width, height } of widths) {
    await page.setViewportSize({ width, height });
    const { scrollWidth, clientWidth, clipped } = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const controls = [...document.querySelectorAll<HTMLElement>("main button, main a, main input, main select, main textarea, main .badge")];
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: viewport,
        clipped: controls.filter((control) => {
          const box = control.getBoundingClientRect();
          return box.width > 0 && (box.left < -1 || box.right > viewport + 1);
        }).map((control) => control.outerHTML.slice(0, 120)),
      };
    });
    expect(scrollWidth, `${name} ${label} overflow`).toBeLessThanOrEqual(clientWidth + 1);
    expect(clipped, `${name} ${label} clipped controls`).toEqual([]);
    await page.getByText(anchor, { exact: true }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.resolve(`artifacts/lab-04/screenshots/responsive/${name}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test("RESP-01 every Lab 4 screen fits at 1280, 820 and 390 px", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  // A long unbroken word in the summary and Action checks wrapping, not just short demo text.
  const summary = `E2E Lab 4 responsive ${Date.now()} Supercalifragilisticexpialidocious-network`;
  const requesterApi = await request.newContext({ baseURL: apiURL });
  expect((await requesterApi.post("/api/auth/login", { data: requesterA })).ok()).toBe(true);
  const category = (await (await requesterApi.get("/api/categories")).json())[0];
  const system = (await (await requesterApi.get("/api/related-systems")).json())[0];
  expect((await requesterApi.post("/api/tickets", {
    data: { categoryId: category.id, relatedSystemId: system.id, summary, description: "Printer queue is stuck.", requestedPriority: "HIGH" },
  })).status()).toBe(201);

  await signIn(page, requesterA);
  await expect(page.getByRole("heading", { name: "Open Tickets", exact: true })).toBeVisible();
  await checkLayouts(page, "requester-dashboard", "Open Tickets");
  await page.getByRole("button", { name: "Logout" }).click();

  await signIn(page, staff);
  await expect(page.getByRole("heading", { name: "Unassigned Tickets", exact: true })).toBeVisible();
  await checkLayouts(page, "staff-dashboard", "Unassigned Tickets");
  await page.getByRole("button", { name: "View Unassigned Tickets in the Ticket Queue" }).click();
  await expect(page.getByText("Unassigned active Tickets")).toBeVisible();
  await checkLayouts(page, "queue-scoped", "Ticket Queue");

  await page.getByLabel("Search Queue").fill(summary);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "Open Detail" }).click();
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
  await checkLayouts(page, "staff-detail-actions", "Actions Taken");

  const description = "Cleared the spooler Supercalifragilisticexpialidocious-print-queue";
  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByRole("textbox", { name: "Description" }).fill(description);
  await checkLayouts(page, "action-create", "Add Action");
  await page.getByRole("button", { name: "Save Action" }).click();
  await expect(page.getByText("Action added.")).toBeVisible();
  const card = page.getByRole("listitem", { name: `Action: ${description}` });

  for (const [button, title, name] of [["Edit", "Edit Action", "action-edit"], ["Complete", "Complete Action", "action-complete"], ["Cancel Action", "Cancel Action", "action-cancel"]] as const) {
    await card.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`^${title}:`) })).toBeVisible();
    await checkLayouts(page, name, `${title}: ${description.slice(0, 60)}`);
    await page.getByRole("button", { name: "Discard form" }).click();
  }
  await card.getByRole("button", { name: "View History" }).click();
  await expect(card.getByText(/Version 1: CREATE/)).toBeVisible();
  await checkLayouts(page, "action-history", "Close History");
  await card.getByRole("button", { name: "Close History" }).click();

  // The new Action is assigned to this Staff user, so My Pending Actions has at least one row.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "View all My Pending Actions" }).click();
  await expect(page.getByRole("button", { name: /^Open Action on / }).first()).toBeVisible();
  await checkLayouts(page, "my-pending-actions", "My Pending Actions");
  await page.getByRole("button", { name: "Logout" }).click();

  await signIn(page, requesterA);
  await page.getByRole("link", { name: "My Tickets" }).click();
  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("listitem", { name: `Action: ${description}` })).toBeVisible();
  await checkLayouts(page, "requester-detail-actions", "Actions Taken");
  await requesterApi.dispose();
});

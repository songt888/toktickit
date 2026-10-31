import { expect, request, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { freshUser, uniqueTag } from "./freshUser.js";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
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
    // Measure the loaded screen, not a loading state.
    await expect(page.locator("main [role=status]:visible").filter({ hasText: /^Loading/ })).toHaveCount(0);
    const { offenders, wideTables, scrollWidth, clientWidth, clipped, spilled } = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const controls = [...document.querySelectorAll<HTMLElement>("main button, main a, main input, main select, main textarea, main .badge")];
      return {
        // Leaf elements reaching past the right edge, so an overflow failure names its cause.
        offenders: [...document.body.querySelectorAll<HTMLElement>("*")]
          .filter((el) => el.children.length === 0 && el.getBoundingClientRect().right > viewport + 1)
          .map((el) => el.outerHTML.slice(0, 120)).slice(0, 5),
        // A visible table that needs sideways scrolling hides its last columns (Owner, Updated, Open Detail).
        wideTables: [...document.querySelectorAll<HTMLElement>("main .table-responsive")]
          .filter((wrap) => wrap.clientWidth > 0 && wrap.scrollWidth > wrap.clientWidth + 1)
          .map((wrap) => `${wrap.scrollWidth}px in ${wrap.clientWidth}px: ${wrap.querySelector("thead")?.textContent?.slice(0, 80)}`),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: viewport,
        clipped: controls.filter((control) => {
          const box = control.getBoundingClientRect();
          return box.width > 0 && (box.left < -1 || box.right > viewport + 1);
        }).map((control) => control.outerHTML.slice(0, 120)),
        // Text wider than its own box: a long word that does not wrap, even if a parent hides it.
        spilled: [...document.querySelectorAll<HTMLElement>("main p, main dd, main td, main li, main div")]
          .filter((el) => [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim()))
          .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && !el.closest(".table-responsive"))
          .map((el) => el.outerHTML.slice(0, 120)),
      };
    });
    expect(scrollWidth, `${name} ${label} overflow: ${offenders.join(" | ")}`).toBeLessThanOrEqual(clientWidth + 1);
    expect(wideTables, `${name} ${label} tables scrolling sideways`).toEqual([]);
    expect(clipped, `${name} ${label} clipped controls`).toEqual([]);
    expect(spilled, `${name} ${label} text wider than its box`).toEqual([]);
    await page.getByText(anchor, { exact: true }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.resolve(`artifacts/lab-04/screenshots/responsive/${name}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test("RESP-01 every Lab 4 screen fits at 1280, 820 and 390 px", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  // Long unbroken names near the 120-character limit, since names sit in flex rows and table cells.
  const staff = await freshUser("resp-staff", "IT_STAFF", `Staff ${"Supercalifragilisticexpialidocious".repeat(3)}`);
  const requesterA = await freshUser("resp-requester", "REQUESTER", `Requester ${"Supercalifragilisticexpialidocious".repeat(3)}`);
  // A long unbroken word in every free-text field checks wrapping, not just short demo text.
  const longWord = "SupercalifragilisticexpialidociousNetworkPrinterQueueFailure";
  const summary = `E2E Lab 4 responsive ${uniqueTag()} SupercalifragilisticexpialidociousNetworkPrinterQueueFailure`;
  const requesterApi = await request.newContext({ baseURL: apiURL });
  expect((await requesterApi.post("/api/auth/login", { data: { email: requesterA.email, password: requesterA.password } })).ok()).toBe(true);
  const category = (await (await requesterApi.get("/api/categories")).json())[0];
  const system = (await (await requesterApi.get("/api/related-systems")).json())[0];
  const created = await requesterApi.post("/api/tickets", {
    data: { categoryId: category.id, relatedSystemId: system.id, summary, description: `Printer queue is stuck: ${longWord}`, requestedPriority: "HIGH" },
  });
  expect(created.status()).toBe(201);
  const ticketId = (await created.json()).id as number;
  expect((await requesterApi.post(`/api/tickets/${ticketId}/comments`, { data: { content: `Still stuck ${longWord}` } })).status()).toBe(201);
  const upload = await requesterApi.post(`/api/tickets/${ticketId}/attachments`, {
    multipart: { file: { name: `${longWord}${longWord}.png`, mimeType: "image/png", buffer: readFileSync(path.resolve("docs/lab-01/screenshots/01-health.png")) } },
  });
  expect(upload.status()).toBe(201);
  const staffApi = await request.newContext({ baseURL: apiURL });
  expect((await staffApi.post("/api/auth/login", { data: { email: staff.email, password: staff.password } })).ok()).toBe(true);
  expect((await staffApi.post(`/api/tickets/${ticketId}/internal-notes`, { data: { content: `Spooler log ${longWord}` } })).status()).toBe(201);
  await staffApi.dispose();

  await signIn(page, requesterA);
  await expect(page.getByRole("heading", { name: "Open Tickets", exact: true })).toBeVisible();
  await checkLayouts(page, "requester-dashboard", "Open Tickets");
  await page.getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByText(summary).first()).toBeVisible();
  await checkLayouts(page, "requester-my-tickets", "My Tickets");
  await page.getByRole("button", { name: "Logout" }).click();

  await signIn(page, staff);
  await expect(page.getByRole("heading", { name: "Unassigned Tickets", exact: true })).toBeVisible();
  await checkLayouts(page, "staff-dashboard", "Unassigned Tickets");
  await page.getByRole("button", { name: "View Unassigned Tickets in the Ticket Queue" }).click();
  await expect(page.getByText("Unassigned active Tickets")).toBeVisible();
  // Wait for this Ticket's row, so the Queue is measured with rows (long requester name included).
  await page.getByLabel("Search Queue").fill(summary);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("row").filter({ hasText: summary })).toBeVisible();
  await checkLayouts(page, "queue-scoped", "Ticket Queue");

  await page.getByRole("row").filter({ hasText: summary }).getByRole("button", { name: "Open Detail" }).click();
  await expect(page.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
  await checkLayouts(page, "staff-detail-actions", "Actions Taken");

  const description = "Cleared the spooler SupercalifragilisticexpialidociousPrintSpoolerQueueRestart";
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
  await page.getByRole("button", { name: "Logout" }).click();

  // User Management lists the long-named Staff user.
  const admin = await freshUser("resp-admin", "ADMINISTRATOR");
  await signIn(page, admin);
  await page.getByRole("link", { name: "User Management" }).click();
  await page.getByLabel("Search name or email").fill(staff.email);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("heading", { name: staff.name })).toBeVisible();
  await checkLayouts(page, "admin-user-management", "User Management");
  await requesterApi.dispose();
});

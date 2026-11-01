import { request, type Page } from "@playwright/test";
import { expect, test } from "./guardedTest.js";
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
async function checkLayouts(page: Page, name: string, anchor: string, sizes = widths) {
  for (const { label, width, height } of sizes) {
    await page.setViewportSize({ width, height });
    // Measure the loaded screen, not a loading state.
    await expect(page.locator("main [role=status]:visible").filter({ hasText: /^Loading/ })).toHaveCount(0);
    const { offenders, wideTables, splitWords, unfinished, scrollWidth, clientWidth, clipped, spilled } = await page.evaluate(() => {
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
        // A short single word (like "Unassigned") squeezed onto two lines by a narrow table column.
        splitWords: [...document.querySelectorAll<HTMLElement>("main td")]
          .filter((cell) => cell.childNodes.length === 1 && cell.firstChild?.nodeType === Node.TEXT_NODE && /^\S{1,20}$/.test(cell.textContent?.trim() ?? ""))
          .filter((cell) => { const range = document.createRange(); range.selectNodeContents(cell); return range.getClientRects().length > 1; })
          .map((cell) => cell.textContent),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: viewport,
        clipped: controls.filter((control) => {
          const box = control.getBoundingClientRect();
          return box.width > 0 && (box.left < -1 || box.right > viewport + 1);
        }).map((control) => control.outerHTML.slice(0, 120)),
        // Labsheet 8.5: no broken links, nameless controls or placeholder text.
        unfinished: [
          ...[...document.querySelectorAll<HTMLElement>('a:not([href]), a[href=""], a[href="#"], a[href^="javascript:"]')].map((el) => `link without a target: ${el.outerHTML.slice(0, 80)}`),
          ...[...document.querySelectorAll<HTMLElement>("button, a")]
            .filter((el) => el.offsetParent !== null && !el.textContent?.trim() && !el.getAttribute("aria-label") && !el.title)
            .map((el) => `control without a name: ${el.outerHTML.slice(0, 80)}`),
          ...(/\b(TODO|TBD|FIXME|lorem ipsum|coming soon|not implemented)\b/i.exec(document.body.innerText) ?? []).slice(0, 1).map((text) => `placeholder text: ${text}`),
        ],
        // Text wider than its own box: a long word that does not wrap, even if a parent hides it.
        spilled: [...document.querySelectorAll<HTMLElement>("main p, main dd, main td, main li, main div")]
          .filter((el) => [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim()))
          .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && !el.closest(".table-responsive"))
          .map((el) => el.outerHTML.slice(0, 120)),
      };
    });
    expect(scrollWidth, `${name} ${label} overflow: ${offenders.join(" | ")}`).toBeLessThanOrEqual(clientWidth + 1);
    expect(wideTables, `${name} ${label} tables scrolling sideways`).toEqual([]);
    expect(splitWords, `${name} ${label} short words split across lines`).toEqual([]);
    expect(clipped, `${name} ${label} clipped controls`).toEqual([]);
    expect(spilled, `${name} ${label} text wider than its box`).toEqual([]);
    expect(unfinished, `${name} ${label} broken links or unfinished controls`).toEqual([]);
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

  // Unassigned Tickets in the two longest statuses, so their badges are measured on purpose in My Tickets and the Queue.
  const statusTickets: Array<{ id: number; status: string; summary: string }> = [];
  for (const [status, steps, words] of [["WAITING_FOR_REQUESTER", ["OPEN", "WAITING_FOR_REQUESTER"], "waiting for requester"], ["IN_PROGRESS", ["IN_PROGRESS"], "in progress"]] as const) {
    const statusSummary = `E2E Lab 4 ${words} ${uniqueTag()}`;
    const made = await requesterApi.post("/api/tickets", {
      data: { categoryId: category.id, relatedSystemId: system.id, summary: statusSummary, description: "Status badge fixture.", requestedPriority: "LOW" },
    });
    expect(made.status()).toBe(201);
    const id = (await made.json()).id as number;
    for (const next of steps) {
      const current = await (await staffApi.get(`/api/staff/tickets/${id}`)).json();
      expect((await staffApi.patch(`/api/staff/tickets/${id}/status`, { data: { status: next, updatedAt: current.updatedAt } })).status()).toBe(200);
    }
    const moved = await (await staffApi.get(`/api/staff/tickets/${id}`)).json();
    expect([moved.currentStatus, moved.owner]).toEqual([status, null]);
    statusTickets.push({ id, status, summary: statusSummary });
  }

  await signIn(page, requesterA);
  await expect(page.getByRole("heading", { name: "Open Tickets", exact: true })).toBeVisible();
  await checkLayouts(page, "requester-dashboard", "Open Tickets");
  await page.getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByText(summary).first()).toBeVisible();
  for (const { status, summary: statusSummary } of statusTickets) await expect(page.getByRole("row").filter({ hasText: statusSummary })).toContainText(status);
  await checkLayouts(page, "requester-my-tickets", "My Tickets");
  await page.getByRole("button", { name: "Logout" }).click();

  // Raise their IT priority now, which updates them last, so they sort first in the Unassigned drill-down whatever other specs did meanwhile.
  for (const { id } of statusTickets) {
    const current = await (await staffApi.get(`/api/staff/tickets/${id}`)).json();
    expect((await staffApi.patch(`/api/staff/tickets/${id}/it-priority`, { data: { itPriority: "MEDIUM", updatedAt: current.updatedAt } })).status()).toBe(200);
  }
  await staffApi.dispose();

  await signIn(page, staff);
  await expect(page.getByRole("heading", { name: "Unassigned Tickets", exact: true })).toBeVisible();
  await checkLayouts(page, "staff-dashboard", "Unassigned Tickets");
  await page.getByRole("button", { name: "View Unassigned Tickets in the Ticket Queue" }).click();
  // The drill-down view itself: scope banner plus its rows. Apply filters clears the scope, so measure it first.
  const banner = page.getByText("Unassigned active Tickets");
  await expect(banner).toBeVisible();
  for (const { status, summary: statusSummary } of statusTickets) await expect(page.getByRole("row").filter({ hasText: statusSummary })).toContainText(status);
  // 992 px is the narrowest width that shows the Queue table instead of cards.
  for (const sizes of [widths, [{ label: "table-992", width: 992, height: 900 }]]) await checkLayouts(page, "queue-scoped", "Ticket Queue", sizes);
  await expect(banner).toBeVisible();

  // Then search for this Ticket, so its row (long summary and requester name) is measured.
  await page.getByLabel("Search Queue").fill(summary);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("row").filter({ hasText: summary })).toBeVisible();
  for (const sizes of [widths, [{ label: "table-992", width: 992, height: 900 }]]) await checkLayouts(page, "queue-search", "Ticket Queue", sizes);

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

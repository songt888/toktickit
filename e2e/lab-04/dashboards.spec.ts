import { expect, request, test, type Page } from "@playwright/test";
import path from "node:path";
import { getPrisma } from "../../server/src/prisma.js";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const requesterA = { email: "e2e.requester.a@example.com", password: "E2ERequesterPassword123" };
const requesterB = { email: "e2e.requester.b@example.com", password: "E2ERequesterPassword123" };
const prisma = getPrisma();

test.afterAll(() => prisma.$disconnect());

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  const dashboard = page.waitForResponse((response) => response.url().endsWith("/api/dashboard/requester") && response.status() === 200);
  await page.getByRole("button", { name: "Sign In" }).click();
  return (await dashboard).json();
}

// The specification section 7 predicates as plain SQL, for the given snapshot window.
async function databaseCounts(email: string, recentFrom: string, asOf: string) {
  const [row] = await prisma.$queryRaw<Array<{ open: bigint; waiting: bigint; resolved: bigint }>>`
    SELECT
      COUNT(*) FILTER (WHERE t."currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')) AS open,
      COUNT(*) FILTER (WHERE t."currentStatus" = 'WAITING_FOR_REQUESTER') AS waiting,
      COUNT(*) FILTER (WHERE t."currentStatus" IN ('RESOLVED','CLOSED') AND t."lastResolvedAt" BETWEEN ${new Date(recentFrom)} AND ${new Date(asOf)}) AS resolved
    FROM "Ticket" t JOIN "User" u ON u.id = t."requesterId" WHERE u.email = ${email}`;
  return { openTickets: Number(row.open), waitingForRequester: Number(row.waiting), recentlyResolved: Number(row.resolved) };
}

const cardValue = (page: Page, title: string) =>
  page.getByRole("heading", { name: title, exact: true }).locator("xpath=following-sibling::p[1]");

async function drillDownTotal(page: Page, button: string) {
  const list = page.waitForResponse((response) => response.url().includes("/api/tickets?") && response.status() === 200);
  await page.getByRole("button", { name: button }).click();
  const body = await (await list).json();
  await expect(page.getByText("Showing Dashboard filter:")).toBeVisible();
  return { url: (await list).url(), total: body.pagination.totalItems as number };
}

test("E2E-03 Requester Dashboard matches the database, drills down exactly and stays owner-scoped", async ({ page }) => {
  // Make sure Requester A has a recently updated Ticket waiting for them.
  const api = await request.newContext({ baseURL: apiURL });
  await api.post("/api/auth/login", { data: requesterA });
  const category = (await (await api.get("/api/categories")).json())[0];
  const system = (await (await api.get("/api/related-systems")).json())[0];
  const summary = `E2E Lab 4 dashboard ${Date.now()}`;
  const created = await (await api.post("/api/tickets", {
    data: { categoryId: category.id, relatedSystemId: system.id, summary, description: "Dashboard fixture.", requestedPriority: "LOW" },
  })).json();
  await prisma.ticket.update({ where: { id: created.id }, data: { currentStatus: "WAITING_FOR_REQUESTER" } });
  await api.dispose();

  const dashboard = await signIn(page, requesterA);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  const expected = await databaseCounts(requesterA.email, dashboard.recentFrom, dashboard.asOf);
  expect(dashboard.metrics).toEqual(expected);
  await expect(cardValue(page, "Open Tickets")).toHaveText(String(expected.openTickets));
  await expect(cardValue(page, "Waiting for You")).toHaveText(String(expected.waitingForRequester));
  await expect(cardValue(page, "Recently Resolved")).toHaveText(String(expected.recentlyResolved));
  expect(expected.waitingForRequester).toBeGreaterThan(0);
  await expect(page.getByText(summary)).toBeVisible();

  for (const { label, width, height } of [{ label: "desktop", width: 1280, height: 900 }, { label: "tablet", width: 820, height: 1000 }, { label: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize({ width, height });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(scrollWidth, label).toBeLessThanOrEqual(clientWidth + 1);
    await page.screenshot({ path: path.resolve(`artifacts/lab-04/screenshots/requester-dashboard/requester-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Each card's drill-down list total equals the card.
  const open = await drillDownTotal(page, "View Open Tickets in My Tickets");
  expect(open.url).toContain("statusGroup=active");
  expect(open.total).toBe(expected.openTickets);
  await page.getByRole("link", { name: "Dashboard" }).click();
  const waiting = await drillDownTotal(page, "View Waiting for You in My Tickets");
  expect(waiting.url).toContain("currentStatus=WAITING_FOR_REQUESTER");
  expect(waiting.total).toBe(expected.waitingForRequester);
  await expect(page.getByRole("row").filter({ hasText: summary })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  const resolved = await drillDownTotal(page, "View Recently Resolved in My Tickets");
  expect(resolved.url).toContain("statusGroup=resolved");
  expect(resolved.total).toBe(expected.recentlyResolved);

  await page.getByRole("button", { name: "Clear Dashboard filter" }).click();
  await expect(page.getByText("Showing Dashboard filter:")).toHaveCount(0);

  // A recent Ticket opens its own Detail.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: `Open Detail for ${created.ticketNumber}` }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ticket Information" }).getByText(summary)).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();

  // Requester B sees only their own numbers and cannot ask for A's.
  const dashboardB = await signIn(page, requesterB);
  expect(dashboardB.metrics).toEqual(await databaseCounts(requesterB.email, dashboardB.recentFrom, dashboardB.asOf));
  await expect(page.getByText(summary)).toHaveCount(0);
  const apiB = await request.newContext({ baseURL: apiURL });
  await apiB.post("/api/auth/login", { data: requesterB });
  const userA = await prisma.user.findUniqueOrThrow({ where: { email: requesterA.email } });
  expect((await apiB.get(`/api/dashboard/requester?requesterId=${userA.id}`)).status()).toBe(400);
  const listB = await (await apiB.get(`/api/tickets?requesterId=${userA.id}&pageSize=50`)).json();
  expect(listB.items.some((item: { id: number }) => item.id === created.id)).toBe(false);
  await apiB.dispose();
});

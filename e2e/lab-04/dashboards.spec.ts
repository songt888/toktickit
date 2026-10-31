import { expect, request, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { getPrisma } from "../../server/src/prisma.js";
import { hashPassword } from "../../server/src/password.js";

const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const password = "E2EDashboardPassword123";
const prisma = getPrisma();
const DAY = 86_400_000;

test.afterAll(() => prisma.$disconnect());

// Fresh Requesters per run, so no other spec or worker can change these counts.
async function freshRequester(label: string, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR" = "REQUESTER") {
  const email = `e2e.dashboard.${label}.${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: { name: `E2E Dashboard ${label}`, email, role, isActive: true, passwordHash: hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date() },
  });
  return { id: user.id, email, password };
}

async function signIn(page: Page, user: { email: string; password: string }, kind: "requester" | "staff" = "requester") {
  await page.goto("/");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  const dashboard = page.waitForResponse((response) => response.url().endsWith(`/api/dashboard/${kind}`) && response.status() === 200);
  await page.getByRole("button", { name: "Sign In" }).click();
  return (await dashboard).json();
}

// The specification section 7 predicates as plain SQL, for the given snapshot window.
async function databaseSnapshot(requesterId: number, recentFrom: string, asOf: string) {
  const [from, to] = [new Date(recentFrom), new Date(asOf)];
  const [row] = await prisma.$queryRaw<Array<{ open: bigint; waiting: bigint; resolved: bigint; recent: bigint }>>`
    SELECT
      COUNT(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')) AS open,
      COUNT(*) FILTER (WHERE "currentStatus" = 'WAITING_FOR_REQUESTER') AS waiting,
      COUNT(*) FILTER (WHERE "currentStatus" IN ('RESOLVED','CLOSED') AND "lastResolvedAt" BETWEEN ${from} AND ${to}) AS resolved,
      COUNT(*) FILTER (WHERE "updatedAt" BETWEEN ${from} AND ${to}) AS recent
    FROM "Ticket" WHERE "requesterId" = ${requesterId}`;
  return {
    metrics: { openTickets: Number(row.open), waitingForRequester: Number(row.waiting), recentlyResolved: Number(row.resolved) },
    recent: Number(row.recent),
  };
}

const cardValue = (page: Page, title: string) =>
  page.getByRole("heading", { name: title, exact: true }).locator("xpath=following-sibling::p[1]");

// Returns the Dashboard snapshot on screen at the click, since every visit reloads it.
async function drillDown(page: Page, button: string) {
  // Leave first, so returning to the Dashboard always reloads it.
  await page.getByRole("link", { name: "My Tickets" }).click();
  const reloaded = page.waitForResponse((response) => response.url().endsWith("/api/dashboard/requester") && response.status() === 200);
  await page.getByRole("link", { name: "Dashboard" }).click();
  const snapshot = await (await reloaded).json();
  await expect(page.getByText("Refreshing your Dashboard…")).toHaveCount(0);
  const list = page.waitForResponse((response) => response.url().includes("/api/tickets?") && response.status() === 200);
  await page.getByRole("button", { name: button }).click();
  const response = await list;
  await expect(page.getByText("Showing Dashboard filter:")).toBeVisible();
  const body = await response.json();
  return { snapshot, query: new URL(response.url()).searchParams, total: body.pagination.totalItems as number, numbers: body.items.map((item: { ticketNumber: string }) => item.ticketNumber) };
}

test("E2E-03 Requester Dashboard matches the database, drills down exactly and stays owner-scoped", async ({ page }) => {
  const owner = await freshRequester("owner");
  const stranger = await freshRequester("stranger");

  // Seven Tickets for the owner: six statuses inside the window plus one resolved long ago.
  const api = await request.newContext({ baseURL: apiURL });
  await api.post("/api/auth/login", { data: owner });
  const category = (await (await api.get("/api/categories")).json())[0];
  const system = (await (await api.get("/api/related-systems")).json())[0];
  const created: Array<{ id: number; ticketNumber: string; summary: string }> = [];
  for (const label of ["new", "waiting", "progress", "resolved", "closed", "cancelled", "old"]) {
    const summary = `E2E dashboard ${label} ${Date.now()}`;
    const response = await api.post("/api/tickets", {
      data: { categoryId: category.id, relatedSystemId: system.id, summary, description: "Dashboard fixture.", requestedPriority: "LOW" },
    });
    created.push({ ...(await response.json()), summary });
  }
  await api.dispose();
  const now = Date.now();
  const set = (index: number, data: Record<string, unknown>) => prisma.ticket.update({ where: { id: created[index].id }, data });
  await set(1, { currentStatus: "WAITING_FOR_REQUESTER" });
  await set(2, { currentStatus: "IN_PROGRESS" });
  await set(3, { currentStatus: "RESOLVED", lastResolvedAt: new Date(now - DAY) });
  await set(4, { currentStatus: "CLOSED", lastResolvedAt: new Date(now - 2 * DAY) });
  await set(5, { currentStatus: "CANCELLED" });
  await prisma.$executeRaw`UPDATE "Ticket" SET "currentStatus" = 'CLOSED', "lastResolvedAt" = ${new Date(now - 20 * DAY)}, "updatedAt" = ${new Date(now - 20 * DAY)} WHERE id = ${created[6].id}`;

  const dashboard = await signIn(page, owner);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  const expected = await databaseSnapshot(owner.id, dashboard.recentFrom, dashboard.asOf);
  expect(expected.metrics).toEqual({ openTickets: 3, waitingForRequester: 1, recentlyResolved: 2 });
  expect(dashboard.metrics).toEqual(expected.metrics);
  await expect(cardValue(page, "Open Tickets")).toHaveText("3");
  await expect(cardValue(page, "Waiting for You")).toHaveText("1");
  await expect(cardValue(page, "Recently Resolved")).toHaveText("2");
  const shown = dashboard.recentTickets.map((ticket: { ticketNumber: string }) => ticket.ticketNumber);
  expect(shown).toHaveLength(5);
  expect(shown).not.toContain(created[6].ticketNumber);

  for (const { label, width, height } of [{ label: "desktop", width: 1280, height: 900 }, { label: "tablet", width: 820, height: 1000 }, { label: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize({ width, height });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(scrollWidth, label).toBeLessThanOrEqual(clientWidth + 1);
    await page.screenshot({ path: path.resolve(`artifacts/lab-04/screenshots/requester-dashboard/requester-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Every card and View all: the list uses the exact predicate and its total equals the Dashboard.
  const open = await drillDown(page, "View Open Tickets in My Tickets");
  expect([open.query.get("statusGroup"), open.total]).toEqual(["active", 3]);
  const waiting = await drillDown(page, "View Waiting for You in My Tickets");
  expect([waiting.query.get("currentStatus"), waiting.numbers]).toEqual(["WAITING_FOR_REQUESTER", [created[1].ticketNumber]]);
  const resolved = await drillDown(page, "View Recently Resolved in My Tickets");
  expect([resolved.query.get("statusGroup"), resolved.query.get("resolvedFrom"), resolved.query.get("resolvedTo"), resolved.total])
    .toEqual(["resolved", resolved.snapshot.recentFrom, resolved.snapshot.asOf, 2]);
  const recent = await drillDown(page, "View all recently updated");
  expect([recent.query.get("updatedFrom"), recent.query.get("updatedTo")]).toEqual([recent.snapshot.recentFrom, recent.snapshot.asOf]);
  expect(recent.total).toBe((await databaseSnapshot(owner.id, recent.snapshot.recentFrom, recent.snapshot.asOf)).recent);
  expect(recent.total).toBe(6);
  expect(recent.numbers.slice(0, 5)).toEqual(shown);
  await page.getByRole("button", { name: "Clear Dashboard filter" }).click();
  await expect(page.getByText("Showing Dashboard filter:")).toHaveCount(0);

  // A recent Ticket opens its own Detail, and Back returns to the Dashboard.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: `Open Detail for ${shown[0]}` }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ticket Information" }).getByText(shown[0])).toBeVisible();
  await page.getByRole("button", { name: "Back to Dashboard" }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Logout" }).click();

  // Another Requester sees zeros, none of the owner's Tickets, and cannot ask for them.
  const strangerDashboard = await signIn(page, stranger);
  expect(strangerDashboard.metrics).toEqual({ openTickets: 0, waitingForRequester: 0, recentlyResolved: 0 });
  expect(strangerDashboard.recentTickets).toEqual([]);
  await expect(cardValue(page, "Open Tickets")).toHaveText("0");
  const strangerApi = await request.newContext({ baseURL: apiURL });
  await strangerApi.post("/api/auth/login", { data: stranger });
  expect((await strangerApi.get(`/api/dashboard/requester?requesterId=${owner.id}`)).status()).toBe(400);
  expect((await (await strangerApi.get(`/api/tickets?requesterId=${owner.id}&pageSize=50`)).json()).items).toEqual([]);
  await strangerApi.dispose();
});

// The specification section 7 Staff predicates as plain SQL. Ticket counts are global, so callers
// compare them only when nothing changed around the Dashboard read (other workers write Tickets).
async function staffReference(userId: number) {
  const [row] = await prisma.$queryRaw<Array<Record<string, bigint>>>`
    SELECT
      COUNT(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') AND "ownerId" IS NULL) AS unassigned,
      COUNT(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') AND "ownerId" = ${userId}) AS mine,
      (SELECT COUNT(*) FROM "ActionTaken" a JOIN "Ticket" t ON t.id = a."ticketId" WHERE a."assigneeId" = ${userId}
        AND a.status IN ('PLANNED','IN_PROGRESS') AND t."currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')) AS actions
    FROM "Ticket"`;
  return { unassignedTickets: Number(row.unassigned), myTickets: Number(row.mine), myActions: Number(row.actions) };
}

async function staffDashboardMatchesDatabase(page: Page, userId: number) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const before = await staffReference(userId);
    const reloaded = page.waitForResponse((response) => response.url().endsWith("/api/dashboard/staff") && response.status() === 200);
    await page.getByRole("button", { name: "Refresh" }).click();
    const snapshot = await (await reloaded).json();
    const after = await staffReference(userId);
    const shown = { unassignedTickets: snapshot.metrics.unassignedTickets, myTickets: snapshot.metrics.myTickets, myActions: snapshot.metrics.myActions };
    if (JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(shown) === JSON.stringify(before)) return snapshot;
  }
  throw new Error("Staff Dashboard never matched the database");
}

async function queueDrillDown(page: Page, button: string | RegExp) {
  await page.getByRole("link", { name: "Ticket Queue" }).click();
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("button", { name: "Refresh" })).toBeEnabled();
  const list = page.waitForResponse((response) => response.url().includes("/api/staff/tickets?") && response.status() === 200);
  await page.getByRole("button", { name: button }).click();
  const response = await list;
  await expect(page.getByText("Showing Dashboard filter:")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
  const body = await response.json();
  return { query: Object.fromEntries(new URL(response.url()).searchParams), total: body.pagination.totalItems as number, numbers: body.items.map((item: { ticketNumber: string }) => item.ticketNumber) };
}

test("E2E-03 Staff and Administrator Dashboards match the database, drill down exactly and open assigned Actions", async ({ page }) => {
  const requester = await freshRequester("staff-requester");
  const staff = await freshRequester("staff", "IT_STAFF");
  const admin = await freshRequester("admin", "ADMINISTRATOR");

  // Two Tickets: one owned by the Staff user (urgent), one unassigned.
  const requesterApi = await request.newContext({ baseURL: apiURL });
  await requesterApi.post("/api/auth/login", { data: requester });
  const category = (await (await requesterApi.get("/api/categories")).json())[0];
  const system = (await (await requesterApi.get("/api/related-systems")).json())[0];
  const tickets: Array<{ id: number; ticketNumber: string }> = [];
  for (const label of ["owned", "unassigned"]) {
    const response = await requesterApi.post("/api/tickets", {
      data: { categoryId: category.id, relatedSystemId: system.id, summary: `E2E staff dashboard ${label} ${Date.now()}`, description: "Staff Dashboard fixture.", requestedPriority: "LOW" },
    });
    tickets.push(await response.json());
  }
  expect((await requesterApi.get("/api/dashboard/staff")).status()).toBe(403);
  await requesterApi.dispose();
  await prisma.ticket.update({ where: { id: tickets[0].id }, data: { ownerId: staff.id, currentStatus: "OPEN", itPriority: "URGENT" } });

  // Two Actions by the Staff user: one assigned to themself, one assigned to the Administrator.
  const staffApi = await request.newContext({ baseURL: apiURL });
  await staffApi.post("/api/auth/login", { data: staff });
  const actionIds: number[] = [];
  for (const [description, assigneeId] of [["E2E staff own Action", staff.id], ["E2E Action for the Administrator", admin.id]] as const) {
    const { updatedAt } = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } });
    const response = await staffApi.post(`/api/tickets/${tickets[0].id}/actions-taken`, {
      data: { mutationId: randomUUID(), ticketUpdatedAt: updatedAt.toISOString(), actionAt: new Date().toISOString(), description, followUpRequired: false, assigneeId },
    });
    expect(response.status(), `${description}: ${await response.text()}`).toBe(201);
    actionIds.push((await response.json()).action.id);
  }
  await staffApi.dispose();

  await signIn(page, staff, "staff");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  const snapshot = await staffDashboardMatchesDatabase(page, staff.id);
  expect([snapshot.metrics.myTickets, snapshot.metrics.myActions]).toEqual([1, 1]);
  expect(snapshot.myActions.map((item: { id: number }) => item.id)).toEqual([actionIds[0]]);
  expect(snapshot.urgentTickets.map((item: { id: number }) => item.id)).toContain(tickets[0].id);
  await expect(cardValue(page, "Unassigned Tickets")).toHaveText(String(snapshot.metrics.unassignedTickets));
  await expect(cardValue(page, "My Tickets")).toHaveText("1");

  for (const { label, width, height } of [{ label: "desktop", width: 1280, height: 900 }, { label: "tablet", width: 820, height: 1000 }, { label: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize({ width, height });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(scrollWidth, label).toBeLessThanOrEqual(clientWidth + 1);
    await page.screenshot({ path: path.resolve(`artifacts/lab-04/screenshots/staff-dashboard/staff-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Keyboard: a card action takes focus with a visible indicator.
  const unassignedButton = page.getByRole("button", { name: "View Unassigned Tickets in the Ticket Queue" });
  await unassignedButton.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(unassignedButton).toBeFocused();
  expect(await unassignedButton.evaluate((el) => { const style = getComputedStyle(el); return style.outlineStyle !== "none" || style.boxShadow !== "none"; })).toBe(true);

  // Each card and bucket opens the Queue with its exact filter; owner-scoped totals are exact.
  const unassigned = await queueDrillDown(page, "View Unassigned Tickets in the Ticket Queue");
  expect(unassigned.query).toMatchObject({ statusGroup: "active", ownerId: "unassigned" });
  expect(unassigned.numbers).toContain(tickets[1].ticketNumber);
  const mine = await queueDrillDown(page, "View My Tickets in the Ticket Queue");
  expect([mine.query.statusGroup, mine.query.ownerId, mine.numbers]).toEqual(["active", String(staff.id), [tickets[0].ticketNumber]]);
  const urgent = await queueDrillDown(page, "View all urgent");
  expect(urgent.query).toMatchObject({ statusGroup: "active", itPriority: "URGENT" });
  expect(urgent.numbers).toContain(tickets[0].ticketNumber);
  const closed = await queueDrillDown(page, /^Closed: \d+ Tickets/);
  expect(closed.query).toMatchObject({ currentStatus: "CLOSED" });
  const recent = await queueDrillDown(page, "View all recently updated");
  expect(Object.keys(recent.query)).toEqual(expect.arrayContaining(["updatedFrom", "updatedTo"]));
  await page.getByRole("button", { name: "Clear Dashboard filter" }).click();
  await expect(page.getByText("Showing Dashboard filter:")).toHaveCount(0);

  // Open Action lands on the operational Detail with that Action focused; Back returns to the Dashboard.
  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: `Open Action on ${tickets[0].ticketNumber}` }).click();
  await expect(page.getByRole("heading", { name: "Operational Ticket Detail" })).toBeVisible();
  await expect(page.locator(`#action-${actionIds[0]}`)).toBeFocused();
  await page.getByRole("button", { name: "Back to Dashboard" }).click();
  await page.getByRole("button", { name: "View all My Pending Actions" }).click();
  await expect(page.getByRole("heading", { name: "My Pending Actions", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open Action on / })).toHaveCount(1);
  await page.getByRole("button", { name: "Logout" }).click();

  // The Administrator sees the same Dashboard with only their own assignment.
  const adminSnapshot = await signIn(page, admin, "staff");
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  expect([adminSnapshot.metrics.myTickets, adminSnapshot.metrics.myActions]).toEqual([0, 1]);
  expect(adminSnapshot.myActions.map((item: { id: number }) => item.id)).toEqual([actionIds[1]]);
  await expect(page.getByRole("link", { name: "User Management" })).toBeVisible();
});

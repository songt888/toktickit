// Lab 4 Issues 6 and 7: Requester and Staff/Admin Dashboards (api-spec sections 5-6, specification section 7).
import type { Express, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { requireRole } from "./auth.js";
import { getPrisma } from "./prisma.js";
import { activeTicketStatuses, resolvedTicketStatuses, ticketStatuses, ticketPriorities } from "./ticketQuery.js";

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LIST_LIMIT = 5;

export const dashboardTicketSelect = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  itPriority: true,
  owner: { select: { id: true, name: true } },
  updatedAt: true,
  lastResolvedAt: true,
} as const;

type DashboardTicket = Prisma.TicketGetPayload<{ select: typeof dashboardTicketSelect }>;

export const toDashboardTicket = (ticket: DashboardTicket) => ({ ...ticket, summary: ticket.summary.slice(0, 240) });

// asOf is captured once; both bounds are inclusive and later timestamps are excluded (rolling UTC window).
export function dashboardWindow(now = new Date()) {
  return { asOf: now, recentFrom: new Date(now.getTime() - RECENT_WINDOW_MS) };
}

// M: the session user's pending Actions on active Tickets. Assignment decides, not who performed it.
const myActionsWhere = (assigneeId: number): Prisma.ActionTakenWhereInput => ({
  assigneeId,
  status: { in: ["PLANNED", "IN_PROGRESS"] },
  ticket: { currentStatus: { in: activeTicketStatuses } },
});
const myActionsOrder: Prisma.ActionTakenOrderByWithRelationInput[] = [{ updatedAt: "desc" }, { id: "desc" }];
const actionSummarySelect = {
  id: true, ticketId: true, description: true, status: true, updatedAt: true, ticket: { select: { ticketNumber: true } },
} as const;
const toActionSummary = ({ ticket, description, ...action }: Prisma.ActionTakenGetPayload<{ select: typeof actionSummarySelect }>) =>
  ({ ...action, ticketNumber: ticket.ticketNumber, description: description.slice(0, 160) });

// Every bucket is present, zero included.
const buckets = <K extends string>(keys: readonly K[], rows: Array<{ key: K; count: number }>) =>
  Object.fromEntries(keys.map((key) => [key, rows.find((row) => row.key === key)?.count ?? 0])) as Record<K, number>;

const staffActionsQuery = { assigneeId: "me", statusGroup: "pending", ticketStatusGroup: "active" } as const;

export function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/staff", requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: Request, res: Response) => {
    if (Object.keys(req.query).length > 0) {
      res.status(400).json({ error: "This endpoint takes no query parameters" });
      return;
    }
    const userId = (res.locals.authUser as { id: number }).id;
    const { asOf, recentFrom } = dashboardWindow();
    const active = { currentStatus: { in: activeTicketStatuses } };
    const order: Prisma.TicketOrderByWithRelationInput[] = [{ updatedAt: "desc" }, { id: "desc" }];
    try {
      const db = getPrisma();
      const [unassignedTickets, myTickets, myActions, byStatus, byItPriority, myActionList, recentTickets, urgentTickets] = await db.$transaction(
        [
          db.ticket.count({ where: { ...active, ownerId: null } }),
          db.ticket.count({ where: { ...active, ownerId: userId } }),
          db.actionTaken.count({ where: myActionsWhere(userId) }),
          db.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true }, orderBy: { currentStatus: "asc" } }),
          db.ticket.groupBy({ by: ["itPriority"], where: active, _count: { _all: true }, orderBy: { itPriority: "asc" } }),
          db.actionTaken.findMany({ where: myActionsWhere(userId), orderBy: myActionsOrder, take: LIST_LIMIT, select: actionSummarySelect }),
          db.ticket.findMany({ where: { updatedAt: { gte: recentFrom, lte: asOf } }, orderBy: order, take: LIST_LIMIT, select: dashboardTicketSelect }),
          db.ticket.findMany({ where: { ...active, itPriority: "URGENT" }, orderBy: order, take: LIST_LIMIT, select: dashboardTicketSelect }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      res.status(200).json({
        asOf,
        recentFrom,
        displayTimeZone: "Asia/Bangkok",
        metrics: {
          unassignedTickets,
          myTickets,
          myActions,
          byStatus: buckets(ticketStatuses, byStatus.map((row) => ({ key: row.currentStatus, count: (row._count as { _all: number })._all }))),
          byItPriority: buckets(ticketPriorities, byItPriority.map((row) => ({ key: row.itPriority, count: (row._count as { _all: number })._all }))),
        },
        myActions: myActionList.map(toActionSummary),
        recentTickets: recentTickets.map(toDashboardTicket),
        urgentTickets: urgentTickets.map(toDashboardTicket),
      });
    } catch {
      res.status(500).json({ error: "Unable to load the Dashboard" });
    }
  });

  // The exact myActions drill-down: scope values are fixed, so no other user's Actions can be asked for.
  app.get("/api/staff/actions-taken", requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: Request, res: Response) => {
    const query = req.query as Record<string, unknown>;
    const allowed = [...Object.keys(staffActionsQuery), "page", "pageSize"];
    const scopeOk = Object.entries(staffActionsQuery).every(([key, value]) => query[key] === undefined || query[key] === value);
    const page = query.page === undefined ? 1 : Number(query.page);
    const pageSize = query.pageSize === undefined ? 10 : Number(query.pageSize);
    if (
      Object.keys(query).some((key) => !allowed.includes(key)) || !scopeOk ||
      (query.page !== undefined && (!/^\d+$/.test(String(query.page)) || !Number.isSafeInteger(page) || page < 1 || page > 2_147_483_647)) ||
      (query.pageSize !== undefined && !/^\d+$/.test(String(query.pageSize))) || ![10, 25, 50].includes(pageSize)
    ) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }
    const where = myActionsWhere((res.locals.authUser as { id: number }).id);
    try {
      const db = getPrisma();
      const [totalItems, items] = await db.$transaction([
        db.actionTaken.count({ where }),
        db.actionTaken.findMany({ where, orderBy: myActionsOrder, skip: (page - 1) * pageSize, take: pageSize, select: actionSummarySelect }),
      ]);
      res.status(200).json({ items: items.map(toActionSummary), pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } });
    } catch {
      res.status(500).json({ error: "Unable to load your pending Actions" });
    }
  });

  app.get("/api/dashboard/requester", requireRole("REQUESTER"), async (req: Request, res: Response) => {
    if (Object.keys(req.query).length > 0) {
      res.status(400).json({ error: "This endpoint takes no query parameters" });
      return;
    }
    // Ownership always comes from the session, never from the request.
    const requesterId = (res.locals.authUser as { id: number }).id;
    const { asOf, recentFrom } = dashboardWindow();
    const window = { gte: recentFrom, lte: asOf };
    try {
      const db = getPrisma();
      const [openTickets, waitingForRequester, recentlyResolved, recentTickets] = await db.$transaction(
        [
          db.ticket.count({ where: { requesterId, currentStatus: { in: activeTicketStatuses } } }),
          db.ticket.count({ where: { requesterId, currentStatus: "WAITING_FOR_REQUESTER" } }),
          db.ticket.count({ where: { requesterId, currentStatus: { in: resolvedTicketStatuses }, lastResolvedAt: window } }),
          db.ticket.findMany({
            where: { requesterId, updatedAt: window },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: LIST_LIMIT,
            select: dashboardTicketSelect,
          }),
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      res.status(200).json({
        asOf,
        recentFrom,
        displayTimeZone: "Asia/Bangkok",
        metrics: { openTickets, waitingForRequester, recentlyResolved },
        recentTickets: recentTickets.map(toDashboardTicket),
      });
    } catch {
      res.status(500).json({ error: "Unable to load the Dashboard" });
    }
  });
}

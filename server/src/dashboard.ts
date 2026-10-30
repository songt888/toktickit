// Lab 4 Issue 6: Requester Dashboard (api-spec section 5, specification section 7).
import type { Express, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { requireRole } from "./auth.js";
import { getPrisma } from "./prisma.js";
import { activeTicketStatuses, resolvedTicketStatuses } from "./ticketQuery.js";

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

export function registerDashboardRoutes(app: Express) {
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

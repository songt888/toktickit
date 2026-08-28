import express, { Request, Response } from "express";
import cors from "cors";
import { TicketPriority } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { parseRequesterId, REQUESTER_CONTEXT_ERROR } from "./requesterContext.js";
import { getNextTicketNumber } from "./ticketNumber.js";
import { validateCreateTicketInput } from "./ticketValidation.js";
// getPrisma() is your lazy database handle. Call it INSIDE a route when you
// need the DB (Issue 4). It is intentionally unused until then.
void getPrisma;

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// API status/data responses must be revalidated on every request so clients
// receive HTTP 200 instead of a browser cache-based 304 response.
app.disable("etag");
app.use((_req: Request, res: Response, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// Lab 2 Issue 3 — Development Requester context
// This is a temporary testing selector, not authentication.
// The `active=true` query is an explicit contract marker; this endpoint is intentionally active-only.
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" },
    });

    res.status(200).json(requesters);
  } catch {
    res.status(500).json({ error: "Unable to load requesters" });
  }
});

// ---------------------------------------------------------------------------
// Lab 2 Issue 4 — Create Ticket reference data and workflow
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const systems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    res.status(200).json(systems);
  } catch {
    res.status(500).json({ error: "Unable to load related systems" });
  }
});

class ReferenceNotFoundError extends Error {}

app.post("/api/tickets", async (req: Request, res: Response) => {
  const requesterId = parseRequesterId(req);
  if (requesterId === null) {
    res.status(400).json({ error: REQUESTER_CONTEXT_ERROR });
    return;
  }

  const { value, errors } = validateCreateTicketInput(req.body);
  if (!value) {
    res.status(400).json({ error: "Validation failed", fieldErrors: errors });
    return;
  }

  try {
    const ticket = await getPrisma().$transaction(async (transaction) => {
      const requester = await transaction.requesterUser.findFirst({
        where: { id: requesterId, isActive: true },
        select: { id: true },
      });
      if (!requester) throw new ReferenceNotFoundError();

      const [category, relatedSystem] = await Promise.all([
        transaction.category.findFirst({
          where: { id: value.categoryId, isActive: true },
          select: { id: true },
        }),
        transaction.relatedSystem.findFirst({
          where: { id: value.relatedSystemId, isActive: true },
          select: { id: true },
        }),
      ]);
      if (!category || !relatedSystem) throw new ReferenceNotFoundError();

      const ticketDate = new Date();
      const ticketNumber = await getNextTicketNumber(transaction, ticketDate);

      return transaction.ticket.create({
        data: {
          ticketNumber,
          ticketDate,
          requesterId,
          categoryId: value.categoryId,
          relatedSystemId: value.relatedSystemId,
          summary: value.summary,
          description: value.description,
          requestedPriority: value.requestedPriority as TicketPriority,
          currentStatus: "NEW",
        },
        select: {
          id: true,
          ticketNumber: true,
          ticketDate: true,
          requesterId: true,
          categoryId: true,
          relatedSystemId: true,
          summary: true,
          description: true,
          requestedPriority: true,
          currentStatus: true,
        },
      });
    });

    res.status(201).json(ticket);
  } catch (error) {
    if (error instanceof ReferenceNotFoundError) {
      res.status(404).json({ error: "Requester or reference data not found" });
      return;
    }

    res.status(500).json({ error: "Unable to create ticket" });
  }
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// Add:  GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message (no internal details)
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    res.status(200).json(categories);
  } catch {
    res.status(500).json({ error: "Unable to load categories" });
  }
});
// ---------------------------------------------------------------------------

export default app;

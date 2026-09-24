import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { TicketPriority } from "@prisma/client";
import type { TicketStatus } from "@prisma/client";
import multer, { MulterError } from "multer";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./password.js";
import {
  AUTH_USER_SELECT,
  clearSessionCookie,
  createSession,
  hasAllowedOrigin,
  requireSession,
  requirePasswordChangeComplete,
  requireRole,
  revokeCurrentSession,
  toSafeUser,
  validatePassword,
} from "./auth.js";
import { getPrisma } from "./prisma.js";
import { getNextTicketNumber } from "./ticketNumber.js";
import {
  isPermittedStatusTransition,
  permittedStatusTransitions,
  statusTransitionNeedsConfirmation,
} from "./statusTransition.js";
import {
  buildTicketOrderBy,
  buildTicketWhere,
  buildStaffTicketOrderBy,
  buildStaffTicketWhere,
  parseTicketListQuery,
  parseStaffTicketListQuery,
} from "./ticketQuery.js";
import {
  attachmentLimits,
  validateCommentContent,
  validateAttachment,
  validateCreateTicketInput,
  validateRemovalReason,
} from "./ticketValidation.js";
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

// Browser requests use the Vite /api proxy in local development, so the
// session cookie remains same-origin and the API does not expose credentialed CORS.
app.use((req: Request, res: Response, next) => {
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method) && !hasAllowedOrigin(req)) {
    res.status(403).json({ error: "Request origin is not allowed" });
    return;
  }
  next();
});
app.use(express.json());

const attachmentStorageDir = path.resolve(
  process.env.ATTACHMENT_STORAGE_DIR ?? path.join(process.cwd(), "uploads"),
);
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: attachmentLimits.maxBytes, files: 1 },
}).single("file");

function parsePositiveId(value: string): number | null {
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function requireTicketId(req: Request, res: Response, next: () => void): void {
  const ticketId = parsePositiveId(req.params.id);
  if (ticketId === null) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }

  res.locals.ticketId = ticketId;
  next();
}

function handleAttachmentUpload(req: Request, res: Response, next: () => void): void {
  attachmentUpload(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Each attachment must be 5 MB or smaller" });
      return;
    }

    if (error instanceof MulterError) {
      res.status(400).json({ error: "Invalid attachment upload" });
      return;
    }

    res.status(500).json({ error: "Unable to upload attachment" });
  });
}

function safeAuthResponse(user: Parameters<typeof toSafeUser>[0]) {
  return {
    user: toSafeUser(user),
    requiresPasswordChange: user.mustChangePassword,
  };
}

// ---------------------------------------------------------------------------
// Lab 3 Issue 3 — Authentication and sessions
// ---------------------------------------------------------------------------
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Password is required.";
  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({ error: "Validation failed", fieldErrors });
    return;
  }

  try {
    const user = await getPrisma().user.findUnique({
      where: { email },
      select: { ...AUTH_USER_SELECT, passwordHash: true },
    });
    const passwordMatches = verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.isActive || !passwordMatches) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    await createSession(getPrisma(), user.id, res);
    res.status(200).json(safeAuthResponse(user));
  } catch {
    res.status(500).json({ error: "Unable to sign in" });
  }
});

app.get("/api/auth/me", requireSession, (req: Request, res: Response) => {
  const user = res.locals.authUser;
  res.status(200).json(safeAuthResponse(user));
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    await revokeCurrentSession(getPrisma(), req);
  } catch {
    // Logout is intentionally idempotent. Always clear the browser cookie.
  }
  clearSessionCookie(res);
  res.status(204).send();
});

app.post(
  "/api/auth/change-password",
  requireSession,
  async (req: Request, res: Response) => {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";
    const fieldErrors: Record<string, string> = {};
    if (!currentPassword) fieldErrors.currentPassword = "Current password is required.";
    const passwordError = validatePassword(newPassword);
    if (passwordError) fieldErrors.newPassword = passwordError;
    if (!confirmPassword) fieldErrors.confirmPassword = "Please confirm your new password.";
    else if (newPassword !== confirmPassword) fieldErrors.confirmPassword = "Passwords do not match.";
    if (Object.keys(fieldErrors).length > 0) {
      res.status(400).json({ error: "Validation failed", fieldErrors });
      return;
    }

    try {
      const database = getPrisma();
      const user = await database.user.findUnique({
        where: { id: res.locals.authUser.id },
        select: { ...AUTH_USER_SELECT, passwordHash: true },
      });
      if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
        res.status(400).json({ error: "Current password is incorrect" });
        return;
      }
      if (verifyPassword(newPassword, user.passwordHash)) {
        res.status(400).json({ error: "New password must be different from the current password" });
        return;
      }

      const updatedUser = await database.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(newPassword),
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
        select: AUTH_USER_SELECT,
      });
      res.status(200).json(safeAuthResponse(updatedUser));
    } catch {
      res.status(500).json({ error: "Unable to change password" });
    }
  },
);

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// All application data routes now require the authenticated session. The
// health check and /api/auth/* routes above remain intentionally public where
// their contract allows it.
app.use(requireSession);
app.use(requirePasswordChangeComplete);

// ---------------------------------------------------------------------------
// Compatibility endpoint for older Lab 2 clients. It cannot select another
// identity; it only returns the currently authenticated requester.
// ---------------------------------------------------------------------------
app.get("/api/requesters", requireRole("REQUESTER"), (_req: Request, res: Response) => {
  const user = res.locals.authUser;
  // Kept as a compatibility endpoint for older clients, but it can only
  // describe the authenticated requester and cannot select another identity.
  res.status(200).json([{ id: user.id, name: user.name, email: user.email }]);
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

class ActiveAttachmentLimitError extends Error {}

app.post("/api/tickets", requireRole("REQUESTER"), async (req: Request, res: Response) => {
  const requesterId = res.locals.authUser.id;

  const { value, errors } = validateCreateTicketInput(req.body);
  if (!value) {
    res.status(400).json({ error: "Validation failed", fieldErrors: errors });
    return;
  }

  try {
    const ticket = await getPrisma().$transaction(async (transaction) => {
      const requester = await transaction.user.findFirst({
        where: { id: requesterId, isActive: true, role: "REQUESTER" },
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
          itPriority: value.requestedPriority as TicketPriority,
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
          itPriority: true,
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

app.get("/api/tickets", requireRole("REQUESTER"), async (req: Request, res: Response) => {
  const requesterId = res.locals.authUser.id;

  const parsedQuery = parseTicketListQuery(req.query as Record<string, unknown>);
  if (!parsedQuery.value) {
    res.status(400).json({ error: parsedQuery.error });
    return;
  }

  try {
    const database = getPrisma();
    const requester = await database.user.findFirst({
      where: { id: requesterId, isActive: true, role: "REQUESTER" },
      select: { id: true },
    });
    if (!requester) {
      res.status(404).json({ error: "Requester not found" });
      return;
    }

    const where = buildTicketWhere(requesterId, parsedQuery.value);
    const skip = (parsedQuery.value.page - 1) * parsedQuery.value.pageSize;
    const [totalItems, items] = await database.$transaction([
      database.ticket.count({ where }),
      database.ticket.findMany({
        where,
        orderBy: buildTicketOrderBy(parsedQuery.value),
        skip,
        take: parsedQuery.value.pageSize,
        select: {
          id: true,
          ticketNumber: true,
          ticketDate: true,
          summary: true,
          requestedPriority: true,
          currentStatus: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.status(200).json({
      items,
      pagination: {
        page: parsedQuery.value.page,
        pageSize: parsedQuery.value.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / parsedQuery.value.pageSize),
      },
    });
  } catch {
    res.status(500).json({ error: "Unable to load tickets" });
  }
});

app.get("/api/tickets/:id", requireRole("REQUESTER"), async (req: Request, res: Response) => {
  const requesterId = res.locals.authUser.id;

  const ticketId = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(ticketId) || ticketId <= 0) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }

  try {
    const database = getPrisma();
    const requester = await database.user.findFirst({
      where: { id: requesterId, isActive: true, role: "REQUESTER" },
      select: { id: true },
    });
    if (!requester) {
      res.status(404).json({ error: "Requester not found" });
      return;
    }

    const ticket = await database.ticket.findFirst({
      where: { id: ticketId, requesterId },
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
        problemAppearsResolved: true,
        problemAppearsResolvedAt: true,
        createdAt: true,
        updatedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
            removedAt: true,
            removalReason: true,
          },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    res.status(200).json(ticket);
  } catch {
    res.status(500).json({ error: "Unable to load ticket" });
  }
});

// ---------------------------------------------------------------------------
// Lab 3 Issue 6 — IT Staff Ticket Queue and read-only operational detail
// ---------------------------------------------------------------------------
const publicCommentSelect = {
  id: true,
  content: true,
  createdAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

const staffTicketListSelect = {
  id: true,
  ticketNumber: true,
  ticketDate: true,
  summary: true,
  requestedPriority: true,
  itPriority: true,
  currentStatus: true,
  updatedAt: true,
  requester: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, email: true, role: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
} as const;

const internalNoteSelect = {
  id: true,
  content: true,
  createdAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

const staffMutationSelect = {
  id: true,
  ownerId: true,
  itPriority: true,
  currentStatus: true,
  problemAppearsResolved: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, email: true, role: true } },
} as const;

const staffStatusValues = Object.keys(permittedStatusTransitions) as TicketStatus[];

type StaffTicketMutation = {
  ownerId?: number | null;
  itPriority?: TicketPriority;
  currentStatus?: TicketStatus;
};

type StaffTicketMutationResult =
  | { kind: "updated"; ticket: Awaited<ReturnType<typeof readStaffTicketMutation>> }
  | { kind: "missing" | "stale" | "invalid-owner" | "invalid-transition" };

async function readStaffTicketMutation(ticketId: number) {
  return getPrisma().ticket.findUnique({
    where: { id: ticketId },
    select: staffMutationSelect,
  });
}

async function persistStaffTicketMutation(
  ticketId: number,
  expectedUpdatedAt: Date,
  mutation: StaffTicketMutation,
): Promise<StaffTicketMutationResult> {
  return getPrisma().$transaction(async (transaction) => {
    const current = await transaction.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, updatedAt: true, currentStatus: true },
    });
    if (!current) return { kind: "missing" };
    if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return { kind: "stale" };

    if (typeof mutation.ownerId === "number") {
      const eligibleOwner = await transaction.user.findFirst({
        where: {
          id: mutation.ownerId,
          isActive: true,
          role: { in: ["IT_STAFF", "ADMINISTRATOR"] },
        },
        select: { id: true },
      });
      if (!eligibleOwner) return { kind: "invalid-owner" };
    }

    if (
      mutation.currentStatus &&
      !isPermittedStatusTransition(current.currentStatus, mutation.currentStatus)
    ) {
      return { kind: "invalid-transition" };
    }

    const updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
    const update = await transaction.ticket.updateMany({
      where: { id: ticketId, updatedAt: current.updatedAt },
      data: { ...mutation, updatedAt },
    });
    if (update.count !== 1) return { kind: "stale" };

    const ticket = await transaction.ticket.findUnique({
      where: { id: ticketId },
      select: staffMutationSelect,
    });
    if (!ticket) return { kind: "missing" };
    return { kind: "updated", ticket };
  });
}

function sendStaffMutationFailure(res: Response, result: Exclude<StaffTicketMutationResult, { kind: "updated" }>): void {
  if (result.kind === "missing") {
    res.status(404).json({ error: "Resource not found" });
  } else if (result.kind === "stale") {
    res.status(409).json({ error: "Ticket changed since it was loaded. Refresh and try again." });
  } else if (result.kind === "invalid-owner") {
    res.status(400).json({
      error: "Validation failed",
      fieldErrors: { ownerId: "Choose an active Staff or Administrator." },
    });
  } else {
    res.status(409).json({ error: "The requested status transition is not permitted." });
  }
}

function parseExpectedUpdatedAt(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

app.get(
  "/api/staff/tickets",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (req: Request, res: Response) => {
    const parsedQuery = parseStaffTicketListQuery(req.query as Record<string, unknown>);
    if (!parsedQuery.value) {
      res.status(400).json({ error: parsedQuery.error });
      return;
    }

    try {
      const database = getPrisma();
      const where = buildStaffTicketWhere(parsedQuery.value);
      const skip = (parsedQuery.value.page - 1) * parsedQuery.value.pageSize;
      const [totalItems, items] = await database.$transaction([
        database.ticket.count({ where }),
        database.ticket.findMany({
          where,
          orderBy: buildStaffTicketOrderBy(parsedQuery.value),
          skip,
          take: parsedQuery.value.pageSize,
          select: staffTicketListSelect,
        }),
      ]);

      res.status(200).json({
        items,
        pagination: {
          page: parsedQuery.value.page,
          pageSize: parsedQuery.value.pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / parsedQuery.value.pageSize),
        },
      });
    } catch {
      res.status(500).json({ error: "Unable to load the staff ticket queue" });
    }
  },
);

app.get(
  "/api/staff/tickets/:id",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  requireTicketId,
  async (_req: Request, res: Response) => {
    const ticketId = res.locals.ticketId as number;

    try {
      const ticket = await getPrisma().ticket.findUnique({
        where: { id: ticketId },
        select: {
          ...staffTicketListSelect,
          requesterId: true,
          ownerId: true,
          categoryId: true,
          relatedSystemId: true,
          description: true,
          problemAppearsResolved: true,
          problemAppearsResolvedAt: true,
          createdAt: true,
          attachments: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              createdAt: true,
              removedAt: true,
              removalReason: true,
            },
          },
          publicComments: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: publicCommentSelect,
          },
          internalNotes: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: internalNoteSelect,
          },
        },
      });

      if (!ticket) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }

      res.status(200).json(ticket);
    } catch {
      res.status(500).json({ error: "Unable to load operational ticket detail" });
    }
  },
);

app.get(
  "/api/staff/assignees",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  async (_req: Request, res: Response) => {
    try {
      const assignees = await getPrisma().user.findMany({
        where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, email: true, role: true },
      });
      res.status(200).json(assignees);
    } catch {
      res.status(500).json({ error: "Unable to load eligible assignees" });
    }
  },
);

app.patch(
  "/api/staff/tickets/:id/owner",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  requireTicketId,
  async (req: Request, res: Response) => {
    const ownerId: unknown = req.body?.ownerId;
    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.updatedAt);
    if (
      (ownerId !== null &&
        (typeof ownerId !== "number" ||
          !Number.isSafeInteger(ownerId) ||
          ownerId <= 0 ||
          ownerId > 2_147_483_647)) ||
      !expectedUpdatedAt
    ) {
      res.status(400).json({ error: "Validation failed", fieldErrors: { ownerId: "A valid owner and updatedAt are required." } });
      return;
    }

    try {
      const result = await persistStaffTicketMutation(res.locals.ticketId as number, expectedUpdatedAt, {
        ownerId: ownerId as number | null,
      });
      if (result.kind !== "updated") {
        sendStaffMutationFailure(res, result);
        return;
      }
      res.status(200).json(result.ticket);
    } catch {
      res.status(500).json({ error: "Unable to update Ticket owner" });
    }
  },
);

app.patch(
  "/api/staff/tickets/:id/it-priority",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  requireTicketId,
  async (req: Request, res: Response) => {
    const value: unknown = req.body?.itPriority;
    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.updatedAt);
    const validPriorities = Object.values(TicketPriority) as TicketPriority[];
    if (typeof value !== "string" || !validPriorities.includes(value as TicketPriority) || !expectedUpdatedAt) {
      res.status(400).json({ error: "Validation failed", fieldErrors: { itPriority: "Choose a valid IT Priority and include updatedAt." } });
      return;
    }

    try {
      const result = await persistStaffTicketMutation(res.locals.ticketId as number, expectedUpdatedAt, {
        itPriority: value as TicketPriority,
      });
      if (result.kind !== "updated") {
        sendStaffMutationFailure(res, result);
        return;
      }
      res.status(200).json(result.ticket);
    } catch {
      res.status(500).json({ error: "Unable to update IT Priority" });
    }
  },
);

app.patch(
  "/api/staff/tickets/:id/status",
  requireRole("IT_STAFF", "ADMINISTRATOR"),
  requireTicketId,
  async (req: Request, res: Response) => {
    const value: unknown = req.body?.status;
    const expectedUpdatedAt = parseExpectedUpdatedAt(req.body?.updatedAt);
    if (typeof value !== "string" || !staffStatusValues.includes(value as TicketStatus) || !expectedUpdatedAt) {
      res.status(400).json({ error: "Validation failed", fieldErrors: { status: "Choose a valid status and include updatedAt." } });
      return;
    }

    const status = value as TicketStatus;
    if (statusTransitionNeedsConfirmation(status) && req.body?.confirm !== true) {
      res.status(400).json({ error: "Validation failed", fieldErrors: { confirm: "Confirm closing or cancelling this Ticket." } });
      return;
    }

    try {
      const result = await persistStaffTicketMutation(res.locals.ticketId as number, expectedUpdatedAt, {
        currentStatus: status,
      });
      if (result.kind !== "updated") {
        sendStaffMutationFailure(res, result);
        return;
      }
      res.status(200).json(result.ticket);
    } catch {
      res.status(500).json({ error: "Unable to update Ticket status" });
    }
  },
);

function accessibleTicketWhere(user: { id: number; role: string }, ticketId: number) {
  return user.role === "REQUESTER"
    ? { id: ticketId, requesterId: user.id }
    : { id: ticketId };
}

// ---------------------------------------------------------------------------
// Lab 3 Issue 5 — Requester comments and problem-resolution indication
// ---------------------------------------------------------------------------
app.get(
  "/api/tickets/:id/comments",
  requireRole("REQUESTER", "IT_STAFF", "ADMINISTRATOR"),
  requireTicketId,
  async (_req: Request, res: Response) => {
    const ticketId = res.locals.ticketId as number;
    const user = res.locals.authUser;

    try {
      const database = getPrisma();
      const ticket = await database.ticket.findFirst({
        where: accessibleTicketWhere(user, ticketId),
        select: { id: true },
      });
      if (!ticket) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }

      const comments = await database.publicComment.findMany({
        where: { ticketId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: publicCommentSelect,
      });
      res.status(200).json(comments);
    } catch {
      res.status(500).json({ error: "Unable to load public comments" });
    }
  },
);

app.post(
  "/api/tickets/:id/comments",
  requireRole("REQUESTER", "IT_STAFF", "ADMINISTRATOR"),
  requireTicketId,
  async (req: Request, res: Response) => {
    const ticketId = res.locals.ticketId as number;
    const user = res.locals.authUser;
    const validationError = validateCommentContent(req.body?.content);
    if (validationError) {
      res.status(400).json({ error: "Validation failed", fieldErrors: { content: validationError } });
      return;
    }

    try {
      const database = getPrisma();
      const ticket = await database.ticket.findFirst({
        where: accessibleTicketWhere(user, ticketId),
        select: { id: true },
      });
      if (!ticket) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }

      const comment = await database.publicComment.create({
        data: {
          ticketId,
          authorId: user.id,
          content: (req.body.content as string).trim(),
        },
        select: publicCommentSelect,
      });
      res.status(201).json(comment);
    } catch {
      res.status(500).json({ error: "Unable to add public comment" });
    }
  },
);

app.post(
  "/api/tickets/:id/problem-resolution",
  requireRole("REQUESTER"),
  requireTicketId,
  async (req: Request, res: Response) => {
    const ticketId = res.locals.ticketId as number;
    const requesterId = res.locals.authUser.id;
    const appearsResolved = req.body?.appearsResolved;
    if (typeof appearsResolved !== "boolean") {
      res.status(400).json({
        error: "Validation failed",
        fieldErrors: { appearsResolved: "appearsResolved must be true or false." },
      });
      return;
    }

    try {
      const database = getPrisma();
      const ticket = await database.ticket.findFirst({
        where: { id: ticketId, requesterId },
        select: { id: true },
      });
      if (!ticket) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }

      const updated = await database.ticket.update({
        where: { id: ticketId },
        data: {
          problemAppearsResolved: appearsResolved,
          problemAppearsResolvedAt: appearsResolved ? new Date() : null,
        },
        select: {
          id: true,
          problemAppearsResolved: true,
          problemAppearsResolvedAt: true,
          currentStatus: true,
          updatedAt: true,
        },
      });
      res.status(200).json(updated);
    } catch {
      res.status(500).json({ error: "Unable to update problem resolution" });
    }
  },
);

// ---------------------------------------------------------------------------
// Lab 2 Issue 7 — Attachment lifecycle
// Files are held in memory only while validation and the database ownership
// check run. The persisted filename is generated by the server and is never
// returned to the client.
// ---------------------------------------------------------------------------
const storedExtensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

function safeOriginalName(value: string): string {
  const basename = value.replace(/^.*[\\/]/, "").trim();
  return (basename || "attachment").slice(0, 255);
}

async function getOwnedTicket(requesterId: number, ticketId: number) {
  return getPrisma().ticket.findFirst({
    where: { id: ticketId, requesterId },
    select: { id: true },
  });
}

async function hasActiveRequester(requesterId: number): Promise<boolean> {
  const requester = await getPrisma().user.findFirst({
    where: { id: requesterId, isActive: true, role: "REQUESTER" },
    select: { id: true },
  });
  return Boolean(requester);
}

app.post(
  "/api/tickets/:id/attachments",
  requireRole("REQUESTER"),
  requireTicketId,
  handleAttachmentUpload,
  async (req: Request, res: Response) => {
    const requesterId = res.locals.authUser.id;
    const ticketId = res.locals.ticketId as number;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "A file is required" });
      return;
    }

    const validationError = validateAttachment(file);
    if (validationError) {
      res.status(415).json({ error: validationError });
      return;
    }

    let storedPath: string | null = null;

    try {
      if (!(await hasActiveRequester(requesterId))) {
        res.status(404).json({ error: "Requester not found" });
        return;
      }

      if (!(await getOwnedTicket(requesterId, ticketId))) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }

      const attachment = await getPrisma().$transaction(async (transaction) => {
        // Serialize the count-and-insert pair for this ticket so concurrent
        // uploads cannot both pass the five-active-attachments check.
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${ticketId})`;

        const activeCount = await transaction.attachment.count({
          where: { ticketId, removedAt: null },
        });
        if (activeCount >= attachmentLimits.maxFiles) {
          throw new ActiveAttachmentLimitError();
        }

        const storedName = `${randomUUID()}${storedExtensionByMimeType[file.mimetype]}`;
        storedPath = path.join(attachmentStorageDir, storedName);
        await mkdir(attachmentStorageDir, { recursive: true });
        await writeFile(storedPath, file.buffer, { flag: "wx" });

        return transaction.attachment.create({
          data: {
            ticketId,
            originalName: safeOriginalName(file.originalname),
            storedName,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
            removedAt: true,
            removalReason: true,
          },
        });
      });

      // The transaction committed, so the generated file now belongs to the
      // persisted attachment and must not be removed by the error cleanup.
      storedPath = null;
      res.status(201).json(attachment);
    } catch (error) {
      if (error instanceof ActiveAttachmentLimitError) {
        res.status(409).json({ error: "A Ticket can have no more than five active attachments" });
        return;
      }

      res.status(500).json({ error: "Unable to upload attachment" });
    } finally {
      // If the transaction failed after writing the file, do not leave an
      // orphaned object in storage.
      if (storedPath) await unlink(storedPath).catch(() => undefined);
    }
  },
);

app.get(
  "/api/tickets/:id/attachments",
  requireRole("REQUESTER", "IT_STAFF", "ADMINISTRATOR"),
  requireTicketId,
  async (_req: Request, res: Response) => {
    const user = res.locals.authUser;
    const ticketId = res.locals.ticketId as number;

    try {
      if (user.role === "REQUESTER" && !(await hasActiveRequester(user.id))) {
        res.status(404).json({ error: "Requester not found" });
        return;
      }

      const ticket = await getPrisma().ticket.findFirst({
        where: accessibleTicketWhere(user, ticketId),
        select: { id: true },
      });
      if (!ticket) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }

      const attachments = await getPrisma().attachment.findMany({
        where: { ticketId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          removedAt: true,
          removalReason: true,
        },
      });

      res.status(200).json(attachments);
    } catch {
      res.status(500).json({ error: "Unable to load attachments" });
    }
  },
);

app.get(
  "/api/attachments/:id/download",
  requireRole("REQUESTER", "IT_STAFF", "ADMINISTRATOR"),
  async (req: Request, res: Response) => {
    const user = res.locals.authUser;
    const attachmentId = parsePositiveId(req.params.id);
    if (attachmentId === null) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    try {
      if (user.role === "REQUESTER" && !(await hasActiveRequester(user.id))) {
        res.status(404).json({ error: "Requester not found" });
        return;
      }

      const attachment = await getPrisma().attachment.findFirst({
        where: {
          id: attachmentId,
          removedAt: null,
          ...(user.role === "REQUESTER" ? { ticket: { requesterId: user.id } } : {}),
        },
        select: {
          originalName: true,
          storedName: true,
          mimeType: true,
        },
      });
      if (!attachment) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }

      const storedPath = path.join(attachmentStorageDir, attachment.storedName);
      let contents: Buffer;
      try {
        contents = await readFile(storedPath);
      } catch {
        res.status(404).json({ error: "Resource not found" });
        return;
      }

      res.set("Content-Type", attachment.mimeType);
      res.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`);
      res.status(200).send(contents);
    } catch {
      res.status(500).json({ error: "Unable to download attachment" });
    }
  },
);

app.patch(
  "/api/attachments/:id/remove",
  requireRole("REQUESTER"),
  async (req: Request, res: Response) => {
    const requesterId = res.locals.authUser.id;
    const attachmentId = parsePositiveId(req.params.id);
    if (attachmentId === null) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    const reasonError = validateRemovalReason(req.body?.reason);
    if (reasonError) {
      res.status(400).json({ error: "Validation failed", fieldErrors: { reason: reasonError } });
      return;
    }
    const reason = (req.body.reason as string).trim();

    try {
      if (!(await hasActiveRequester(requesterId))) {
        res.status(404).json({ error: "Requester not found" });
        return;
      }

      const attachment = await getPrisma().attachment.findFirst({
        where: { id: attachmentId, ticket: { requesterId } },
        select: {
          id: true,
          removedAt: true,
        },
      });
      if (!attachment) {
        res.status(404).json({ error: "Resource not found" });
        return;
      }
      if (attachment.removedAt) {
        res.status(409).json({ error: "Attachment already removed" });
        return;
      }

      const updated = await getPrisma().attachment.update({
        where: { id: attachmentId },
        data: { removedAt: new Date(), removalReason: reason },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          removedAt: true,
          removalReason: true,
        },
      });
      res.status(200).json(updated);
    } catch {
      res.status(500).json({ error: "Unable to remove attachment" });
    }
  },
);

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

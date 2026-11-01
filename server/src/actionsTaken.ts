// Lab 4 Issue 3: Actions Taken API (docs/lab-04/api-spec.md sections 2 and 3).
import type { Express, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import type { ActionOperation, ActionStatus, ActionTaken, TicketStatus } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import {
  type ActionFields,
  type FieldErrors,
  commandHash,
  isPermittedActionMove,
  isPositiveInt32,
  isUuid,
  parseOffsetDate,
  readEditableFields,
  unexpectedFields,
  validateActionFields,
  validateCancellationReason,
} from "./actionValidation.js";

type AuthUser = { id: number; role: string };
type UserRow = { id: number; name: string; role: string; isActive: boolean };
type TicketRow = { id: number; updatedAt: Date; currentStatus: TicketStatus; ticketDate: Date };
type NextState = ActionFields & { status: ActionStatus; assigneeId: number; cancellationReason: string | null };

const writableTicketStatuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const editableKeys = ["actionAt", "description", "result", "followUpRequired", "followUpNote", "attachmentNotes"] as const;

class HttpError {
  constructor(readonly status: number, readonly body: Record<string, unknown>) {}
}
const notFound = () => new HttpError(404, { error: "Resource not found" });
const invalid = (fieldErrors: FieldErrors) =>
  new HttpError(400, { error: "Validation failed", code: "VALIDATION_FAILED", fieldErrors });
const conflict = (code: string, error: string) => new HttpError(409, { error, code });

const isOperational = (user: UserRow | undefined) =>
  Boolean(user?.isActive && (user.role === "IT_STAFF" || user.role === "ADMINISTRATOR"));

const actionInclude = {
  performedBy: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, role: true, isActive: true } },
} as const;
type ActionWithPeople = Prisma.ActionTakenGetPayload<{ include: typeof actionInclude }>;

const actionKeys = [
  "id", "ticketId", "actionAt", "description", "result", "performedBy", "assignee", "status",
  "followUpRequired", "followUpNote", "attachmentNotes", "cancellationReason", "version", "createdAt", "updatedAt",
] as const;

// Same safe shape from a live row or a stored revision snapshot.
function toDto(source: ActionWithPeople | Record<string, unknown>) {
  return Object.fromEntries(actionKeys.map((key) => [key, (source as Record<string, unknown>)[key]]));
}

function fieldsOf(action: ActionTaken): ActionFields {
  const { actionAt, description, result, followUpRequired, followUpNote, attachmentNotes } = action;
  return { actionAt, description, result, followUpRequired, followUpNote, attachmentNotes };
}

function parseIds(req: Request): { ticketId: number; actionId: number | null } {
  const ticketId = Number(req.params.ticketId);
  const actionId = req.params.actionId === undefined ? null : Number(req.params.actionId);
  const errors: FieldErrors = {};
  if (!/^\d+$/.test(req.params.ticketId) || !isPositiveInt32(ticketId)) errors.ticketId = "Invalid id.";
  if (actionId !== null && (!/^\d+$/.test(req.params.actionId) || !isPositiveInt32(actionId))) errors.actionId = "Invalid id.";
  if (Object.keys(errors).length) throw invalid(errors);
  return { ticketId, actionId };
}

function parsePage(query: Record<string, unknown>) {
  const errors = unexpectedFields(query, ["page", "pageSize"]);
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 10 : Number(query.pageSize);
  if (query.page !== undefined && (!/^\d+$/.test(String(query.page)) || !isPositiveInt32(page))) errors.page = "Use a page of 1 or more.";
  if (![10, 25, 50].includes(pageSize) || (query.pageSize !== undefined && !/^\d+$/.test(String(query.pageSize)))) errors.pageSize = "Use 10, 25 or 50.";
  if (Object.keys(errors).length) throw invalid(errors);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

const pagination = (page: number, pageSize: number, totalItems: number) => ({
  page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize),
});

// Requesters see only their own Tickets; anything else is indistinguishable from missing.
async function requireVisibleTicket(user: AuthUser, ticketId: number) {
  const ticket = await getPrisma().ticket.findFirst({
    where: user.role === "REQUESTER" ? { id: ticketId, requesterId: user.id } : { id: ticketId },
    select: { id: true },
  });
  if (!ticket) throw notFound();
}

function handle(work: (req: Request, res: Response, user: AuthUser) => Promise<{ status: number; body: unknown }>) {
  return async (req: Request, res: Response) => {
    try {
      const { status, body } = await work(req, res, res.locals.authUser as AuthUser);
      res.status(status).json(body);
    } catch (error) {
      if (error instanceof HttpError) res.status(error.status).json(error.body);
      else res.status(500).json({ error: "Unable to process the Action request" });
    }
  };
}

type WriteCommand = {
  actor: AuthUser;
  ticketId: number;
  actionId: number | null;
  operation: ActionOperation;
  body: Record<string, unknown>;
  // Concrete path with ids, so one request id cannot replay across Tickets or Actions.
  route: string;
  version: number | null;
  ticketUpdatedAt: Date;
  userIds: number[];
  next: (ctx: { ticket: TicketRow; action: ActionTaken | null; users: Map<number, UserRow>; now: Date }) => NextState;
};

async function findReplay(actorId: number, mutationId: string, hash: string) {
  const revision = await getPrisma().actionTakenRevision.findUnique({
    where: { actorId_mutationId: { actorId, mutationId } },
  });
  if (!revision) return null;
  if (revision.requestHash !== hash) throw conflict("MUTATION_ID_REUSED", "This request id was already used for a different change.");
  return {
    status: 200,
    body: { action: toDto(revision.snapshot as Record<string, unknown>), ticketUpdatedAt: revision.ticketUpdatedAt, replayed: true },
  };
}

// Lock Ticket, then Users by id, then the Action; replay or apply one change with its revision.
async function executeWrite(cmd: WriteCommand) {
  const mutationId = cmd.body.mutationId as string;
  const hash = commandHash(cmd.operation === "CREATE" ? "POST" : "PATCH", cmd.route, cmd.body);
  try {
    return await getPrisma().$transaction(async (tx) => {
      const [ticket] = await tx.$queryRaw<TicketRow[]>`
        SELECT id, "updatedAt", "currentStatus", "ticketDate" FROM "Ticket" WHERE id = ${cmd.ticketId} FOR UPDATE`;
      if (!ticket) throw notFound();

      const existing = cmd.actionId === null
        ? null
        : await tx.actionTaken.findFirst({ where: { id: cmd.actionId, ticketId: cmd.ticketId }, select: { assigneeId: true } });
      if (cmd.actionId !== null && !existing) throw notFound();

      const ids = [...new Set([cmd.actor.id, ...cmd.userIds, ...(existing ? [existing.assigneeId] : [])])].sort((a, b) => a - b);
      const lockedUsers = await tx.$queryRaw<UserRow[]>`
        SELECT id, name, role::text AS role, "isActive" FROM "User" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
      const users = new Map(lockedUsers.map((user) => [user.id, user]));
      const actor = users.get(cmd.actor.id);
      if (!actor?.isActive) throw new HttpError(401, { error: "Authentication required" });
      if (!isOperational(actor)) throw new HttpError(403, { error: "Forbidden" });

      const [action] = cmd.actionId === null
        ? [null]
        : await tx.$queryRaw<ActionTaken[]>`SELECT * FROM "ActionTaken" WHERE id = ${cmd.actionId} FOR UPDATE`;

      const replay = await tx.actionTakenRevision.findUnique({ where: { actorId_mutationId: { actorId: actor.id, mutationId } } });
      if (replay) {
        if (replay.requestHash !== hash) throw conflict("MUTATION_ID_REUSED", "This request id was already used for a different change.");
        return { status: 200, body: { action: toDto(replay.snapshot as Record<string, unknown>), ticketUpdatedAt: replay.ticketUpdatedAt, replayed: true } };
      }

      if (ticket.updatedAt.getTime() !== cmd.ticketUpdatedAt.getTime() || (action && action.version !== cmd.version)) {
        throw conflict("STALE_STATE", "This Ticket or Action changed since it was loaded. Refresh and try again.");
      }
      if (!writableTicketStatuses.includes(ticket.currentStatus)) {
        throw conflict("TICKET_LOCKED", "Actions cannot change while the Ticket is resolved, closed or cancelled.");
      }

      const now = new Date();
      const next = cmd.next({ ticket, action, users, now });
      const parentAt = new Date(Math.max(now.getTime(), ticket.updatedAt.getTime() + 1));
      const saved = action
        ? await tx.actionTaken.update({
            where: { id: action.id },
            data: { ...next, version: action.version + 1, updatedAt: now },
          })
        : await tx.actionTaken.create({
            data: { ...next, ticketId: cmd.ticketId, performedById: actor.id, version: 1, createdAt: now, updatedAt: now },
          });
      await tx.ticket.update({ where: { id: cmd.ticketId }, data: { updatedAt: parentAt } });

      const people = new Map(
        (await tx.user.findMany({ where: { id: { in: [saved.performedById, saved.assigneeId] } }, select: { id: true, name: true, role: true, isActive: true } }))
          .map((user) => [user.id, user]),
      );
      const performer = people.get(saved.performedById)!;
      const assignee = people.get(saved.assigneeId)!;
      const snapshot = {
        ...saved,
        actionAt: saved.actionAt.toISOString(),
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
        performedBy: { id: performer.id, name: performer.name },
        assignee: { id: assignee.id, name: assignee.name, role: assignee.role, isActive: assignee.isActive },
        actorName: actor.name,
      };
      await tx.actionTakenRevision.create({
        data: {
          actionId: saved.id, version: saved.version, actorId: actor.id, operation: cmd.operation,
          mutationId, requestHash: hash, snapshot, ticketUpdatedAt: parentAt, createdAt: now,
        },
      });
      // Prisma 5 hides errors raised by COMMIT, so run the deferred revision check now.
      await tx.$executeRaw`SET CONSTRAINTS "ActionTaken_revision_check" IMMEDIATE`;
      return { status: cmd.operation === "CREATE" ? 201 : 200, body: { action: toDto(snapshot), ticketUpdatedAt: parentAt, replayed: false } };
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // A simultaneous retry with the same id won the unique constraint: replay it or report misuse.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await findReplay(cmd.actor.id, mutationId, hash);
      if (replay) return replay;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw conflict("STALE_STATE", "Another change was in progress. Refresh and try again.");
    }
    throw error;
  }
}

// Shared write preamble: visibility before role (own write 403, cross-owner 404), then common fields.
async function prepareWrite(req: Request, user: AuthUser, allowed: readonly string[], needsVersion: boolean) {
  const { ticketId, actionId } = parseIds(req);
  await requireVisibleTicket(user, ticketId);
  if (user.role === "REQUESTER") throw new HttpError(403, { error: "Forbidden" });
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
  const errors = unexpectedFields(body, ["mutationId", "ticketUpdatedAt", ...(needsVersion ? ["version"] : []), ...allowed]);
  if (!isUuid(body.mutationId)) errors.mutationId = "A request id (UUID) is required.";
  const ticketUpdatedAt = parseOffsetDate(body.ticketUpdatedAt);
  if (!ticketUpdatedAt) errors.ticketUpdatedAt = "The Ticket timestamp you loaded is required.";
  if (needsVersion && !isPositiveInt32(body.version)) errors.version = "The Action version you loaded is required.";
  return { ticketId, actionId, body, errors, ticketUpdatedAt: ticketUpdatedAt as Date, version: needsVersion ? (body.version as number) : null };
}

function assertNoErrors(errors: FieldErrors) {
  if (Object.keys(errors).length) throw invalid(errors);
}

// Merge a patch onto current values; turning follow-up off without a note clears the note.
function merge(current: ActionFields, patch: Partial<ActionFields>, body: Record<string, unknown>): ActionFields {
  const merged = { ...current, ...patch };
  if (patch.followUpRequired === false && !("followUpNote" in body)) merged.followUpNote = null;
  return merged;
}

function sameFields(a: ActionFields, b: ActionFields) {
  return editableKeys.every((key) => (key === "actionAt" ? a.actionAt.getTime() === b.actionAt.getTime() : a[key] === b[key]));
}

function requireEligibleAssignee(users: Map<number, UserRow>, id: number, field = "assigneeId") {
  if (!isOperational(users.get(id))) throw invalid({ [field]: "Choose an active IT Staff member or Administrator." });
}

export function registerActionRoutes(app: Express) {
  const base = "/api/tickets/:ticketId/actions-taken";

  app.get(base, handle(async (req, _res, user) => {
    const { ticketId } = parseIds(req);
    const { page, pageSize, skip } = parsePage(req.query as Record<string, unknown>);
    await requireVisibleTicket(user, ticketId);
    const db = getPrisma();
    const [totalItems, items, ticket] = await db.$transaction(
      [
        db.actionTaken.count({ where: { ticketId } }),
        db.actionTaken.findMany({ where: { ticketId }, orderBy: [{ actionAt: "asc" }, { id: "asc" }], skip, take: pageSize, include: actionInclude }),
        db.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { status: 200, body: { items: items.map(toDto), pagination: pagination(page, pageSize, totalItems), ticketUpdatedAt: ticket.updatedAt } };
  }));

  app.get(`${base}/:actionId`, handle(async (req, _res, user) => {
    const { ticketId, actionId } = parseIds(req);
    assertNoErrors(unexpectedFields(req.query as Record<string, unknown>, []));
    await requireVisibleTicket(user, ticketId);
    const db = getPrisma();
    const [action, ticket] = await db.$transaction([
      db.actionTaken.findFirst({ where: { id: actionId!, ticketId }, include: actionInclude }),
      db.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } }),
    ]);
    if (!action) throw notFound();
    return { status: 200, body: { action: toDto(action), ticketUpdatedAt: ticket.updatedAt } };
  }));

  app.get(`${base}/:actionId/revisions`, handle(async (req, _res, user) => {
    const { ticketId, actionId } = parseIds(req);
    const { page, pageSize, skip } = parsePage(req.query as Record<string, unknown>);
    await requireVisibleTicket(user, ticketId);
    const db = getPrisma();
    if (!(await db.actionTaken.findFirst({ where: { id: actionId!, ticketId }, select: { id: true } }))) throw notFound();
    const [totalItems, revisions] = await db.$transaction(
      [
        db.actionTakenRevision.count({ where: { actionId: actionId! } }),
        db.actionTakenRevision.findMany({ where: { actionId: actionId! }, orderBy: { version: "asc" }, skip, take: pageSize }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const items = revisions.map((revision) => {
      const snapshot = revision.snapshot as Record<string, unknown>;
      return {
        version: revision.version,
        operation: revision.operation,
        actor: { id: revision.actorId, name: snapshot.actorName },
        createdAt: revision.createdAt,
        snapshot: toDto(snapshot),
      };
    });
    return { status: 200, body: { items, pagination: pagination(page, pageSize, totalItems) } };
  }));

  app.get("/api/tickets/:ticketId/status-history", handle(async (req, _res, user) => {
    const { ticketId } = parseIds(req);
    const { page, pageSize, skip } = parsePage(req.query as Record<string, unknown>);
    await requireVisibleTicket(user, ticketId);
    const db = getPrisma();
    const [totalItems, events] = await db.$transaction(
      [
        db.ticketStatusEvent.count({ where: { ticketId } }),
        db.ticketStatusEvent.findMany({
          where: { ticketId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          skip,
          take: pageSize,
          select: { id: true, fromStatus: true, toStatus: true, createdAt: true, actor: { select: { id: true, name: true } } },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { status: 200, body: { items: events, pagination: pagination(page, pageSize, totalItems) } };
  }));

  app.post(base, handle(async (req, _res, user) => {
    const w = await prepareWrite(req, user, ["assigneeId", ...editableKeys], false);
    const fields = readEditableFields(w.body, w.errors);
    for (const key of ["description", "actionAt", "followUpRequired"] as const) {
      if (!(key in w.body)) w.errors[key] = "This field is required.";
    }
    if ("assigneeId" in w.body && !isPositiveInt32(w.body.assigneeId)) w.errors.assigneeId = "Choose an active IT Staff member or Administrator.";
    assertNoErrors(w.errors);
    const assigneeId = (w.body.assigneeId as number | undefined) ?? user.id;
    return executeWrite({
      actor: user, ticketId: w.ticketId, actionId: null, operation: "CREATE", body: w.body, route: req.path,
      version: null, ticketUpdatedAt: w.ticketUpdatedAt, userIds: [assigneeId],
      next: ({ ticket, users, now }) => {
        requireEligibleAssignee(users, assigneeId);
        const merged: ActionFields = {
          actionAt: fields.actionAt!, description: fields.description!, result: fields.result ?? "",
          followUpRequired: fields.followUpRequired!, followUpNote: fields.followUpNote ?? null, attachmentNotes: fields.attachmentNotes ?? null,
        };
        assertNoErrors(validateActionFields(merged, "PLANNED", ticket.ticketDate, now));
        return { ...merged, status: "PLANNED", assigneeId, cancellationReason: null };
      },
    });
  }));

  app.patch(`${base}/:actionId`, handle(async (req, _res, user) => {
    const w = await prepareWrite(req, user, editableKeys, true);
    const patch = readEditableFields(w.body, w.errors);
    if (!editableKeys.some((key) => key in w.body)) w.errors.body = "Change at least one field.";
    assertNoErrors(w.errors);
    return executeWrite({
      actor: user, ticketId: w.ticketId, actionId: w.actionId, operation: "EDIT", body: w.body, route: req.path,
      version: w.version, ticketUpdatedAt: w.ticketUpdatedAt, userIds: [],
      next: ({ ticket, action, users, now }) => {
        if (action!.status === "CANCELLED") throw conflict("INVALID_TRANSITION", "A cancelled Action is read-only.");
        requireEligibleAssignee(users, action!.assigneeId);
        const current = fieldsOf(action!);
        const merged = merge(current, patch, w.body);
        assertNoErrors(validateActionFields(merged, action!.status, ticket.ticketDate, now));
        if (sameFields(current, merged)) throw invalid({ body: "Nothing changed." });
        return { ...merged, status: action!.status, assigneeId: action!.assigneeId, cancellationReason: action!.cancellationReason };
      },
    });
  }));

  app.patch(`${base}/:actionId/assignee`, handle(async (req, _res, user) => {
    const w = await prepareWrite(req, user, ["assigneeId"], true);
    if (!isPositiveInt32(w.body.assigneeId)) w.errors.assigneeId = "Choose an active IT Staff member or Administrator.";
    assertNoErrors(w.errors);
    const assigneeId = w.body.assigneeId as number;
    return executeWrite({
      actor: user, ticketId: w.ticketId, actionId: w.actionId, operation: "ASSIGN", body: w.body, route: req.path,
      version: w.version, ticketUpdatedAt: w.ticketUpdatedAt, userIds: [assigneeId],
      next: ({ action, users }) => {
        if (action!.status === "CANCELLED") throw conflict("INVALID_TRANSITION", "A cancelled Action is read-only.");
        if (action!.assigneeId === assigneeId) throw invalid({ assigneeId: "This person is already assigned." });
        requireEligibleAssignee(users, assigneeId);
        return { ...fieldsOf(action!), status: action!.status, assigneeId, cancellationReason: action!.cancellationReason };
      },
    });
  }));

  app.patch(`${base}/:actionId/status`, handle(async (req, _res, user) => {
    const w = await prepareWrite(req, user, ["status", "confirm", "cancellationReason", "result", "followUpRequired", "followUpNote", "attachmentNotes"], true);
    const target = w.body.status;
    if (target !== "IN_PROGRESS" && target !== "COMPLETED" && target !== "CANCELLED") w.errors.status = "Choose In Progress, Completed or Cancelled.";
    const patch = readEditableFields(w.body, w.errors);
    let reason: string | null = null;
    if (target === "CANCELLED") {
      if (w.body.confirm !== true) w.errors.confirm = "Confirm cancelling this Action.";
      reason = validateCancellationReason(w.body.cancellationReason);
      if (!reason) w.errors.cancellationReason = "Give a reason of 5 to 500 characters.";
      for (const key of editableKeys) if (key in w.body) w.errors[key] = "Cancelling cannot change other fields.";
    } else {
      if ("confirm" in w.body) w.errors.confirm = "Only cancelling needs confirmation.";
      if ("cancellationReason" in w.body) w.errors.cancellationReason = "Only cancelling takes a reason.";
    }
    assertNoErrors(w.errors);
    const status = target as ActionStatus;
    return executeWrite({
      actor: user, ticketId: w.ticketId, actionId: w.actionId, operation: "STATUS", body: w.body, route: req.path,
      version: w.version, ticketUpdatedAt: w.ticketUpdatedAt, userIds: [],
      next: ({ ticket, action, users, now }) => {
        if (!isPermittedActionMove(action!.status, status)) {
          throw conflict("INVALID_TRANSITION", `An Action cannot move from ${action!.status} to ${status}.`);
        }
        const current = fieldsOf(action!);
        if (status === "CANCELLED") {
          return { ...current, status, assigneeId: action!.assigneeId, cancellationReason: reason };
        }
        requireEligibleAssignee(users, action!.assigneeId);
        const merged = merge(current, patch, w.body);
        assertNoErrors(validateActionFields(merged, status, ticket.ticketDate, now));
        return { ...merged, status, assigneeId: action!.assigneeId, cancellationReason: null };
      },
    });
  }));
}

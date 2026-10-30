import { randomUUID } from "node:crypto";
import type { UserRole } from "@prisma/client";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seedLab2Data } from "../../prisma/seed.js";
import { createTestUser, sessionCookieFor } from "../lab-03/testSession.js";

const prisma = getPrisma();

// Per-file fixture world: users with sessions, Tickets, and cleanup of everything created.
export async function createWorld(label: string) {
  await seedLab2Data(prisma);
  const suffix = `${label}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const userIds: number[] = [];
  const ticketIds: number[] = [];

  async function user(name: string, role: UserRole, isActive = true) {
    const created = await createTestUser(`lab4-${name}-${suffix}@example.test`, role);
    userIds.push(created.id);
    if (!isActive) await prisma.user.update({ where: { id: created.id }, data: { isActive: false } });
    return { id: created.id, cookie: isActive ? await sessionCookieFor(created.id) : "" };
  }

  async function ticket(requesterId: number, overrides: { currentStatus?: "NEW" | "RESOLVED" | "CLOSED" | "CANCELLED"; ownerId?: number | null; ticketDate?: Date } = {}) {
    const [category, system] = await Promise.all([
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    const created = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-L4-${suffix}-${ticketIds.length}`,
        requesterId,
        ownerId: overrides.ownerId ?? null,
        categoryId: category!.id,
        relatedSystemId: system!.id,
        summary: `Lab 4 ${label} fixture`,
        description: "Ticket fixture for Actions Taken tests.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: overrides.currentStatus ?? "NEW",
        ticketDate: overrides.ticketDate ?? new Date(Date.now() - 86_400_000),
      },
    });
    ticketIds.push(created.id);
    return created;
  }

  // Test-only cleanup: history is append-only, so triggers are bypassed for this session's
  // own fixture rows (needs a superuser such as the local Docker role). Failure leaves the rows.
  async function cleanup() {
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
        await tx.actionTakenRevision.deleteMany({ where: { action: { ticketId: { in: ticketIds } } } });
        await tx.actionTaken.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await tx.ticketStatusEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await tx.ticket.deleteMany({ where: { id: { in: ticketIds } } });
        await tx.authSession.deleteMany({ where: { userId: { in: userIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      })
      .catch(() => undefined);
  }

  return { user, ticket, cleanup };
}

export const iso = (date: Date) => date.toISOString();

export function send(method: "post" | "patch" | "get", path: string, cookie: string, body?: object) {
  const call = request(app)[method](path).set("Cookie", cookie);
  return body ? call.send(body) : call;
}

export async function ticketStamp(ticketId: number) {
  return iso((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).updatedAt);
}

export function createBody(ticketUpdatedAt: string, extra: Record<string, unknown> = {}) {
  return {
    mutationId: randomUUID(),
    ticketUpdatedAt,
    actionAt: iso(new Date(Date.now() - 60_000)),
    description: "Check the wireless adapter",
    followUpRequired: false,
    ...extra,
  };
}

// Creates an Action through the API and returns it with the next Ticket timestamp.
export async function createAction(ticketId: number, cookie: string, extra: Record<string, unknown> = {}) {
  const response = await send("post", `/api/tickets/${ticketId}/actions-taken`, cookie, createBody(await ticketStamp(ticketId), extra));
  if (response.status !== 201) throw new Error(`create failed: ${response.status} ${JSON.stringify(response.body)}`);
  return response.body as { action: { id: number; version: number; status: string }; ticketUpdatedAt: string };
}

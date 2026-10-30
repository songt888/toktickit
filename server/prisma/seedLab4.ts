import type { Prisma, PrismaClient, TicketStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { hashPassword, MIGRATION_PLACEHOLDER_HASH } from "../src/password.js";
import { formatTicketNumber } from "../src/ticketNumber.js";

// Independent dashboard fixtures: neither owns Tickets or Actions.
export const emptyRequesterSeed = {
  name: "Malee Newcomer",
  email: "malee.newcomer@example.com",
} as const;
export const emptyStaffSeed = {
  name: "Kittipong Fresh",
  email: "kittipong.fresh@example.com",
} as const;

type ActionSeed = {
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  performer: string;
  assignee: string;
  description: string;
  result?: string;
  followUpNote?: string;
  attachmentNotes?: string;
  cancellationReason?: string;
  // Status after whose event this Action was recorded; default is the first move.
  after?: TicketStatus;
};

type TicketSeed = {
  // Stable fixture identity; the Ticket Number is built from it and the first-seed date.
  key: string;
  requester: string;
  owner: string | null;
  summary: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  // Permitted-transition path after creation (spec section 4 matrix).
  path: TicketStatus[];
  actions: ActionSeed[];
  // Age of the Ticket at first seed; default 5 days keeps resolutions inside the 7-day window.
  daysAgo?: number;
};

const ari = "ari.suksan@example.com";
const ben = "ben.chaiyo@example.com";
const mali = "mali.prasert@example.com";
const narin = "narin.wattan@example.com";
const staff1 = "nattakit.support@example.com";
const staff2 = "suda.servicedesk@example.com";
const staff3 = "korn.infrastructure@example.com";
const admin = "lab.admin@example.com";

export const lab4Tickets: TicketSeed[] = [
  { key: "910001", requester: ari, owner: null, summary: "New laptop request", priority: "LOW", path: [], actions: [] },
  {
    key: "910002", requester: ben, owner: staff1, summary: "Shared drive access", priority: "MEDIUM", path: ["OPEN"],
    actions: [{ status: "PLANNED", performer: staff1, assignee: staff1, description: "Ask the file server team to add the group." }],
  },
  {
    key: "910003", requester: mali, owner: staff1, summary: "Slow VPN connection", priority: "HIGH", path: ["OPEN", "IN_PROGRESS"],
    actions: [
      { status: "COMPLETED", performer: staff1, assignee: staff1, description: "Check VPN client logs.", result: "Found an outdated client; update packaged." },
      { status: "PLANNED", performer: staff1, assignee: staff2, description: "Roll out the VPN client update.", followUpNote: "Verify speed after the update." },
    ],
  },
  {
    key: "910004", requester: narin, owner: staff2, summary: "Payroll system outage", priority: "URGENT", path: ["OPEN", "IN_PROGRESS"],
    actions: [
      { status: "IN_PROGRESS", performer: staff2, assignee: admin, description: "Restart the payroll service." },
      { status: "CANCELLED", performer: staff2, assignee: staff2, description: "Reboot the host.", cancellationReason: "Service restart was enough." },
      { status: "COMPLETED", performer: admin, assignee: admin, description: "Collect error logs.", result: "Logs attached to the vendor case.", followUpNote: "Review logs with the vendor.", attachmentNotes: "Look for payroll-error.log in the shared folder." },
    ],
  },
  {
    key: "910005", requester: ari, owner: staff3, summary: "Printer driver missing", priority: "MEDIUM", path: ["OPEN", "WAITING_FOR_REQUESTER"],
    actions: [{ status: "COMPLETED", performer: staff3, assignee: staff3, description: "Prepare the driver package.", result: "Package ready; waiting for the requester to confirm the model." }],
  },
  {
    key: "910006", requester: ben, owner: staff1, summary: "Email sync problem", priority: "HIGH", path: ["OPEN", "IN_PROGRESS", "RESOLVED"],
    actions: [
      { status: "COMPLETED", performer: staff1, assignee: staff1, description: "Reset the mailbox profile.", result: "Profile rebuilt." },
      { status: "COMPLETED", performer: staff2, assignee: staff2, description: "Confirm sync on the phone.", result: "Sync works." },
      { status: "CANCELLED", performer: staff1, assignee: staff1, description: "Reinstall the mail app.", cancellationReason: "Not needed after the reset." },
    ],
  },
  {
    key: "910007", requester: mali, owner: staff2, summary: "Monitor flicker", priority: "LOW", path: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"], daysAgo: 12,
    actions: [{ status: "COMPLETED", performer: staff2, assignee: staff2, description: "Swap the cable.", result: "Flicker gone." }],
  },
  {
    key: "910008", requester: narin, owner: staff3, summary: "Badge reader offline", priority: "URGENT", path: ["OPEN", "IN_PROGRESS", "RESOLVED", "REOPENED"],
    actions: [
      { status: "COMPLETED", performer: staff3, assignee: staff3, description: "Replace the reader power supply.", result: "Reader online." },
      { status: "PLANNED", performer: staff3, assignee: staff1, description: "Re-check after the failure returned.", after: "REOPENED" },
    ],
  },
  { key: "910009", requester: ari, owner: null, summary: "Duplicate request", priority: "MEDIUM", path: ["CANCELLED"], actions: [] },
  { key: "910010", requester: ben, owner: null, summary: "Account locked out", priority: "HIGH", path: [], actions: [] },
  { key: "910011", requester: mali, owner: null, summary: "Keyboard replacement", priority: "LOW", path: ["OPEN"], actions: [] },
];

export const fixtureMarker = (key: string) => `[lab4-fixture ${key}]`;
export const lab4TicketWhere = { description: { contains: "[lab4-fixture " } };

function stableUuid(key: string): string {
  const h = createHash("sha1").update(`toktickit-lab4:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function ensureUser(
  tx: Prisma.TransactionClient,
  seed: { name: string; email: string },
  role: "REQUESTER" | "IT_STAFF",
) {
  const existing = await tx.user.findUnique({ where: { email: seed.email } });
  if (existing) return existing;
  const password = process.env.LAB3_SEED_INITIAL_PASSWORD?.trim();
  return tx.user.create({
    data: {
      ...seed,
      role,
      passwordHash: password ? hashPassword(password) : MIGRATION_PLACEHOLDER_HASH,
    },
  });
}

// Create-if-missing: a Ticket that already exists keeps whatever the app did to it.
export async function seedLab4Data(database: PrismaClient) {
  await database.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4004)`;
      await ensureUser(tx, emptyRequesterSeed, "REQUESTER");
      await ensureUser(tx, emptyStaffSeed, "IT_STAFF");

      const users = new Map((await tx.user.findMany()).map((user) => [user.email, user]));
      const category = await tx.category.findFirst({ where: { name: "Hardware" } });
      const system = await tx.relatedSystem.findFirst({ where: { name: "Laptop and Desktop" } });
      if (!category || !system) throw new Error("Lab 4 seed references are missing");
      const need = (email: string) => {
        const user = users.get(email);
        if (!user) throw new Error(`Lab 4 seed user is missing: ${email}`);
        return user;
      };

      // Relative to now so recent-resolution dashboards have real data; reruns skip existing Tickets.
      const now = Date.now();

      for (const t of lab4Tickets) {
        if (await tx.ticket.findFirst({ where: { description: { contains: fixtureMarker(t.key) } } })) continue;

        const requester = need(t.requester);
        const owner = t.owner ? need(t.owner) : null;
        const actor = owner ?? need(staff1);
        const start = now - (t.daysAgo ?? 5) * 86_400_000;
        const created = new Date(start);
        const path: TicketStatus[] = ["NEW", ...t.path];
        const times = path.map((_, step) => new Date(start + (step + 1) * 3_600_000));
        // Each Action is stamped just after the status event it follows (BR-13 history).
        const stamps = t.actions.map(
          (a, n) => new Date(times[a.after ? path.lastIndexOf(a.after) : 1].getTime() + (n + 1) * 600_000),
        );
        const lastTime = new Date(Math.max(times[times.length - 1].getTime(), ...stamps.map((d) => d.getTime())));
        const resolved = path.lastIndexOf("RESOLVED");

        const ticket = await tx.ticket.create({
          data: {
            ticketNumber: formatTicketNumber(Number(t.key), created),
            ticketDate: created,
            requesterId: requester.id,
            ownerId: owner?.id ?? null,
            categoryId: category.id,
            relatedSystemId: system.id,
            summary: t.summary,
            description: `${t.summary}. Seeded Lab 4 fixture ${fixtureMarker(t.key)}.`,
            requestedPriority: t.priority,
            itPriority: t.priority,
            currentStatus: path[path.length - 1],
            lastResolvedAt: resolved >= 0 ? times[resolved] : null,
            createdAt: created,
            updatedAt: lastTime,
          },
        });

        await tx.ticketStatusEvent.createMany({
          data: path.map((toStatus, step) => ({
            ticketId: ticket.id,
            actorId: step === 0 ? requester.id : actor.id,
            fromStatus: step === 0 ? null : path[step - 1],
            toStatus,
            createdAt: times[step],
          })),
        });

        for (const [n, a] of t.actions.entries()) {
          const performer = need(a.performer);
          const assignee = need(a.assignee);
          const stamp = stamps[n];
          const row = {
            ticketId: ticket.id,
            performedById: performer.id,
            assigneeId: assignee.id,
            actionAt: stamp,
            description: a.description,
            result: a.result ?? "",
            followUpRequired: Boolean(a.followUpNote),
            followUpNote: a.followUpNote ?? null,
            attachmentNotes: a.attachmentNotes ?? null,
            status: a.status,
            cancellationReason: a.cancellationReason ?? null,
            version: 1,
            createdAt: stamp,
            updatedAt: stamp,
          };
          const action = await tx.actionTaken.create({ data: row });
          const key = `${t.key}#${n}`;
          await tx.actionTakenRevision.create({
            data: {
              actionId: action.id,
              version: 1,
              actorId: performer.id,
              operation: "CREATE",
              mutationId: stableUuid(key),
              requestHash: createHash("sha256").update(`seed:${key}`).digest("hex"),
              ticketUpdatedAt: lastTime,
              createdAt: stamp,
              snapshot: {
                id: action.id,
                ...row,
                actionAt: stamp.toISOString(),
                createdAt: stamp.toISOString(),
                updatedAt: stamp.toISOString(),
                performedBy: { id: performer.id, name: performer.name },
                assignee: { id: assignee.id, name: assignee.name, role: assignee.role, isActive: assignee.isActive },
                actorName: performer.name,
              },
            },
          });
        }
      }
    },
    { timeout: 30_000 },
  );
  console.log("Seeded Lab 4 Tickets, Actions Taken, revisions, and status events.");
}

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { seedLab3Data } from "../../prisma/seed.js";
import { seedLab4Data } from "../../prisma/seedLab4.js";

const serverDir = fileURLToPath(new URL("../../", import.meta.url));
const lab3Tables = ["User", "Category", "RelatedSystem", "Ticket", "Attachment", "PublicComment", "InternalNote", "AuthSession"];
const stamp = `${process.pid}_${Date.now()}`;
const dbA = `lab4_upgrade_${stamp}`;
const dbB = `lab4_restore_${stamp}`;
const tmp = mkdtempSync(path.join(tmpdir(), "lab4-migrations-"));
// Private uploads dir: the shared server/uploads is edited by other suites in parallel.
const uploadsDir = path.join(tmp, "uploads");
mkdirSync(uploadsDir);
const admin = getPrisma();
const clients: PrismaClient[] = [];

function baseUrl(): URL {
  const fromEnv = process.env.DATABASE_URL;
  const fromFile = /^DATABASE_URL="?([^"\n]+)"?/m.exec(readFileSync(path.join(serverDir, ".env"), "utf8"))?.[1];
  return new URL((fromEnv ?? fromFile)!);
}
function urlFor(db: string): string {
  const url = baseUrl();
  url.pathname = `/${db}`;
  return url.toString();
}
function clientFor(db: string): PrismaClient {
  const client = new PrismaClient({ datasources: { db: { url: urlFor(db) } } });
  clients.push(client);
  return client;
}

// `prisma migrate deploy` against a scratch database; `upTo` omits the Lab 4 migration.
function deploy(db: string, includeLab4: boolean) {
  const dir = path.join(tmp, includeLab4 ? "full" : "lab3");
  rmSync(dir, { recursive: true, force: true });
  cpSync(path.join(serverDir, "prisma", "schema.prisma"), path.join(dir, "schema.prisma"));
  cpSync(path.join(serverDir, "prisma", "migrations"), path.join(dir, "migrations"), {
    recursive: true,
    filter: (src) => includeLab4 || !path.basename(src).includes("lab4"),
  });
  return execFileSync(path.join(serverDir, "node_modules", ".bin", "prisma"), ["migrate", "deploy", "--schema", path.join(dir, "schema.prisma")], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: urlFor(db) },
    encoding: "utf8",
  });
}

async function populateLab3(db: PrismaClient) {
  const hash = "scrypt$00112233445566778899aabbccddeeff$" + "ab".repeat(64);
  const user = await db.user.create({
    data: { name: "Legacy Requester", email: "legacy.requester@example.com", passwordHash: hash, role: "REQUESTER", mustChangePassword: false, passwordChangedAt: new Date("2026-09-20T01:02:03Z"), createdAt: new Date("2026-09-19T00:00:00Z") },
    select: { id: true },
  });
  const staff = await db.user.create({
    data: { name: "Legacy Staff", email: "legacy.staff@example.com", passwordHash: hash, role: "IT_STAFF", createdAt: new Date("2026-09-19T00:00:00Z") },
    select: { id: true },
  });
  const category = await db.category.create({ data: { name: "Legacy Category" }, select: { id: true } });
  const system = await db.relatedSystem.create({ data: { name: "Legacy System X" }, select: { id: true } });
  for (const [n, status] of (["NEW", "RESOLVED", "CLOSED"] as const).entries()) {
    const ticket = await db.ticket.create({
      data: {
        ticketNumber: `TKT-20260901-00000${n}`, requesterId: user.id, ownerId: n ? staff.id : null, categoryId: category.id, relatedSystemId: system.id,
        summary: `Legacy ticket ${n}`, description: "Created before Lab 4.", requestedPriority: "MEDIUM", itPriority: "HIGH", currentStatus: status,
        ticketDate: new Date("2026-09-01T03:00:00Z"), createdAt: new Date("2026-09-01T03:00:00Z"), updatedAt: new Date("2026-09-10T03:00:00Z"),
      },
      select: { id: true },
    });
    await db.publicComment.create({ data: { ticketId: ticket.id, authorId: user.id, content: `Comment ${n}` }, select: { id: true } });
    await db.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, content: `Note ${n}` }, select: { id: true } });
    const storedName = `stored-${stamp}-${n}.png`;
    writeFileSync(path.join(uploadsDir, storedName), Buffer.alloc(1000 + n, n + 1));
    await db.attachment.create({ data: { ticketId: ticket.id, originalName: `file${n}.png`, storedName, mimeType: "image/png", sizeBytes: 1000 + n }, select: { id: true } });
  }
  await db.authSession.create({ data: { userId: user.id, tokenHash: `hash-${stamp}`, expiresAt: new Date("2030-01-01T00:00:00Z") }, select: { id: true } });
}

// Every Lab 3 row as JSON, with the one column Lab 4 adds removed.
async function lab3Rows(db: PrismaClient) {
  const out: Record<string, unknown[]> = {};
  for (const table of lab3Tables) {
    const rows = await db.$queryRawUnsafe<Array<{ row: Record<string, unknown> }>>(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY id`);
    out[table] = rows.map(({ row }) => {
      const { lastResolvedAt: _ignored, ...rest } = row;
      return rest;
    });
  }
  return out;
}
async function sequences(db: PrismaClient, names?: string[]) {
  const rows = await db.$queryRawUnsafe<Array<{ sequencename: string; last_value: bigint | null }>>(
    `SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename`,
  );
  return Object.fromEntries(rows.filter((r) => !names || names.includes(r.sequencename)).map((r) => [r.sequencename, String(r.last_value)]));
}

// The Attachment files are never touched by the migration; name, size and content hash prove it.
function uploadManifest() {
  return readdirSync(uploadsDir).sort().map((name) => {
    const file = path.join(uploadsDir, name);
    return [name, statSync(file).size, createHash("sha256").update(readFileSync(file)).digest("hex")];
  });
}

describe("Lab 4 migration on a populated Lab 3 database (DB-02)", () => {
  afterAll(async () => {
    await Promise.all(clients.map((c) => c.$disconnect()));
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbA}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbB}" WITH (FORCE)`);
    rmSync(tmp, { recursive: true, force: true });
    await admin.$disconnect();
  });

  it("DB-02 upgrades, preserves every old row and sequence, restores a snapshot, and reseeds safely", async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbA}"`);
    deploy(dbA, false);
    const lab3 = clientFor(dbA);
    await populateLab3(lab3);
    const rowsBefore = await lab3Rows(lab3);
    const seqBefore = await sequences(lab3);
    const filesBefore = uploadManifest();
    // Every legacy Attachment row has its file, with the recorded size.
    expect(filesBefore.map(([name, size]) => [name, size])).toEqual(
      (rowsBefore.Attachment as Array<{ storedName: string; sizeBytes: number }>).map((a) => [a.storedName, a.sizeBytes]).sort(),
    );
    expect(rowsBefore.Ticket).toHaveLength(3);
    await lab3.$disconnect();

    // Snapshot: a template copy stands in for the verified pre-deploy backup.
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbB}" TEMPLATE "${dbA}"`);

    // Upgrade: old rows, hashes, timestamps, FKs, sequences and files are unchanged; nothing is invented.
    deploy(dbA, true);
    const upgraded = clientFor(dbA);
    expect(await lab3Rows(upgraded)).toEqual(rowsBefore);
    expect(uploadManifest()).toEqual(filesBefore);
    expect(await sequences(upgraded, Object.keys(seqBefore))).toEqual(seqBefore);
    const nulls = await upgraded.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM "Ticket" WHERE "lastResolvedAt" IS NOT NULL`;
    expect(Number(nulls[0].n)).toBe(0);
    for (const table of ["ActionTaken", "ActionTakenRevision", "TicketStatusEvent"]) {
      const rows = await upgraded.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "${table}"`);
      expect(Number(rows[0].n)).toBe(0);
    }
    const unvalidated = await upgraded.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM pg_constraint WHERE contype = 'f' AND NOT convalidated`;
    expect(Number(unvalidated[0].n)).toBe(0);

    // Reseeding twice keeps the legacy rows and credentials, and the second run moves no sequence.
    await seedLab3Data(upgraded);
    await seedLab4Data(upgraded);
    const afterFirst = { seq: await sequences(upgraded), rows: await lab3Rows(upgraded) };
    await seedLab4Data(upgraded);
    expect({ seq: await sequences(upgraded), rows: await lab3Rows(upgraded) }).toEqual(afterFirst);
    for (const table of lab3Tables) {
      const legacy = rowsBefore[table] as Array<{ id: number }>;
      const now = afterFirst.rows[table] as Array<{ id: number }>;
      for (const row of legacy) {
        const match = now.find((r) => r.id === row.id);
        // Legacy rows may only change through the Lab 3 seed's own fixtures, never ours; users stay identical.
        if (table === "User" || table === "Ticket") expect(match).toEqual(row);
      }
    }
    expect(await upgraded.actionTaken.count()).toBeGreaterThan(0);

    // A fresh seed gives the 7-day recent-resolution window real data on both sides.
    const since = new Date(Date.now() - 7 * 86_400_000);
    expect(await upgraded.ticket.count({ where: { lastResolvedAt: { gte: since }, currentStatus: { in: ["RESOLVED", "CLOSED"] } } })).toBeGreaterThan(0);
    expect(await upgraded.ticket.count({ where: { lastResolvedAt: { lt: since } } })).toBeGreaterThan(0);

    // Forward repair: redeploying on the upgraded database is a no-op that keeps every row.
    const countBefore = await upgraded.ticket.count();
    expect(deploy(dbA, true)).toMatch(/No pending migrations/);
    expect(await upgraded.ticket.count()).toBe(countBefore);

    // Restore: replace the upgraded, written-to database with the pre-deploy backup.
    await upgraded.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE "${dbA}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbA}" TEMPLATE "${dbB}"`);
    const restored = clientFor(dbA);
    expect(await lab3Rows(restored)).toEqual(rowsBefore);
    expect(await sequences(restored)).toEqual(seqBefore);
    const lab4Tables = await restored.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('ActionTaken', 'ActionTakenRevision', 'TicketStatusEvent')`;
    expect(Number(lab4Tables[0].n)).toBe(0);
    expect(uploadManifest()).toEqual(filesBefore);
    await restored.$disconnect();

    // Redeploying onto the restored database works and still preserves every old row.
    expect(deploy(dbA, true)).toMatch(/lab4_actions_status_history/);
    expect(await lab3Rows(clientFor(dbA))).toEqual(rowsBefore);
  }, 180_000);
});

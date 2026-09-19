-- Lab 3 Issue 2: migrate RequesterUser into the role-based User model.

-- Normalize existing emails before the new User unique constraint is used.
UPDATE "RequesterUser"
SET "email" = lower(trim("email"));

-- Preserve the existing IDs and all foreign-key values while changing the
-- table identity used by Prisma.
ALTER TABLE "RequesterUser" RENAME TO "User";
ALTER INDEX "RequesterUser_email_key" RENAME TO "User_email_key";
ALTER SEQUENCE "RequesterUser_id_seq" RENAME TO "User_id_seq";
DROP INDEX "RequesterUser_isActive_name_idx";

CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'REQUESTER',
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- This value is intentionally unusable as a password. The repeatable seed may
-- replace it only when the value is still exactly this placeholder.
UPDATE "User"
SET "passwordHash" = 'scrypt$placeholder$lab3-migration-only';

ALTER TABLE "User"
ALTER COLUMN "passwordHash" SET NOT NULL;

CREATE INDEX "User_isActive_role_name_idx"
ON "User"("isActive", "role", "name");

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "Ticket"
ADD COLUMN "ownerId" INTEGER,
ADD COLUMN "itPriority" "TicketPriority",
ADD COLUMN "problemAppearsResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "problemAppearsResolvedAt" TIMESTAMP(3);

UPDATE "Ticket"
SET "itPriority" = "requestedPriority";

ALTER TABLE "Ticket"
ALTER COLUMN "itPriority" SET NOT NULL;

CREATE INDEX "Ticket_ownerId_currentStatus_updatedAt_idx"
ON "Ticket"("ownerId", "currentStatus", "updatedAt");

CREATE INDEX "Ticket_currentStatus_itPriority_updatedAt_idx"
ON "Ticket"("currentStatus", "itPriority", "updatedAt");

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "PublicComment_ticketId_createdAt_id_idx"
ON "PublicComment"("ticketId", "createdAt", "id");
CREATE INDEX "InternalNote_ticketId_createdAt_id_idx"
ON "InternalNote"("ticketId", "createdAt", "id");
CREATE INDEX "AuthSession_userId_expiresAt_idx"
ON "AuthSession"("userId", "expiresAt");

ALTER TABLE "PublicComment"
ADD CONSTRAINT "PublicComment_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublicComment"
ADD CONSTRAINT "PublicComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InternalNote"
ADD CONSTRAINT "InternalNote_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InternalNote"
ADD CONSTRAINT "InternalNote_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

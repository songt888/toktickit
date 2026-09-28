-- Lab 3 Issue 2: align the migrated database with schema.prisma.
-- This is a follow-up instead of rewriting the already-applied foundation
-- migration, so existing environments keep a verifiable migration history.

DROP INDEX IF EXISTS "Ticket_requesterId_categoryId_idx";
DROP INDEX IF EXISTS "Ticket_requesterId_currentStatus_idx";
DROP INDEX IF EXISTS "Ticket_requesterId_requestedPriority_idx";

ALTER TABLE "User"
RENAME CONSTRAINT "RequesterUser_pkey" TO "User_pkey";

ALTER TABLE "AuthSession"
DROP CONSTRAINT "AuthSession_userId_fkey";

ALTER TABLE "AuthSession"
ADD CONSTRAINT "AuthSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

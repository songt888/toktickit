-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionOperation" AS ENUM ('CREATE', 'EDIT', 'ASSIGN', 'STATUS');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "lastResolvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "performedById" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "result" VARCHAR(4000) NOT NULL DEFAULT '',
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" VARCHAR(2000),
    "attachmentNotes" VARCHAR(2000),
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "cancellationReason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionTakenRevision" (
    "id" SERIAL NOT NULL,
    "actionId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "operation" "ActionOperation" NOT NULL,
    "mutationId" UUID NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "ticketUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionTakenRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusEvent" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx" ON "ActionTaken"("ticketId", "actionAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_status_idx" ON "ActionTaken"("ticketId", "status");

-- CreateIndex
CREATE INDEX "ActionTaken_assigneeId_status_updatedAt_id_idx" ON "ActionTaken"("assigneeId", "status", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTakenRevision_actionId_version_key" ON "ActionTakenRevision"("actionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTakenRevision_actorId_mutationId_key" ON "ActionTakenRevision"("actorId", "mutationId");

-- CreateIndex
CREATE INDEX "TicketStatusEvent_ticketId_createdAt_id_idx" ON "TicketStatusEvent"("ticketId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Ticket_lastResolvedAt_id_idx" ON "Ticket"("lastResolvedAt", "id");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusEvent" ADD CONSTRAINT "TicketStatusEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusEvent" ADD CONSTRAINT "TicketStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database checks (spec section 6). Cross-row rules (assignee eligibility, actionAt
-- against the Ticket) stay in the locking transaction, not here.
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "ActionTaken_description_check" CHECK (length(btrim("description")) >= 1),
  ADD CONSTRAINT "ActionTaken_followUp_check" CHECK (
    ("followUpRequired" AND "followUpNote" IS NOT NULL AND length(btrim("followUpNote")) >= 1)
    OR (NOT "followUpRequired" AND "followUpNote" IS NULL)
  ),
  ADD CONSTRAINT "ActionTaken_result_check" CHECK (
    "status" <> 'COMPLETED' OR length(btrim("result")) >= 1
  ),
  ADD CONSTRAINT "ActionTaken_cancellation_check" CHECK (
    ("status" = 'CANCELLED' AND "cancellationReason" IS NOT NULL AND length(btrim("cancellationReason")) >= 5)
    OR ("status" <> 'CANCELLED' AND "cancellationReason" IS NULL)
  );

-- Revisions and Ticket status events are append-only, including direct SQL.
CREATE FUNCTION "lab4_reject_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ActionTakenRevision_append_only"
  BEFORE UPDATE OR DELETE ON "ActionTakenRevision"
  FOR EACH ROW EXECUTE FUNCTION "lab4_reject_change"();

CREATE TRIGGER "TicketStatusEvent_append_only"
  BEFORE UPDATE OR DELETE ON "TicketStatusEvent"
  FOR EACH ROW EXECUTE FUNCTION "lab4_reject_change"();

-- An Action keeps its identity, Ticket, performer and creation time, and every
-- update raises the version by exactly one.
CREATE FUNCTION "lab4_action_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."id" <> OLD."id"
     OR NEW."ticketId" <> OLD."ticketId"
     OR NEW."performedById" <> OLD."performedById"
     OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'ActionTaken id, ticketId, performedById and createdAt are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'ActionTaken version must increase by exactly one'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ActionTaken_guard"
  BEFORE UPDATE ON "ActionTaken"
  FOR EACH ROW EXECUTE FUNCTION "lab4_action_guard"();

-- At commit, the current Action version must have a revision whose snapshot
-- matches every scalar field, so a projection-only write cannot commit.
CREATE FUNCTION "lab4_action_revision_check"() RETURNS trigger AS $$
DECLARE
  snap jsonb;
BEGIN
  SELECT "snapshot" INTO snap FROM "ActionTakenRevision"
   WHERE "actionId" = NEW."id" AND "version" = NEW."version";
  IF snap IS NULL
     OR (snap->>'id')::int IS DISTINCT FROM NEW."id"
     OR (snap->>'ticketId')::int IS DISTINCT FROM NEW."ticketId"
     OR (snap->>'performedById')::int IS DISTINCT FROM NEW."performedById"
     OR (snap->>'assigneeId')::int IS DISTINCT FROM NEW."assigneeId"
     OR (snap->>'description') IS DISTINCT FROM NEW."description"
     OR (snap->>'result') IS DISTINCT FROM NEW."result"
     OR (snap->>'followUpRequired')::boolean IS DISTINCT FROM NEW."followUpRequired"
     OR (snap->>'followUpNote') IS DISTINCT FROM NEW."followUpNote"
     OR (snap->>'attachmentNotes') IS DISTINCT FROM NEW."attachmentNotes"
     OR (snap->>'status') IS DISTINCT FROM NEW."status"::text
     OR (snap->>'cancellationReason') IS DISTINCT FROM NEW."cancellationReason"
     OR (snap->>'version')::int IS DISTINCT FROM NEW."version"
     OR ((snap->>'actionAt')::timestamptz AT TIME ZONE 'UTC') IS DISTINCT FROM NEW."actionAt"
     OR ((snap->>'createdAt')::timestamptz AT TIME ZONE 'UTC') IS DISTINCT FROM NEW."createdAt"
     OR ((snap->>'updatedAt')::timestamptz AT TIME ZONE 'UTC') IS DISTINCT FROM NEW."updatedAt" THEN
    RAISE EXCEPTION 'ActionTaken % version % has no matching revision snapshot', NEW."id", NEW."version"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ActionTaken_revision_check"
  AFTER INSERT OR UPDATE ON "ActionTaken"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "lab4_action_revision_check"();

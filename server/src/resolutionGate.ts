import type { ActionStatus, Prisma } from "@prisma/client";

export type ResolutionGate = {
  canResolve: boolean;
  completedActions: number;
  pendingActions: number;
  unsettledFollowUpActions: number;
};

// BR-13: at least one completed Action, none pending, and no completed Action still needing follow-up.
export function evaluateResolutionGate(actions: Array<{ status: ActionStatus; followUpRequired: boolean }>): ResolutionGate {
  const completed = actions.filter((action) => action.status === "COMPLETED");
  const completedActions = completed.length;
  const pendingActions = actions.filter((action) => action.status === "PLANNED" || action.status === "IN_PROGRESS").length;
  const unsettledFollowUpActions = completed.filter((action) => action.followUpRequired).length;
  return {
    canResolve: completedActions > 0 && pendingActions === 0 && unsettledFollowUpActions === 0,
    completedActions,
    pendingActions,
    unsettledFollowUpActions,
  };
}

export async function readResolutionGate(database: Pick<Prisma.TransactionClient, "actionTaken">, ticketId: number) {
  return evaluateResolutionGate(
    await database.actionTaken.findMany({ where: { ticketId }, select: { status: true, followUpRequired: true } }),
  );
}

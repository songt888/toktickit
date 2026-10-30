import type { ActionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluateResolutionGate } from "../../src/resolutionGate.js";

const action = (status: ActionStatus, followUpRequired = false) => ({ status, followUpRequired });

describe("Resolution gate truth table (UNIT-04)", () => {
  it.each([
    ["no Actions (legacy or new)", [], false],
    ["only cancelled Actions", [action("CANCELLED"), action("CANCELLED")], false],
    ["a planned Action", [action("COMPLETED"), action("PLANNED")], false],
    ["an in-progress Action", [action("COMPLETED"), action("IN_PROGRESS")], false],
    ["a completed Action with unsettled follow-up", [action("COMPLETED", true)], false],
    ["completed work with a cancelled Action", [action("COMPLETED"), action("CANCELLED")], true],
    ["several completed, settled Actions", [action("COMPLETED"), action("COMPLETED")], true],
  ] as const)("%s", (_name, actions, canResolve) => {
    expect(evaluateResolutionGate([...actions]).canResolve).toBe(canResolve);
  });

  it("reports the counts the UI explains", () => {
    expect(evaluateResolutionGate([action("COMPLETED", true), action("PLANNED"), action("IN_PROGRESS"), action("CANCELLED")])).toEqual({
      canResolve: false, completedActions: 1, pendingActions: 2, unsettledFollowUpActions: 1,
    });
  });

  it("takes no Requester input: the advisory flag cannot satisfy or block it", () => {
    // The gate's only input is the Action list; problemAppearsResolved is not a parameter.
    expect(evaluateResolutionGate.length).toBe(1);
  });
});

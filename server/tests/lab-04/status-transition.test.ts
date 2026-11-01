import { describe, expect, it } from "vitest";
import { isPermittedStatusTransition, statusTransitionNeedsConfirmation } from "../../src/statusTransition.js";
import { isAllowed, ticketStatuses } from "./workflowExpectations.js";

describe("Ticket transition matrix (UNIT-03)", () => {
  it("permits exactly the approved pairs among all 64, with no same-status move", () => {
    let checked = 0;
    for (const from of ticketStatuses) {
      for (const to of ticketStatuses) {
        expect(isPermittedStatusTransition(from, to), `${from} -> ${to}`).toBe(isAllowed(from, to));
        checked++;
      }
    }
    expect(checked).toBe(64);
  });

  it("requires confirmation exactly for Closed and Cancelled", () => {
    expect(ticketStatuses.filter(statusTransitionNeedsConfirmation)).toEqual(["CLOSED", "CANCELLED"]);
  });
});

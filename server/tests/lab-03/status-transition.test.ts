import { describe, expect, it } from "vitest";
import type { TicketStatus } from "@prisma/client";
import {
  isPermittedStatusTransition,
  permittedStatusTransitions,
  statusTransitionNeedsConfirmation,
} from "../../src/statusTransition.js";

describe("Staff Ticket status transition rules", () => {
  it("allows exactly the documented transition matrix", () => {
    for (const [current, permitted] of Object.entries(permittedStatusTransitions) as [TicketStatus, TicketStatus[]][]) {
      for (const next of Object.keys(permittedStatusTransitions) as TicketStatus[]) {
        expect(isPermittedStatusTransition(current, next)).toBe(permitted.includes(next));
      }
    }
  });

  it("requires explicit confirmation only for Closed and Cancelled", () => {
    expect(statusTransitionNeedsConfirmation("CLOSED")).toBe(true);
    expect(statusTransitionNeedsConfirmation("CANCELLED")).toBe(true);
    for (const status of Object.keys(permittedStatusTransitions) as TicketStatus[]) {
      if (status !== "CLOSED" && status !== "CANCELLED") {
        expect(statusTransitionNeedsConfirmation(status)).toBe(false);
      }
    }
  });
});

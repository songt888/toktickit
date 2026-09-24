import { describe, expect, it } from "vitest";
import type { TicketStatus } from "@prisma/client";
import {
  isPermittedStatusTransition,
  permittedStatusTransitions,
  statusTransitionNeedsConfirmation,
} from "../../src/statusTransition.js";

describe("Staff Ticket status transition rules", () => {
  const statuses: TicketStatus[] = [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CLOSED",
    "REOPENED",
    "CANCELLED",
  ];
  const expectedTransitions: Record<TicketStatus, readonly TicketStatus[]> = {
    NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
    OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
    IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
    WAITING_FOR_REQUESTER: ["IN_PROGRESS", "REOPENED", "CANCELLED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
    CANCELLED: ["REOPENED"],
  };

  it("allows exactly the documented transition matrix", () => {
    expect(permittedStatusTransitions).toEqual(expectedTransitions);
    for (const current of statuses) {
      for (const next of statuses) {
        const permitted = expectedTransitions[current];
        expect(isPermittedStatusTransition(current, next)).toBe(permitted.includes(next));
      }
    }
  });

  it("requires explicit confirmation only for Closed and Cancelled", () => {
    expect(statusTransitionNeedsConfirmation("CLOSED")).toBe(true);
    expect(statusTransitionNeedsConfirmation("CANCELLED")).toBe(true);
    for (const status of statuses) {
      if (status !== "CLOSED" && status !== "CANCELLED") {
        expect(statusTransitionNeedsConfirmation(status)).toBe(false);
      }
    }
  });
});

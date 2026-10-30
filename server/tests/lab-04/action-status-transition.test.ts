import { describe, expect, it } from "vitest";
import { actionStatuses, isPermittedActionMove } from "../../src/actionValidation.js";

// Independent copy of BR-07, so a change to the code's table cannot silently pass.
const expected = new Set([
  "PLANNED>IN_PROGRESS",
  "PLANNED>COMPLETED",
  "PLANNED>CANCELLED",
  "IN_PROGRESS>COMPLETED",
  "IN_PROGRESS>CANCELLED",
]);

describe("Action lifecycle pairs (UNIT-02)", () => {
  it("permits exactly the specified moves among all 16 pairs, including no same-status move", () => {
    for (const from of actionStatuses) {
      for (const to of actionStatuses) {
        expect(isPermittedActionMove(from, to), `${from} -> ${to}`).toBe(expected.has(`${from}>${to}`));
      }
    }
  });
});

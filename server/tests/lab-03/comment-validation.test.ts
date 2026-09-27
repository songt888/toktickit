import { describe, expect, it } from "vitest";
import { validateCommentContent } from "../../src/ticketValidation.js";

describe("comment and internal-note content validation", () => {
  it.each([undefined, null, 42, "", "   ", "\n\t"])(
    "rejects invalid or blank content: %s",
    (content) => {
      expect(validateCommentContent(content)).toBeTruthy();
    },
  );

  it("accepts content up to 4000 characters and rejects longer content", () => {
    expect(validateCommentContent("x".repeat(4000))).toBeNull();
    expect(validateCommentContent("x".repeat(4001))).toBeTruthy();
  });

  it("allows markup-like text under the approved plain-text rendering policy", () => {
    expect(validateCommentContent("<script>alert('not executed')</script>")).toBeNull();
  });
});

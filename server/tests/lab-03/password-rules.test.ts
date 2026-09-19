import { describe, expect, it } from "vitest";
import { validatePassword } from "../../src/auth.js";

describe("Lab 3 password rules", () => {
  it("accepts a password with the required length and character classes", () => {
    expect(validatePassword("ValidPassword123")).toBeNull();
  });

  it("rejects passwords outside the length and character rules", () => {
    expect(validatePassword("Short1A")).toContain("12 and 128");
    expect(validatePassword("alllowercase123")).toContain("uppercase");
    expect(validatePassword("ALLUPPERCASE123")).toContain("lowercase");
    expect(validatePassword("NoNumbersHere")).toContain("number");
    expect(validatePassword(" ".repeat(12))).toContain("whitespace");
    expect(validatePassword("A1" + "a".repeat(127))).toContain("12 and 128");
  });

  it("rejects non-string input", () => {
    expect(validatePassword(undefined)).toBe("Password is required.");
    expect(validatePassword(null)).toBe("Password is required.");
  });
});

import { describe, expect, it } from "vitest";
import {
  hashPassword,
  MIGRATION_PLACEHOLDER_HASH,
  verifyPassword,
} from "../../src/password.js";

describe("Lab 3 password hashing", () => {
  it("creates salted scrypt hashes that verify without storing plaintext", () => {
    const password = "LocalPassword123";
    const hash = hashPassword(password);

    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(hash).not.toContain(password);
    expect(hash).not.toBe(MIGRATION_PLACEHOLDER_HASH);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("WrongPassword123", hash)).toBe(false);
  });

  it("does not treat the migration marker as a usable password hash", () => {
    expect(verifyPassword("LocalPassword123", MIGRATION_PLACEHOLDER_HASH)).toBe(false);
  });
});

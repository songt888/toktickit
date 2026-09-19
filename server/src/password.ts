import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;

// This value is deliberately not a valid password hash. It only marks rows
// created by the migration so the seed can safely initialize them once.
export const MIGRATION_PLACEHOLDER_HASH = "scrypt$placeholder$lab3-migration-only";

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = scryptSync(password, salt, KEY_BYTES);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

// Use a real scrypt hash when the email does not match an account so that
// unknown-account attempts still perform comparable password work.
export const DUMMY_PASSWORD_HASH = hashPassword("TokTickIT_dummy_login_password_123");

export function verifyPassword(password: string, encodedHash: string): boolean {
  if (encodedHash === MIGRATION_PLACEHOLDER_HASH) return false;

  const [algorithm, saltHex, digestHex] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !saltHex || !digestHex) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(digestHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

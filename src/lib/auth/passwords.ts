import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing using Node's built-in scrypt. Format:
 *   scrypt$<salt-hex>$<derived-key-hex>
 * No external dependency, and the hash never leaves the server.
 */
const KEY_LEN = 64;
const PREFIX = 'scrypt';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LEN).toString('hex');
  return `${PREFIX}$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const [, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length === 0) return false;
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}

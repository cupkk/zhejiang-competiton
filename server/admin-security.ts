import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

function deriveHash(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex');
}

export function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${deriveHash(password, salt)}`;
}

export function verifyAdminPassword(password: string, passwordHash: string) {
  const [scheme, salt, digest] = passwordHash.split(':');
  if (scheme !== 'scrypt' || !salt || !digest) {
    return false;
  }

  const actual = Buffer.from(deriveHash(password, salt), 'hex');
  const expected = Buffer.from(digest, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

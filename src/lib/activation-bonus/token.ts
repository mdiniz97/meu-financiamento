import { createHash, randomBytes } from 'node:crypto';

export function hashActivationToken(raw: string): string | null {
  return /^[A-Za-z0-9_-]{43}$/.test(raw)
    ? createHash('sha256').update(raw).digest('hex')
    : null;
}

export function createActivationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashActivationToken(token)! };
}

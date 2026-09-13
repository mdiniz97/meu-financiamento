import { timingSafeEqual } from 'node:crypto';

export function verifyAsaasToken(header: string | null, expected: string): boolean {
  if (!header || !expected) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseAsaasEvent(
  payload: string
): ({ id: string; event: string } & Record<string, unknown>) | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.event !== 'string') return null;
  return obj as { id: string; event: string } & Record<string, unknown>;
}

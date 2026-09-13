import { timingSafeEqual } from 'node:crypto';

/**
 * Auth dos crons internos: Bearer `${CRON_SECRET}` comparado em tempo constante.
 * Sem segredo configurado, nega sempre (fail-closed).
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) return false;
  const provided = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

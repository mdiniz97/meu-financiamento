import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';

interface AccessRow {
  status: string;
  currentPeriodEnd: Date | null;
  graceUntil: Date | null;
  provider?: string | null;
}

function isAccessRowActive(sub: AccessRow, now: number): boolean {
  return sub.status === 'active'
    ? Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now)
    : Boolean(sub.graceUntil && sub.graceUntil.getTime() > now);
}

async function findLiveSubscriptions(userId: string) {
  return db.query.subscriptions.findMany({
    where: and(
      eq(schema.subscriptions.userId, userId),
      inArray(schema.subscriptions.status, ['active', 'past_due'])
    ),
  });
}

/** Acesso a recursos: trial e assinatura paga contam. */
export async function hasActiveAccess(userId: string): Promise<boolean> {
  const subs = await findLiveSubscriptions(userId);
  const now = Date.now();
  return subs.some((sub) => isAccessRowActive(sub, now));
}

/**
 * Bloqueio de nova contratação: só assinatura PAGA ativa. O trial não bloqueia,
 * para permitir assinar durante o teste grátis.
 */
export async function hasActivePaidAccess(userId: string): Promise<boolean> {
  const subs = await findLiveSubscriptions(userId);
  const now = Date.now();
  return subs.some((sub) => sub.provider !== 'trial' && isAccessRowActive(sub, now));
}

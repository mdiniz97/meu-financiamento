import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';

export async function hasActiveAccess(userId: string): Promise<boolean> {
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.userId, userId),
      inArray(schema.subscriptions.status, ['active', 'past_due'])
    ),
  });
  if (!sub) return false;
  const now = Date.now();
  if (sub.status === 'active') {
    return sub.currentPeriodEnd ? sub.currentPeriodEnd.getTime() > now : false;
  }
  return sub.graceUntil ? sub.graceUntil.getTime() > now : false;
}

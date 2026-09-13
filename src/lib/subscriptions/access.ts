import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';

export async function hasActiveAccess(userId: string): Promise<boolean> {
  const subs = await db.query.subscriptions.findMany({
    where: and(
      eq(schema.subscriptions.userId, userId),
      inArray(schema.subscriptions.status, ['active', 'past_due'])
    ),
  });
  const now = Date.now();
  return subs.some((sub) =>
    sub.status === 'active'
      ? Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now)
      : Boolean(sub.graceUntil && sub.graceUntil.getTime() > now)
  );
}

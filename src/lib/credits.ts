import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { hasActiveAccess } from '@/lib/subscriptions/access';

export async function getCreditBalance(userId: string) {
  const row = await db
    .select({
      sum: sql<number>`coalesce(sum(${schema.creditLedger.amount}), 0)::int`,
    })
    .from(schema.creditLedger)
    .where(eq(schema.creditLedger.userId, userId));
  return { credits: row[0].sum, isUnlimited: await hasActiveAccess(userId) };
}

export async function addCredits(
  userId: string,
  amount: number,
  kind: string,
  description: string
) {
  await db
    .insert(schema.creditLedger)
    .values({ userId, amount, kind, description });
}

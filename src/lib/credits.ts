import { and, eq, gt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

export async function getCreditBalance(userId: string) {
  const row = await db
    .select({
      sum: sql<number>`coalesce(sum(${schema.creditLedger.amount}), 0)::int`,
    })
    .from(schema.creditLedger)
    .where(eq(schema.creditLedger.userId, userId));
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.status, 'active'),
      gt(schema.subscriptions.currentPeriodEnd, new Date())
    ),
  });
  return { credits: row[0].sum, isUnlimited: Boolean(sub) };
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

export async function spendCredit(userId: string, description: string) {
  const { credits, isUnlimited } = await getCreditBalance(userId);
  if (isUnlimited) return true;
  if (credits < 1) return false;
  await db
    .insert(schema.creditLedger)
    .values({ userId, amount: -1, kind: 'spend', description });
  return true;
}

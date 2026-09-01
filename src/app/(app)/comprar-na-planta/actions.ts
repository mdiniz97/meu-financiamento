'use server';

import { and, eq, gt, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';

export type ConsumeCalcResult = { ok: true } | { ok: false; error: string };

export async function consumeCalcCredit(description: string): Promise<ConsumeCalcResult> {
  const session = await auth();
  if (!session?.userId) return { ok: false, error: 'Não autenticado' };

  const { isUnlimited, credits } = await getCreditBalance(session.userId);
  if (isUnlimited) return { ok: true };
  if (credits < 1) return { ok: false, error: 'Créditos insuficientes' };

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${session.userId} FOR UPDATE`);
    const [bal] = await tx
      .select({
        sum: sql<number>`coalesce(sum(${schema.creditLedger.amount}), 0)::int`,
      })
      .from(schema.creditLedger)
      .where(eq(schema.creditLedger.userId, session.userId));
    const sub = await tx.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, session.userId),
        eq(schema.subscriptions.status, 'active'),
        gt(schema.subscriptions.currentPeriodEnd, new Date())
      ),
    });
    if (sub) return { ok: true as const };
    if (bal.sum < 1) return { ok: false as const, error: 'Créditos insuficientes' };
    await tx
      .insert(schema.creditLedger)
      .values({ userId: session.userId, amount: -1, kind: 'spend', description });
    return { ok: true as const };
  });

  return result;
}

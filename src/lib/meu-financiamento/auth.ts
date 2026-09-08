import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/db';

export async function isUnlimited(userId: string): Promise<boolean> {
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.status, 'active'),
      gt(schema.subscriptions.currentPeriodEnd, new Date())
    ),
  });
  return Boolean(sub);
}

export async function requireUnlimited(userId: string): Promise<void> {
  if (!(await isUnlimited(userId))) throw new Error('Recurso exclusivo do plano Ilimitado');
}

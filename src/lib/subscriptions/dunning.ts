import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { cancelAtPeriodEnd } from '@/lib/payments/asaas/subscription';

const REMINDER_PAYMENT_STATUSES = ['PENDING', 'OVERDUE'] as const;

export async function runDunning(
  now: Date = new Date()
): Promise<{ reminded: number; suspended: number }> {
  const overdue = await db.query.subscriptions.findMany({
    where: eq(schema.subscriptions.status, 'past_due'),
  });

  let reminded = 0;
  let suspended = 0;

  for (const sub of overdue) {
    if (!sub.graceUntil) continue;

    if (sub.graceUntil.getTime() <= now.getTime()) {
      await db
        .update(schema.subscriptions)
        .set({ status: 'canceled', canceledAt: now })
        .where(eq(schema.subscriptions.id, sub.id));

      if (sub.asaasSubscriptionId) {
        try {
          await cancelAtPeriodEnd(sub.asaasSubscriptionId);
        } catch (e) {
          console.warn(
            `[dunning] falha ao inativar assinatura ${sub.asaasSubscriptionId}: ${String(e)}`
          );
        }
      }

      suspended++;
      continue;
    }

    const payment = await db.query.payments.findFirst({
      where: and(
        eq(schema.payments.subscriptionId, sub.id),
        inArray(schema.payments.status, REMINDER_PAYMENT_STATUSES)
      ),
    });

    console.warn(
      `[dunning] lembrete de cobrança para ${sub.id}: ${payment?.invoiceUrl ?? 'sem invoiceUrl'}`
    );
    reminded++;
  }

  return { reminded, suspended };
}

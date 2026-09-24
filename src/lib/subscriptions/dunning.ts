import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { cancelAtPeriodEnd } from '@/lib/payments/asaas/subscription';
import { isEmailEnabled } from '@/lib/email/config';
import { sendEmail } from '@/lib/email/client';
import { dunningReminderEmail } from '@/lib/email/templates';

const REMINDER_PAYMENT_STATUSES = ['PENDING', 'OVERDUE'] as const;

export interface DunningResult {
  reminded: number;
  suspended: number;
  emailed: number;
}

export async function runDunning(now: Date = new Date()): Promise<DunningResult> {
  const overdue = await db.query.subscriptions.findMany({
    where: eq(schema.subscriptions.status, 'past_due'),
  });

  let reminded = 0;
  let suspended = 0;
  let emailed = 0;

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

    // Um aviso por carência: `dunningRemindedAt` só é limpo quando o pagamento
    // é confirmado, então a cobrança diária não vira spam diário.
    if (isEmailEnabled() && !sub.dunningRemindedAt) {
      try {
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, sub.userId),
        });
        if (user?.email) {
          const rendered = dunningReminderEmail({
            name: user.name,
            valueCents: payment?.valueCents ?? null,
            dueDate: payment?.dueDate ?? null,
            invoiceUrl: payment?.invoiceUrl ?? null,
            graceUntil: sub.graceUntil,
          });
          await sendEmail({ to: user.email, ...rendered });
          await db
            .update(schema.subscriptions)
            .set({ dunningRemindedAt: now })
            .where(eq(schema.subscriptions.id, sub.id));
          emailed++;
        }
      } catch (e) {
        console.warn(`[dunning] falha ao enviar lembrete para ${sub.id}:`, e);
      }
    }

    console.warn(
      `[dunning] lembrete de cobrança para ${sub.id}: ${payment?.invoiceUrl ?? 'sem invoiceUrl'}`
    );
    reminded++;
  }

  return { reminded, suspended, emailed };
}

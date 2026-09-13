import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSubscription } from '@/lib/payments/asaas/subscription';
import { asaasFetch } from '@/lib/payments/asaas/client';
import { getAsaasConfig } from '@/lib/payments/asaas/config';

const RECONCILE_SUB_STATUSES = ['active', 'past_due', 'incomplete'] as const;
const OPEN_PAYMENT_STATUSES = ['PENDING', 'OVERDUE'] as const;
const TERMINAL_ASAAS_STATUSES = ['INACTIVE', 'EXPIRED', 'DELETED'] as const;
const PAYMENT_LAG_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

interface SubscriptionPatch {
  status?: string;
  canceledAt?: Date;
  asaasStatus?: string;
  nextDueDate?: Date;
}

function parseDueDate(value?: string | null): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00Z`);
}

export async function reconcileSubscriptions(
  now: Date = new Date()
): Promise<{ checked: number; updated: number }> {
  let checked = 0;
  let updated = 0;

  const subs = await db.query.subscriptions.findMany({
    where: and(
      inArray(schema.subscriptions.status, RECONCILE_SUB_STATUSES),
      isNotNull(schema.subscriptions.asaasSubscriptionId)
    ),
  });

  for (const sub of subs) {
    checked++;
    const asaasId = sub.asaasSubscriptionId;
    if (!asaasId) continue;

    try {
      const remote = await getSubscription(asaasId);
      const patch: SubscriptionPatch = {};

      if (remote.status && remote.status !== sub.asaasStatus) {
        patch.asaasStatus = remote.status;
      }
      if (
        remote.status &&
        (TERMINAL_ASAAS_STATUSES as readonly string[]).includes(remote.status) &&
        sub.status !== 'canceled'
      ) {
        patch.status = 'canceled';
        patch.canceledAt = now;
      } else if (remote.status === 'ACTIVE' && sub.status === 'incomplete') {
        patch.status = 'active';
      }

      const nextDueDate = parseDueDate(remote.nextDueDate);
      if (nextDueDate && nextDueDate.getTime() !== sub.nextDueDate?.getTime()) {
        patch.nextDueDate = nextDueDate;
      }

      if (Object.keys(patch).length > 0) {
        await db
          .update(schema.subscriptions)
          .set(patch)
          .where(eq(schema.subscriptions.id, sub.id));
        updated++;
      }
    } catch (e) {
      console.warn(`[reconcile] falha ao reconciliar assinatura ${asaasId}: ${String(e)}`);
    }
  }

  const cutoff = new Date(now.getTime() - PAYMENT_LAG_DAYS * DAY_MS);
  const openPayments = await db.query.payments.findMany({
    where: and(
      inArray(schema.payments.status, OPEN_PAYMENT_STATUSES),
      lt(schema.payments.dueDate, cutoff)
    ),
  });

  for (const payment of openPayments) {
    checked++;
    try {
      const cfg = getAsaasConfig();
      const remote = await asaasFetch<{ status?: string }>(
        cfg,
        `/payments/${payment.asaasPaymentId}/status`
      );

      if (remote.status && remote.status !== payment.status) {
        await db
          .update(schema.payments)
          .set({ status: remote.status, updatedAt: now })
          .where(eq(schema.payments.id, payment.id));
        updated++;
      }
    } catch (e) {
      console.warn(
        `[reconcile] falha ao consultar pagamento ${payment.asaasPaymentId}: ${String(e)}`
      );
    }
  }

  return { checked, updated };
}

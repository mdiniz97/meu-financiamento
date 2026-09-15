import { and, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSubscription } from '@/lib/payments/asaas/subscription';
import { asaasFetch } from '@/lib/payments/asaas/client';
import { getAsaasConfig } from '@/lib/payments/asaas/config';
import { processWebhookEvent } from './apply-event';

const RECONCILE_SUB_STATUSES = ['active', 'past_due', 'incomplete'] as const;
const OPEN_PAYMENT_STATUSES = ['PENDING', 'OVERDUE'] as const;
const TERMINAL_ASAAS_STATUSES = ['INACTIVE', 'EXPIRED', 'DELETED'] as const;
const PAYMENT_LAG_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WEBHOOK_ATTEMPTS = 3;
const WEBHOOK_RETRY_LIMIT = 50;
const SUBSCRIPTION_EVENT_RETENTION_DAYS = 90;
const SUBSCRIPTION_EVENT_DELETE_BATCH = 1000;

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

/**
 * Retenção de auditoria: remove `subscription_events` mais antigos que 90 dias,
 * em lote limitado. Envolvido em try/catch para que uma falha de limpeza nunca
 * derrube a reconciliação.
 */
async function pruneSubscriptionEvents(now: Date): Promise<void> {
  try {
    const cutoff = new Date(now.getTime() - SUBSCRIPTION_EVENT_RETENTION_DAYS * DAY_MS);
    const stale = await db.query.subscriptionEvents.findMany({
      columns: { id: true },
      where: lt(schema.subscriptionEvents.createdAt, cutoff),
      limit: SUBSCRIPTION_EVENT_DELETE_BATCH,
    });
    if (stale.length === 0) return;
    await db
      .delete(schema.subscriptionEvents)
      .where(
        inArray(
          schema.subscriptionEvents.id,
          stale.map((row) => row.id)
        )
      );
  } catch (e) {
    console.warn(`[reconcile] falha ao limpar subscription_events: ${String(e)}`);
  }
}

export async function reconcileSubscriptions(
  now: Date = new Date()
): Promise<{ checked: number; updated: number }> {
  let checked = 0;
  let updated = 0;

  // I3 — webhooks cujo `after()` falhou ficam com processedAt nulo. Reprocessa
  // os que ainda têm tentativas antes de reconciliar o resto.
  const pendingEvents = await db.query.webhookEvents.findMany({
    where: and(
      isNull(schema.webhookEvents.processedAt),
      lt(schema.webhookEvents.attempts, MAX_WEBHOOK_ATTEMPTS)
    ),
    limit: WEBHOOK_RETRY_LIMIT,
  });
  for (const pending of pendingEvents) {
    try {
      await processWebhookEvent(pending.id);
    } catch (e) {
      console.warn(`[reconcile] falha ao reprocessar webhook ${pending.id}: ${String(e)}`);
    }
  }

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
        // C1 — cancel-at-period-end: o Asaas fica INACTIVE na hora, mas o
        // acesso local segue até o fim do período pago. Só cancela de fato
        // quando o período acabou.
        const periodOver =
          !sub.cancelAtPeriodEnd ||
          !sub.currentPeriodEnd ||
          sub.currentPeriodEnd.getTime() <= now.getTime();
        if (periodOver) {
          patch.status = 'canceled';
          patch.canceledAt = now;
        }
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

  // T9 — resolve a config uma vez; sem ela o loop é pulado sem abortar o job.
  let cfg: ReturnType<typeof getAsaasConfig> | null = null;
  try {
    cfg = getAsaasConfig();
  } catch (e) {
    console.warn(`[reconcile] config Asaas indisponível; pulando pagamentos: ${String(e)}`);
  }

  if (cfg) {
    for (const payment of openPayments) {
      checked++;
      try {
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
  }

  await pruneSubscriptionEvents(now);

  return { checked, updated };
}

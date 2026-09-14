import { and, eq, gte } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  cancelAtPeriodEnd,
  reactivateSubscription,
} from '@/lib/payments/asaas/subscription';

const PACK_ID = 'unlimited';
const PROVIDER = 'asaas';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

export type SubscriptionAction = 'cancel' | 'reactivate';
export type SubscriptionActionResult = 'ok' | 'no_subscription' | 'rate_limited';

/**
 * RS3 — IDOR: a assinatura é sempre resolvida pela sessão (`userId`), nunca por
 * um id vindo do cliente. Nenhuma das ações de gerenciamento aceita alvo.
 */
export function getOwnSubscription(userId: string) {
  return db.query.subscriptions.findFirst({
    where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.packId, PACK_ID),
      eq(schema.subscriptions.provider, PROVIDER)
    ),
  });
}

/** RS2 — janela fixa: até 5 eventos do usuário nos últimos 60s. */
export async function rateLimitOk(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const events = await db.query.subscriptionEvents.findMany({
    where: and(
      eq(schema.subscriptionEvents.userId, userId),
      gte(schema.subscriptionEvents.createdAt, since)
    ),
  });
  return events.length < RATE_LIMIT_MAX;
}

/** Grava a tentativa (inclusive `rate_limited`); nunca derruba o fluxo. */
export async function recordSubscriptionEvent(input: {
  userId: string;
  subscriptionId: string | null;
  action: SubscriptionAction;
  result: SubscriptionActionResult;
}): Promise<void> {
  try {
    await db.insert(schema.subscriptionEvents).values({
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      action: input.action,
      result: input.result,
    });
  } catch (e) {
    console.warn(
      `[subscriptions] falha ao registrar evento ${input.action}/${input.result}: ${String(e)}`
    );
  }
}

/**
 * Agenda o cancelamento no fim do período já pago. Idempotente: se a flag
 * local já está ligada, não repete a chamada ao Asaas.
 */
export async function cancelOwnSubscription(
  userId: string
): Promise<SubscriptionActionResult> {
  const subscription = await getOwnSubscription(userId);
  if (!subscription) {
    await recordSubscriptionEvent({
      userId,
      subscriptionId: null,
      action: 'cancel',
      result: 'no_subscription',
    });
    return 'no_subscription';
  }

  if (!subscription.cancelAtPeriodEnd) {
    if (subscription.asaasSubscriptionId) {
      await cancelAtPeriodEnd(subscription.asaasSubscriptionId);
    }
    await db
      .update(schema.subscriptions)
      .set({ cancelAtPeriodEnd: true, canceledAt: new Date() })
      .where(eq(schema.subscriptions.id, subscription.id));
  }

  await recordSubscriptionEvent({
    userId,
    subscriptionId: subscription.id,
    action: 'cancel',
    result: 'ok',
  });
  return 'ok';
}

/** `YYYY-MM-DD` para retomar a cobrança: fim do período pago ou hoje se vencido. */
export function nextDueDateFor(currentPeriodEnd: Date | null, now = new Date()): string {
  const end =
    currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime() ? currentPeriodEnd : now;
  return end.toISOString().slice(0, 10);
}

/** Reverte o cancelamento agendado e retoma a cobrança no Asaas. */
export async function reactivateOwnSubscription(
  userId: string
): Promise<SubscriptionActionResult> {
  const subscription = await getOwnSubscription(userId);
  if (!subscription) {
    await recordSubscriptionEvent({
      userId,
      subscriptionId: null,
      action: 'reactivate',
      result: 'no_subscription',
    });
    return 'no_subscription';
  }

  if (subscription.cancelAtPeriodEnd && subscription.asaasSubscriptionId) {
    await reactivateSubscription(
      subscription.asaasSubscriptionId,
      nextDueDateFor(subscription.currentPeriodEnd)
    );
  }

  await db
    .update(schema.subscriptions)
    .set({ cancelAtPeriodEnd: false, canceledAt: null })
    .where(eq(schema.subscriptions.id, subscription.id));

  await recordSubscriptionEvent({
    userId,
    subscriptionId: subscription.id,
    action: 'reactivate',
    result: 'ok',
  });
  return 'ok';
}

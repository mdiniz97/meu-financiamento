import { and, eq, inArray, ne } from 'drizzle-orm';
import { db, schema } from '@/db';

export const TRIAL_OFFER_WINDOW_MS = 48 * 60 * 60 * 1000;
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface TrialState {
  offerAvailable: boolean;
  /** Janela de 48h vencida, sem trial usado. Independe de bloqueio por plano pago. */
  offerWindowExpired: boolean;
  /** Checkout anual aberto e ainda não pago: trial fica bloqueado por esse motivo, não pelo prazo. */
  blockedByPendingCheckout: boolean;
  showModal: boolean;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  isTrialActive: boolean;
}

export function blocksTrialForSubscription(
  sub: Pick<typeof schema.subscriptions.$inferSelect, 'status' | 'currentPeriodEnd' | 'graceUntil' | 'asaasCheckoutId'>,
  now: Date
): boolean {
  if (sub.status === 'incomplete') return Boolean(sub.asaasCheckoutId);
  return sub.status === 'active'
    ? Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd > now)
    : Boolean(sub.status === 'past_due' && sub.graceUntil && sub.graceUntil > now);
}

export async function getTrialState(userId: string, now = new Date()): Promise<TrialState> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) return {
    offerAvailable: false, offerWindowExpired: false, blockedByPendingCheckout: false,
    showModal: false, trialStartedAt: null, trialEndsAt: null, isTrialActive: false,
  };

  const [trial, paidSubscriptions] = await Promise.all([
    db.query.subscriptions.findFirst({ where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.packId, 'unlimited'),
      eq(schema.subscriptions.provider, 'trial')
    ) }),
    db.query.subscriptions.findMany({ where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.packId, 'unlimited'),
      ne(schema.subscriptions.provider, 'trial'),
      inArray(schema.subscriptions.status, ['active', 'past_due', 'incomplete'])
    ) }),
  ]);
  const eligible = Boolean(user.trialOfferEligibleAt);
  const withinWindow = now.getTime() < user.createdAt.getTime() + TRIAL_OFFER_WINDOW_MS;
  const blockedByPendingCheckout = paidSubscriptions.some(
    sub => sub.status === 'incomplete' && Boolean(sub.asaasCheckoutId)
  );
  const hasPaidAccess = paidSubscriptions.some(sub => blocksTrialForSubscription(sub, now));
  const offerAvailable = eligible && withinWindow && !trial && !hasPaidAccess;
  return {
    offerAvailable,
    // Distingue motivo: janela vencida (mensagem no perfil) x checkout pago pendente.
    offerWindowExpired: eligible && !withinWindow && !trial,
    blockedByPendingCheckout,
    showModal: offerAvailable && !user.trialOfferSeenAt,
    trialStartedAt: trial?.trialStartedAt ?? null,
    trialEndsAt: trial?.currentPeriodEnd ?? null,
    isTrialActive: Boolean(trial?.status === 'active' && trial.currentPeriodEnd && trial.currentPeriodEnd > now),
  };
}

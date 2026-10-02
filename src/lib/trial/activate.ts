import { and, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { blocksTrialForSubscription, TRIAL_DURATION_MS } from './state';
import { captureAccountEvent } from '@/lib/analytics/server';
import { trialOfferDeadline } from './offer-window';

export type TrialActivationResult =
  | { status: 'activated'; endsAt: Date }
  | { status: 'already_used' | 'offer_expired' | 'ineligible' | 'paid_active' | 'checkout_pending' };

export async function activateTrial(userId: string, now?: Date): Promise<TrialActivationResult> {
  const result = await db.transaction<TrialActivationResult>(async tx => {
    await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${userId} FOR UPDATE`);
    const effectiveNow = now ?? new Date();
    const user = await tx.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user?.trialOfferEligibleAt) return { status: 'ineligible' };

    const trial = await tx.query.subscriptions.findFirst({ where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.packId, 'unlimited'),
      eq(schema.subscriptions.provider, 'trial')
    ) });
    if (trial) return { status: 'already_used' };
    const deadline = trialOfferDeadline(user);
    if (!deadline || effectiveNow >= deadline) {
      return { status: 'offer_expired' };
    }

    const paidSubscriptions = await tx.query.subscriptions.findMany({ where: and(
      eq(schema.subscriptions.userId, userId),
      eq(schema.subscriptions.packId, 'unlimited'),
      ne(schema.subscriptions.provider, 'trial'),
      inArray(schema.subscriptions.status, ['active', 'past_due', 'incomplete'])
    ) });
    if (paidSubscriptions.some(sub => sub.status === 'incomplete' && sub.asaasCheckoutId)) {
      return { status: 'checkout_pending' };
    }
    if (paidSubscriptions.some(sub => blocksTrialForSubscription(sub, effectiveNow))) {
      return { status: 'paid_active' };
    }

    const endsAt = new Date(effectiveNow.getTime() + TRIAL_DURATION_MS);
    await tx.insert(schema.subscriptions).values({
      userId, packId: 'unlimited', provider: 'trial', status: 'active',
      trialStartedAt: effectiveNow, currentPeriodEnd: endsAt,
    });
    return { status: 'activated', endsAt };
  });
  if (result.status === 'activated') {
    await captureAccountEvent(userId, 'trial_activated', userId);
  }
  return result;
}

export async function markTrialOfferSeen(userId: string, now = new Date()): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  const deadline = user ? trialOfferDeadline(user) : null;
  if (!deadline || now >= deadline) return;
  const updated = await db.update(schema.users).set({ trialOfferSeenAt: now }).where(and(
    eq(schema.users.id, userId),
    isNotNull(schema.users.trialOfferEligibleAt),
    isNull(schema.users.trialOfferSeenAt)
  )).returning({ id: schema.users.id });
  if (updated.length) await captureAccountEvent(userId, 'trial_offer_seen', userId);
}

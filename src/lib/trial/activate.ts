import { and, eq, gt, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { blocksTrialForSubscription, TRIAL_DURATION_MS, TRIAL_OFFER_WINDOW_MS } from './state';

export type TrialActivationResult =
  | { status: 'activated'; endsAt: Date }
  | { status: 'already_used' | 'offer_expired' | 'ineligible' | 'paid_active' | 'checkout_pending' };

export async function activateTrial(userId: string, now?: Date): Promise<TrialActivationResult> {
  return db.transaction(async tx => {
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
    if (effectiveNow.getTime() >= user.createdAt.getTime() + TRIAL_OFFER_WINDOW_MS) {
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
}

export async function markTrialOfferSeen(userId: string): Promise<void> {
  await db.update(schema.users).set({ trialOfferSeenAt: new Date() }).where(and(
    eq(schema.users.id, userId),
    isNotNull(schema.users.trialOfferEligibleAt),
    isNull(schema.users.trialOfferSeenAt),
    gt(schema.users.createdAt, new Date(Date.now() - TRIAL_OFFER_WINDOW_MS))
  ));
}

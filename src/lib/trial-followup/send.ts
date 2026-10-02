import { and, asc, eq, gte, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { sendEmail } from '@/lib/email/client';
import { isEmailEnabled } from '@/lib/email/config';
import { FOLLOWUP_STAGES } from './schedule';
import { trialFollowupEmail } from './templates';

export async function runTrialFollowup(now = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const report = { sent: 0, skipped: 0, failed: 0 };
  const raw = process.env.TRIAL_FOLLOWUP_START_AT;
  if (!raw || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(raw) || !isEmailEnabled()) return report;
  const start = new Date(raw);
  if (!Number.isFinite(start.getTime())) return report;
  let origin: string;
  try {
    const app = new URL(process.env.APP_URL ?? '');
    if (app.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && app.protocol === 'http:')) return report;
    origin = app.origin;
  } catch { return report; }
  const pack = await db.query.packs.findFirst({ where: eq(schema.packs.id, 'unlimited') });
  if (!pack) return report;

  for (const [day, stage] of FOLLOWUP_STAGES) {
    // Unreserved stages only: already processed accounts never consume the next batch.
    const trials = await db.select({ id: schema.subscriptions.id, userId: schema.subscriptions.userId,
      endsAt: schema.subscriptions.currentPeriodEnd })
      .from(schema.subscriptions)
      .leftJoin(schema.trialFollowupDeliveries, and(
        eq(schema.trialFollowupDeliveries.trialSubscriptionId, schema.subscriptions.id),
        eq(schema.trialFollowupDeliveries.stage, stage)))
      .where(and(eq(schema.subscriptions.provider, 'trial'), eq(schema.subscriptions.packId, 'unlimited'),
        gte(schema.subscriptions.currentPeriodEnd, start),
        sql`${schema.subscriptions.currentPeriodEnd} <= ${new Date(now.getTime() - day * 86400000)}`,
        isNull(schema.trialFollowupDeliveries.id)))
      .orderBy(asc(schema.subscriptions.currentPeriodEnd), asc(schema.subscriptions.id)).limit(100);

    for (const trial of trials) {
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, trial.userId) });
      if (!user || !trial.endsAt) continue;
      const paid = await db.select({ id: schema.payments.id }).from(schema.payments)
        .innerJoin(schema.subscriptions, eq(schema.payments.subscriptionId, schema.subscriptions.id))
        .where(and(eq(schema.subscriptions.userId, user.id), eq(schema.subscriptions.packId, 'unlimited'),
          ne(schema.subscriptions.provider, 'trial'), or(
            inArray(schema.payments.status, ['CONFIRMED', 'RECEIVED']),
            isNotNull(schema.payments.confirmedAt), isNotNull(schema.payments.receivedAt)))).limit(1);
      const subscription = await db.query.subscriptions.findFirst({ where: and(
        eq(schema.subscriptions.userId, user.id), eq(schema.subscriptions.packId, 'unlimited'),
        ne(schema.subscriptions.provider, 'trial'), inArray(schema.subscriptions.status, ['active', 'past_due'])) });
      const missed = now.getTime() >= trial.endsAt.getTime() + (day + 1) * 86400000;
      const skip = missed || Boolean(user.activationBonusOptOutAt) || paid.length > 0 || Boolean(subscription);
      const [reservation] = await db.insert(schema.trialFollowupDeliveries).values({
        trialSubscriptionId: trial.id, stage, state: skip ? 'skipped' : 'attempted', attemptedAt: now,
      }).onConflictDoNothing().returning({ id: schema.trialFollowupDeliveries.id });
      if (!reservation) continue;
      if (skip) { report.skipped++; continue; }
      const latestUser = await db.query.users.findFirst({
        where: eq(schema.users.id, user.id), columns: { activationBonusOptOutAt: true },
      });
      if (!latestUser || latestUser.activationBonusOptOutAt) {
        await db.update(schema.trialFollowupDeliveries).set({ state: 'skipped' })
          .where(eq(schema.trialFollowupDeliveries.id, reservation.id));
        report.skipped++;
        continue;
      }
      try {
        const sent = await sendEmail({ to: user.email, ...trialFollowupEmail({
          name: user.name, stage, appUrl: origin, promotionalPriceCents: pack.priceCents,
        }) });
        await db.update(schema.trialFollowupDeliveries).set({ state: 'sent', sentAt: now, providerMessageId: sent.id })
          .where(eq(schema.trialFollowupDeliveries.id, reservation.id));
        report.sent++;
      } catch {
        await db.update(schema.trialFollowupDeliveries).set({ state: 'failed' })
          .where(eq(schema.trialFollowupDeliveries.id, reservation.id));
        report.failed++;
      }
    }
  }
  return report;
}

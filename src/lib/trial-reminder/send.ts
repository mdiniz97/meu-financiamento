import { and, asc, eq, gte, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { sendEmail } from '@/lib/email/client';
import { isEmailEnabled } from '@/lib/email/config';
import { blocksTrialForSubscription, getTrialState, TRIAL_OFFER_WINDOW_MS } from '@/lib/trial/state';
import { trialReminderEmail } from './templates';

export async function runTrialReminder(now = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const report = { sent: 0, skipped: 0, failed: 0 };
  const raw = process.env.TRIAL_REMINDER_START_AT;
  if (!raw || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(raw) || !isEmailEnabled()) return report;
  const start = new Date(raw);
  if (!Number.isFinite(start.getTime())) return report;
  let origin: string;
  try {
    const app = new URL(process.env.APP_URL ?? '');
    if (app.username || app.password || app.search || app.hash ||
      (app.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && app.protocol === 'http:'))) return report;
    origin = app.origin;
  } catch { return report; }

  const cutoff = new Date(now.getTime() - TRIAL_OFFER_WINDOW_MS);
  const candidates = await db.select({ id: schema.users.id }).from(schema.users)
    .leftJoin(schema.trialReminderDeliveries, eq(schema.trialReminderDeliveries.userId, schema.users.id))
    .where(and(gte(schema.users.createdAt, start), lte(schema.users.createdAt, cutoff),
      isNotNull(schema.users.trialOfferEligibleAt), isNull(schema.trialReminderDeliveries.id)))
    .orderBy(asc(schema.users.createdAt), asc(schema.users.id)).limit(100);

  for (const { id } of candidates) {
    // Same lock as activateTrial: concurrent jobs cannot extend the offer twice.
    const reserved = await db.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${id} FOR UPDATE`);
      const user = await tx.query.users.findFirst({ where: eq(schema.users.id, id) });
      if (!user || !user.trialOfferEligibleAt || user.createdAt > cutoff || user.createdAt < start) return null;
      const existing = await tx.query.trialReminderDeliveries.findFirst({ where: eq(schema.trialReminderDeliveries.userId, id) });
      if (existing) return null;
      const subscriptions = await tx.query.subscriptions.findMany({ where: and(
        eq(schema.subscriptions.userId, id), eq(schema.subscriptions.packId, 'unlimited')) });
      const skip = Boolean(user.activationBonusOptOutAt) || subscriptions.some(sub =>
        sub.provider === 'trial' || blocksTrialForSubscription(sub, now)) ||
        user.trialOfferEligibleAt.getTime() >= user.createdAt.getTime() + TRIAL_OFFER_WINDOW_MS;
      const [delivery] = await tx.insert(schema.trialReminderDeliveries).values({
        userId: id, state: skip ? 'skipped' : 'attempted', attemptedAt: now,
      }).onConflictDoNothing().returning({ id: schema.trialReminderDeliveries.id });
      if (!delivery) return null;
      if (!skip) await tx.update(schema.users).set({ trialOfferEligibleAt: now, trialOfferSeenAt: null })
        .where(eq(schema.users.id, id));
      return { user, deliveryId: delivery.id, skip };
    });
    if (!reserved) continue;
    if (reserved.skip) { report.skipped++; continue; }

    // Preferences and activation can change after reservation; check again before sending.
    const latest = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
    if (!latest || latest.activationBonusOptOutAt || !(await getTrialState(id, now)).offerAvailable) {
      await db.update(schema.trialReminderDeliveries).set({ state: 'skipped' })
        .where(eq(schema.trialReminderDeliveries.id, reserved.deliveryId));
      report.skipped++;
      continue;
    }
    try {
      const sent = await sendEmail({ to: latest.email, ...trialReminderEmail({ name: latest.name, appUrl: origin }) });
      await db.update(schema.trialReminderDeliveries).set({ state: 'sent', sentAt: now, providerMessageId: sent.id })
        .where(eq(schema.trialReminderDeliveries.id, reserved.deliveryId));
      report.sent++;
    } catch {
      // An uncertain provider outcome must not produce a second email or grant.
      await db.update(schema.trialReminderDeliveries).set({ state: 'failed' })
        .where(eq(schema.trialReminderDeliveries.id, reserved.deliveryId));
      report.failed++;
    }
  }
  return report;
}

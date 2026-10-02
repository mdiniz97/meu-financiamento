import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
const mocks = vi.hoisted(() => ({ email: vi.fn() }));
vi.mock('@/lib/email/client', () => ({ sendEmail: mocks.email }));
vi.mock('@/lib/email/config', () => ({ isEmailEnabled: () => true }));
import { runTrialFollowup } from './send';
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
describe.skipIf(url?.hostname !== 'localhost' || url.pathname !== '/financiamento_trial_test')('followup worker', () => {
  const ids: string[] = [];
  const now = new Date('2040-10-10T12:00:00Z');
  beforeAll(async () => {
    vi.stubEnv('TRIAL_FOLLOWUP_START_AT', '2040-10-01T00:00:00Z');
    vi.stubEnv('APP_URL', 'https://amortiza.me');
    mocks.email.mockResolvedValue({ id: 'email_accepted' });
    await db.insert(schema.packs).values({ id: 'unlimited', name: 'Ilimitado', isSubscription: true, priceCents: 11990 }).onConflictDoNothing();
  });
  afterAll(async () => {
    if (ids.length) await db.delete(schema.users).where(inArray(schema.users.id, ids));
    vi.unstubAllEnvs();
    await pool.end();
  });
  async function fixture(optOut = false) {
    const [user] = await db.insert(schema.users).values({ name: 'Ana', email: `followup-send-${crypto.randomUUID()}@example.test`, passwordHash: 'hash', activationBonusOptOutAt: optOut ? now : null }).returning();
    ids.push(user.id);
    const [trial] = await db.insert(schema.subscriptions).values({ userId: user.id, provider: 'trial', status: 'active', packId: 'unlimited', currentPeriodEnd: new Date(now.getTime() - 86400000) }).returning();
    return { user, trial };
  }
  it('sends once under concurrent cron runs and skips opted-out recipients', async () => {
    await fixture();
    const skipped = await fixture(true);
    await Promise.all([runTrialFollowup(now), runTrialFollowup(now)]);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    await runTrialFollowup(now);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    const rows = await db.select().from(schema.trialFollowupDeliveries).where(eq(schema.trialFollowupDeliveries.trialSubscriptionId, skipped.trial.id));
    expect(rows[0].state).toBe('skipped');
  });
  it('keeps failed reservation after uncertain timeout', async () => {
    mocks.email.mockClear().mockRejectedValue(new Error('timeout'));
    const { trial } = await fixture();
    await runTrialFollowup(now);
    await runTrialFollowup(now);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    const rows = await db.select().from(schema.trialFollowupDeliveries).where(eq(schema.trialFollowupDeliveries.trialSubscriptionId, trial.id));
    expect(rows[0].state).toBe('failed');
  });
  it('stops after paid unlimited even when subscription was cancelled later', async () => {
    mocks.email.mockClear();
    const { user, trial } = await fixture();
    const [paid] = await db.insert(schema.subscriptions).values({
      userId: user.id, provider: 'asaas', packId: 'unlimited', status: 'canceled',
    }).returning();
    await db.insert(schema.payments).values({
      userId: user.id, subscriptionId: paid.id, asaasPaymentId: `pay_test_${crypto.randomUUID()}`,
      status: 'CONFIRMED', confirmedAt: new Date(now.getTime() - 1000),
    });
    await runTrialFollowup(now);
    expect(mocks.email).not.toHaveBeenCalled();
    const rows = await db.select().from(schema.trialFollowupDeliveries).where(eq(schema.trialFollowupDeliveries.trialSubscriptionId, trial.id));
    expect(rows[0].state).toBe('skipped');
  });
});

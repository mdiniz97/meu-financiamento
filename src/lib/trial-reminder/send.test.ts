import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
import { getTrialState } from '@/lib/trial/state';
import { activateTrial } from '@/lib/trial/activate';
import { trialOfferDeadline } from '@/lib/trial/offer-window';
const mocks = vi.hoisted(() => ({ email: vi.fn() }));
vi.mock('@/lib/email/client', () => ({ sendEmail: mocks.email }));
vi.mock('@/lib/analytics/server', () => ({ captureAccountEvent: async () => {} }));
import { runTrialReminder } from './send';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
describe.skipIf(target?.hostname !== 'localhost' || target.pathname !== '/financiamento_trial_test')('D+2 trial reminder', () => {
  const ids: string[] = [];
  const createdAt = new Date('2042-01-02T12:00:00Z');
  const due = new Date('2042-01-04T12:00:00Z');
  beforeAll(async () => {
    vi.stubEnv('TRIAL_REMINDER_START_AT', '2042-01-01T00:00:00Z');
    vi.stubEnv('APP_URL', 'https://amortiza.me');
    vi.stubEnv('EMAIL_ENABLED', 'true');
    vi.stubEnv('RESEND_API_KEY', 'test-not-a-real-key');
    vi.stubEnv('EMAIL_FROM', 'test@example.test');
    await db.insert(schema.packs).values({ id: 'unlimited', name: 'Ilimitado', priceCents: 11990, isSubscription: true }).onConflictDoNothing();
  });
  beforeEach(() => { mocks.email.mockReset().mockResolvedValue({ id: 'test-email' }); });
  afterAll(async () => {
    if (ids.length) await db.delete(schema.users).where(inArray(schema.users.id, ids));
    vi.unstubAllEnvs();
    await pool.end();
  });
  async function user(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
    const [row] = await db.insert(schema.users).values({
      name: 'Ana', email: `trial-reminder-${crypto.randomUUID()}@example.test`, passwordHash: 'hash',
      createdAt, trialOfferEligibleAt: createdAt, ...overrides,
    }).returning();
    ids.push(row.id);
    return row;
  }
  it('waits 48 hours, reopens once under concurrent runs and allows a single explicit trial', async () => {
    const row = await user();
    await runTrialReminder(new Date('2042-01-04T11:59:59Z'));
    expect(mocks.email).not.toHaveBeenCalled();
    await Promise.all([runTrialReminder(due), runTrialReminder(due)]);
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect(mocks.email.mock.calls[0][0]).toMatchObject({ to: row.email, text: expect.stringContaining('https://amortiza.me/perfil') });
    const renewed = await db.query.users.findFirst({ where: eq(schema.users.id, row.id) });
    expect(renewed?.createdAt).toEqual(createdAt);
    expect(trialOfferDeadline(renewed!)).toEqual(new Date('2042-01-06T12:00:00Z'));
    expect((await getTrialState(row.id, due)).offerAvailable).toBe(true);
    expect(await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.userId, row.id) })).toBeUndefined();
    await runTrialReminder(new Date('2042-01-05T12:00:00Z'));
    expect(mocks.email).toHaveBeenCalledTimes(1);
    expect((await activateTrial(row.id, new Date('2042-01-05T12:00:00Z'))).status).toBe('activated');
    expect((await activateTrial(row.id, new Date('2042-01-05T12:01:00Z'))).status).toBe('already_used');
  });
  it('excludes used trials, paid access, pending checkout and opted-out accounts', async () => {
    const used = await user();
    const paid = await user();
    const pending = await user();
    const optedOut = await user({ activationBonusOptOutAt: due });
    await db.insert(schema.subscriptions).values([
      { userId: used.id, packId: 'unlimited', provider: 'trial', status: 'expired', trialStartedAt: createdAt },
      { userId: paid.id, packId: 'unlimited', provider: 'asaas', status: 'active', currentPeriodEnd: new Date('2043-01-01T00:00:00Z') },
      { userId: pending.id, packId: 'unlimited', provider: 'asaas', status: 'incomplete', asaasCheckoutId: 'test-checkout' },
    ]);
    await runTrialReminder(due);
    expect(mocks.email).not.toHaveBeenCalled();
    for (const row of [used, paid, pending, optedOut]) {
      const unchanged = await db.query.users.findFirst({ where: eq(schema.users.id, row.id) });
      expect(unchanged?.trialOfferEligibleAt).toEqual(createdAt);
    }
  });
  it('does not import historical accounts or accounts without trial eligibility', async () => {
    await user({ createdAt: new Date('2041-12-01T00:00:00Z') });
    await user({ trialOfferEligibleAt: null });
    await runTrialReminder(due);
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it('does not resend or extend again after an uncertain email failure', async () => {
    const row = await user();
    mocks.email.mockRejectedValue(new Error('timeout'));
    expect((await runTrialReminder(due)).failed).toBe(1);
    await runTrialReminder(new Date('2042-01-05T12:00:00Z'));
    expect(mocks.email).toHaveBeenCalledTimes(1);
    const renewed = await db.query.users.findFirst({ where: eq(schema.users.id, row.id) });
    expect(trialOfferDeadline(renewed!)).toEqual(new Date('2042-01-06T12:00:00Z'));
  });
  it('requires explicit campaign configuration before changing eligibility or sending', async () => {
    const row = await user();
    vi.stubEnv('TRIAL_REMINDER_START_AT', '');
    try {
      expect(await runTrialReminder(due)).toEqual({ sent: 0, skipped: 0, failed: 0 });
      const unchanged = await db.query.users.findFirst({ where: eq(schema.users.id, row.id) });
      expect(unchanged?.trialOfferEligibleAt).toEqual(createdAt);
      expect(mocks.email).not.toHaveBeenCalled();
    } finally { vi.stubEnv('TRIAL_REMINDER_START_AT', '2042-01-01T00:00:00Z'); }
  });
});

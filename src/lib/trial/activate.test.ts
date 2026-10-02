import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
import { hasActiveAccess } from '@/lib/subscriptions/access';
import { getTrialState } from './state';
import { activateTrial, markTrialOfferSeen } from './activate';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = target?.hostname === 'localhost' && target.pathname === '/financiamento_trial_test';
const registeredAt = new Date('2026-10-01T00:00:00Z');
const analytics = vi.hoisted(() => ({ capture: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/analytics/server', () => ({ captureAccountEvent: analytics.capture }));

describe.skipIf(!isolated)('trial activation (isolated PostgreSQL)', () => {
  const ids: string[] = [];
  beforeAll(async () => {
    await db.insert(schema.packs).values({
      id: 'unlimited', name: 'Ilimitado', priceCents: 11990, isSubscription: true,
    }).onConflictDoNothing();
  });
  afterAll(async () => {
    if (ids.length) await db.delete(schema.users).where(inArray(schema.users.id, ids));
    await pool.end();
  });

  async function createUser(eligible = true) {
    const [user] = await db.insert(schema.users).values({
      name: 'Teste', email: `activate-trial-${crypto.randomUUID()}@example.test`,
      passwordHash: 'hash', createdAt: registeredAt,
      ...(eligible ? { trialOfferEligibleAt: registeredAt } : {}),
    }).returning();
    ids.push(user.id);
    return user;
  }

  it('grants exactly one 7-day trial on concurrent clicks and never consumes credits', async () => {
    analytics.capture.mockClear();
    const user = await createUser();
    await db.insert(schema.creditLedger).values({
      userId: user.id, amount: 10, kind: 'bonus', description: 'Bônus de boas-vindas',
    });
    const click = new Date('2026-10-02T23:59:00Z');
    const results = await Promise.all([activateTrial(user.id, click), activateTrial(user.id, click)]);
    expect(results.map(result => result.status).sort()).toEqual(['activated', 'already_used']);
    expect(analytics.capture).toHaveBeenCalledTimes(1);
    expect(analytics.capture).toHaveBeenCalledWith(user.id, 'trial_activated', expect.any(String));
    const rows = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: 'trial', status: 'active', trialStartedAt: click });
    expect(rows[0].currentPeriodEnd).toEqual(new Date(click.getTime() + 7 * 24 * 60 * 60 * 1000));
    const [balance] = await db.select({ total: sql<number>`sum(${schema.creditLedger.amount})::int` })
      .from(schema.creditLedger).where(eq(schema.creditLedger.userId, user.id));
    expect(balance.total).toBe(10);
    expect((await activateTrial(user.id, new Date('2026-10-15T00:00:00Z'))).status).toBe('already_used');
    expect(await getTrialState(user.id, rows[0].currentPeriodEnd!)).toMatchObject({ isTrialActive: false });
  });

  it('rejects first activation at 48h and excludes users created before rollout', async () => {
    const eligible = await createUser();
    expect((await activateTrial(eligible.id, new Date('2026-10-03T00:00:00Z'))).status).toBe('offer_expired');
    const old = await createUser(false);
    expect((await activateTrial(old.id, new Date('2026-10-01T01:00:00Z'))).status).toBe('ineligible');
    expect((await db.select().from(schema.subscriptions).where(inArray(schema.subscriptions.userId, [eligible.id, old.id])))).toHaveLength(0);
  });

  it('lets an explicitly granted old account activate once without changing creation', async () => {
    const user = await createUser(false);
    const grantedAt = new Date('2026-10-10T12:00:00Z');
    await db.update(schema.users).set({ trialOfferEligibleAt: grantedAt }).where(eq(schema.users.id, user.id));
    expect((await getTrialState(user.id, grantedAt)).offerAvailable).toBe(true);
    const result = await activateTrial(user.id, grantedAt);
    expect(result).toEqual({ status: 'activated', endsAt: new Date('2026-10-17T12:00:00Z') });
    const [unchanged] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(unchanged.createdAt).toEqual(registeredAt);
    expect((await activateTrial(user.id, grantedAt)).status).toBe('already_used');
  });

  it('rejects account with paid access and never changes paid subscription', async () => {
    const user = await createUser();
    await db.insert(schema.subscriptions).values({
      userId: user.id, packId: 'unlimited', provider: 'asaas', status: 'active',
      currentPeriodEnd: new Date('2027-10-01T00:00:00Z'),
    });
    expect((await activateTrial(user.id, new Date('2026-10-01T00:01:00Z'))).status).toBe('paid_active');
    const rows = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id));
    expect(rows.map(row => row.provider)).toEqual(['asaas']);
  });

  it('does not start a trial while an annual checkout awaits payment', async () => {
    const user = await createUser();
    await db.insert(schema.subscriptions).values({
      userId: user.id, packId: 'unlimited', provider: 'asaas', status: 'incomplete',
      asaasCheckoutId: 'chk_pending',
    });
    expect((await activateTrial(user.id, new Date('2026-10-01T01:00:00Z'))).status).toBe('checkout_pending');
  });

  it('marks offer seen without using it, and never marks legacy accounts', async () => {
    analytics.capture.mockClear();
    const user = await createUser();
    const old = await createUser(false);
    await markTrialOfferSeen(user.id);
    await markTrialOfferSeen(old.id);
    await markTrialOfferSeen(user.id);
    expect(analytics.capture).toHaveBeenCalledTimes(1);
    expect(analytics.capture).toHaveBeenCalledWith(user.id, 'trial_offer_seen', user.id);
    expect(await getTrialState(user.id, new Date('2026-10-01T01:00:00Z')))
      .toMatchObject({ showModal: false, offerAvailable: true });
    const [oldAfter] = await db.select().from(schema.users).where(eq(schema.users.id, old.id));
    expect(oldAfter.trialOfferSeenAt).toBeNull();
  });

  it('immediately drops access when trial is expired even while status remains active', async () => {
    const user = await db.insert(schema.users).values({
      name: 'Expirado', email: `expired-trial-${crypto.randomUUID()}@example.test`, passwordHash: 'hash',
    }).returning();
    ids.push(user[0].id);
    await db.insert(schema.subscriptions).values({
      userId: user[0].id, packId: 'unlimited', provider: 'trial', status: 'active',
      trialStartedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    expect(await hasActiveAccess(user[0].id)).toBe(false);
    expect((await getTrialState(user[0].id)).isTrialActive).toBe(false);
  });
});

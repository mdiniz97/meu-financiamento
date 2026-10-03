import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
import { getTrialState } from './state';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = target?.hostname === 'localhost' && target.pathname === '/financiamento_trial_test';
const createdAt = new Date('2026-10-01T00:00:00Z');

describe.skipIf(!isolated)('trial offer state (isolated PostgreSQL)', () => {
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
      name: 'Nova', email: `trial-${crypto.randomUUID()}@example.test`,
      passwordHash: 'hash', createdAt,
      ...(eligible ? { trialOfferEligibleAt: createdAt } : {}),
    }).returning();
    ids.push(user.id);
    return user;
  }

  it('offers only to marked new accounts, strictly before 48h', async () => {
    const [newUser, oldUser] = await Promise.all([createUser(), createUser(false)]);
    expect(await getTrialState(newUser.id, new Date('2026-10-02T23:59:00Z')))
      .toMatchObject({ offerAvailable: true, showModal: true, isTrialActive: false });
    expect(await getTrialState(newUser.id, new Date('2026-10-03T00:00:00Z')))
      .toMatchObject({ offerAvailable: false, showModal: false });
    expect(await getTrialState(oldUser.id, new Date('2026-10-01T01:00:00Z')))
      .toMatchObject({ offerAvailable: false, showModal: false });
  });

  it('keeps offer in profile after modal was seen', async () => {
    const user = await createUser();
    await db.update(schema.users).set({ trialOfferSeenAt: new Date('2026-10-01T00:10:00Z') })
      .where(eq(schema.users.id, user.id));
    expect(await getTrialState(user.id, new Date('2026-10-01T01:00:00Z')))
      .toMatchObject({ offerAvailable: true, showModal: false });
  });

  it('does not reopen an already used offer even after trial expires', async () => {
    const user = await createUser();
    await db.insert(schema.subscriptions).values({
      userId: user.id, packId: 'unlimited', provider: 'trial', status: 'active',
      trialStartedAt: createdAt, currentPeriodEnd: new Date('2026-10-08T00:00:00Z'),
    });
    const during = await getTrialState(user.id, new Date('2026-10-02T00:00:00Z'));
    expect(during).toMatchObject({ offerAvailable: false, showModal: false, isTrialActive: true });
    expect(during.trialStartedAt).toEqual(createdAt);
    expect(during.trialEndsAt).toEqual(new Date('2026-10-08T00:00:00Z'));
    expect(await getTrialState(user.id, new Date('2026-10-08T00:00:00Z')))
      .toMatchObject({ offerAvailable: false, showModal: false, isTrialActive: false });
  });

  it('does not offer trial to a new account already subscribed to paid unlimited', async () => {
    const user = await createUser();
    await db.insert(schema.subscriptions).values({
      userId: user.id, packId: 'unlimited', provider: 'asaas', status: 'active',
      currentPeriodEnd: new Date('2027-10-01T00:00:00Z'),
    });
    expect(await getTrialState(user.id, new Date('2026-10-01T01:00:00Z')))
      .toMatchObject({ offerAvailable: false, showModal: false });
  });

  it('hides offer while a paid checkout is pending', async () => {
    const user = await createUser();
    await db.insert(schema.subscriptions).values({
      userId: user.id, packId: 'unlimited', provider: 'asaas', status: 'incomplete',
      asaasCheckoutId: 'chk_pending',
    });
    expect(await getTrialState(user.id, new Date('2026-10-01T01:00:00Z')))
      .toMatchObject({ offerAvailable: false, showModal: false });
  });
  it('blocks trial during a checkout POST even before Asaas returns an ID', async () => {
    const user = await createUser();
    await db.insert(schema.subscriptions).values({
      userId: user.id, packId: 'unlimited', provider: 'asaas', status: 'incomplete',
      checkoutStartedAt: createdAt, cycle: 'MONTHLY', contractedPriceCents: 1890,
    });
    expect(await getTrialState(user.id, new Date('2026-10-01T01:00:00Z')))
      .toMatchObject({ offerAvailable: false, blockedByPendingCheckout: true });
  });

  it('reports window expiry independently from paid/checkout blockers', async () => {
    const expired = await createUser();
    expect(await getTrialState(expired.id, new Date('2026-10-03T00:00:00Z')))
      .toMatchObject({ offerAvailable: false, offerWindowExpired: true });

    const insideWindow = await createUser();
    expect(await getTrialState(insideWindow.id, new Date('2026-10-01T01:00:00Z')))
      .toMatchObject({ offerAvailable: true, offerWindowExpired: false });

    const blocked = await createUser();
    await db.insert(schema.subscriptions).values({
      userId: blocked.id, packId: 'unlimited', provider: 'asaas', status: 'incomplete',
      asaasCheckoutId: 'chk_pending',
    });
    expect(await getTrialState(blocked.id, new Date('2026-10-01T01:00:00Z')))
      .toMatchObject({ offerAvailable: false, offerWindowExpired: false, blockedByPendingCheckout: true });

    const legacy = await createUser(false);
    expect(await getTrialState(legacy.id, new Date('2026-10-03T00:00:00Z')))
      .toMatchObject({ offerWindowExpired: false });
  });

  it('does not report window expiry for an account that already used the trial', async () => {
    const user = await createUser();
    await db.insert(schema.subscriptions).values({
      userId: user.id, packId: 'unlimited', provider: 'trial', status: 'active',
      trialStartedAt: createdAt, currentPeriodEnd: new Date('2026-10-08T00:00:00Z'),
    });
    expect(await getTrialState(user.id, new Date('2026-10-09T00:00:00Z')))
      .toMatchObject({ offerWindowExpired: false, isTrialActive: false });
  });
});

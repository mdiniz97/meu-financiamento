import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '@/db';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
describe.skipIf(target?.hostname !== 'localhost' || target.pathname !== '/financiamento_trial_test')('delivery reservations', () => {
  let userId: string;
  let trialId: string;
  beforeAll(async () => {
    await db.insert(schema.packs).values({ id: 'unlimited', name: 'Ilimitado', priceCents: 11990, isSubscription: true }).onConflictDoNothing();
    const [user] = await db.insert(schema.users).values({ name: 'Teste', email: `followup-${crypto.randomUUID()}@example.test`, passwordHash: 'hash' }).returning();
    userId = user.id;
    const [trial] = await db.insert(schema.subscriptions).values({ userId, provider: 'trial', packId: 'unlimited', status: 'active', currentPeriodEnd: new Date() }).returning();
    trialId = trial.id;
  });
  afterAll(async () => {
    if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId));
    await pool.end();
  });
  it('only one worker can reserve a stage; later stages remain independent', async () => {
    const reserve = () => db.insert(schema.trialFollowupDeliveries).values({ trialSubscriptionId: trialId, stage: 'day_1', state: 'attempted' }).onConflictDoNothing().returning();
    const outcomes = await Promise.all([reserve(), reserve()]);
    expect(outcomes.flat()).toHaveLength(1);
    expect(await reserve()).toHaveLength(0);
    expect(await db.insert(schema.trialFollowupDeliveries).values({ trialSubscriptionId: trialId, stage: 'day_7', state: 'attempted' }).onConflictDoNothing().returning()).toHaveLength(1);
  });
});

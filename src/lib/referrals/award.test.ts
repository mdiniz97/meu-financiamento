import { afterAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
import { awardReferralForSavedSimulation } from './award';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = target?.hostname === 'localhost' && target.pathname === '/financiamento_referrals_test';

describe.skipIf(!isolated)('referral award transaction (isolated PostgreSQL)', () => {
  const ids: string[] = [];
  afterAll(async () => {
    if (ids.length) await db.delete(schema.users).where(inArray(schema.users.id, ids));
    await pool.end();
  });

  async function newPair() {
    const rows = await db.insert(schema.users).values([0, 1].map(n => ({
      name: `Pessoa ${n}`, email: `award-${crypto.randomUUID()}@example.test`, passwordHash: 'hash',
    }))).returning();
    ids.push(...rows.map(row => row.id));
    const [referral] = await db.insert(schema.referrals).values({ inviterId: rows[0].id, inviteeId: rows[1].id }).returning();
    return { inviter: rows[0].id, invitee: rows[1].id, referral: referral.id };
  }

  it('awards both accounts once despite concurrent calls', async () => {
    const { inviter, invitee, referral } = await newPair();
    const outcomes = await Promise.all(Array.from({ length: 3 }, () =>
      db.transaction(tx => awardReferralForSavedSimulation(tx, invitee))));
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const rows = await db.select().from(schema.creditLedger)
      .where(eq(schema.creditLedger.description, `referral:${referral}`));
    expect(rows.map(row => [row.userId, row.amount]).sort()).toEqual([[invitee, 5], [inviter, 5]].sort());
    const [state] = await db.select().from(schema.referrals).where(eq(schema.referrals.id, referral));
    expect(state.state).toBe('awarded');
    expect(state.awardedAt).toBeInstanceOf(Date);
  });

  it('rolls back award and first ledger credit when second credit violates uniqueness', async () => {
    const { inviter, invitee, referral } = await newPair();
    await db.insert(schema.creditLedger).values({ userId: invitee, amount: 5, kind: 'referral', description: `referral:${referral}` });
    await expect(db.transaction(tx => awardReferralForSavedSimulation(tx, invitee))).rejects.toThrow();
    const rows = await db.select().from(schema.creditLedger)
      .where(eq(schema.creditLedger.description, `referral:${referral}`));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(invitee);
    expect(rows.some(row => row.userId === inviter)).toBe(false);
    const [state] = await db.select().from(schema.referrals).where(eq(schema.referrals.id, referral));
    expect(state.state).toBe('pending');
  });
});

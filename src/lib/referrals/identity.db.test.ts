import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
import { getOrCreateReferralCode } from './identity';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = target?.hostname === 'localhost' && target.pathname === '/financiamento_referrals_test';

describe.skipIf(!isolated)('referral code persistence (isolated PostgreSQL)', () => {
  afterAll(async () => { await pool.end(); });

  it('uses one stable code for concurrent requests without replacing it', async () => {
    const [user] = await db.insert(schema.users).values({
      name: 'Inviter', email: `referral-${crypto.randomUUID()}@example.test`, passwordHash: 'hash',
    }).returning();
    try {
      const [first, second] = await Promise.all([
        getOrCreateReferralCode(user.id), getOrCreateReferralCode(user.id),
      ]);
      expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(first).toBe(second);
      expect(await getOrCreateReferralCode(user.id)).toBe(first);
      const [stored] = await db.select({ code: schema.users.referralCode })
        .from(schema.users).where(eq(schema.users.id, user.id));
      expect(stored.code).toBe(first);
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  });
});

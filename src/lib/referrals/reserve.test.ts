import { afterAll, describe, expect, it } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
import { reserveReferralForNewUser } from './reserve';
import { getOrCreateReferralCode } from './identity';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = target?.hostname === 'localhost' && target.pathname === '/financiamento_referrals_test';

describe.skipIf(!isolated)('referral reservations (isolated PostgreSQL)', () => {
  const users: string[] = [];
  afterAll(async () => {
    if (users.length) await db.delete(schema.users).where(inArray(schema.users.id, users));
    await pool.end();
  });

  async function createUser(email: string) {
    const [row] = await db.insert(schema.users).values({ name: 'Teste', email, passwordHash: 'hash' }).returning();
    users.push(row.id);
    return row;
  }

  async function signupWithInvite(code: string) {
    const email = `invitee-${crypto.randomUUID()}@example.test`;
    return db.transaction(async tx => {
      const [created] = await tx.insert(schema.users).values({ name: 'Convidado', email, passwordHash: 'hash' }).returning();
      users.push(created.id);
      await tx.insert(schema.creditLedger).values({ userId: created.id, amount: 10, kind: 'bonus', description: 'Bônus de boas-vindas' });
      const reserved = await reserveReferralForNewUser(tx, { code, inviteeId: created.id, inviteeEmail: email });
      return { id: created.id, reserved };
    });
  }

  it('holds five slots through signup, including pending ones, while sixth retains 10 welcome credits', async () => {
    const inviter = await createUser(`inviter-${crypto.randomUUID()}@example.test`);
    const code = await getOrCreateReferralCode(inviter.id);
    const firstFour = await Promise.all(Array.from({ length: 4 }, () => signupWithInvite(code)));
    expect(firstFour.every(row => row.reserved)).toBe(true);
    const candidates = await Promise.all([signupWithInvite(code), signupWithInvite(code)]);
    expect(candidates.filter(row => row.reserved)).toHaveLength(1);
    const [count] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.referrals).where(eq(schema.referrals.inviterId, inviter.id));
    expect(count.count).toBe(5);
    for (const { id } of candidates) {
      const [balance] = await db.select({ credits: sql<number>`sum(${schema.creditLedger.amount})::int` })
        .from(schema.creditLedger).where(eq(schema.creditLedger.userId, id));
      expect(balance.credits).toBe(10);
    }
  });

  it('ignores malformed, unknown and self-referral codes', async () => {
    const inviter = await createUser(`inviter-${crypto.randomUUID()}@example.test`);
    const code = await getOrCreateReferralCode(inviter.id);
    for (const invalid of [null, 'missing', 'x'.repeat(22)]) {
      const invitee = await createUser(`invitee-${crypto.randomUUID()}@example.test`);
      const value = await db.transaction(tx => reserveReferralForNewUser(tx, {
        inviteeId: invitee.id, inviteeEmail: invitee.email, code: invalid,
      }));
      expect(value).toBe(false);
    }
    expect(await db.transaction(tx => reserveReferralForNewUser(tx, {
      inviteeId: inviter.id, inviteeEmail: inviter.email.toUpperCase(), code,
    }))).toBe(false);
  });
});

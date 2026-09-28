import { afterEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { createActivationToken } from './token';
import { redeemActivationBonus } from './redeem';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const local = process.env.ACTIVATION_BONUS_DB_TESTS === '1' && target?.hostname === 'localhost' &&
  target.port === '5433' && target.pathname === '/financiamento_bonus_test';
describe.runIf(local)('redeemActivationBonus (isolated local Postgres)', () => {
  const ids: string[] = [];
  let serial = 0;
  async function user() {
    const [created] = await db.insert(schema.users).values({
      name: 'Test', email: `redeem-test-${Date.now()}-${++serial}@example.invalid`, passwordHash: 'test-only',
    }).returning();
    ids.push(created.id);
    return created;
  }
  async function offer(userId: string, tokenHash: string, createdAt?: Date) {
    return (await db.insert(schema.activationBonusOffers).values({
      userId, state: 'attempted', variant: 'first_simulation', tokenHash,
      emailAttemptedAt: createdAt ?? new Date(), createdAt,
    }).returning())[0];
  }
  afterEach(async () => {
    if (ids.length) await db.delete(schema.users).where(inArray(schema.users.id, ids.splice(0)));
  });

  it('conta B não resgata token da conta A nem o consome', async () => {
    const a = await user();
    const b = await user();
    const { token, hash } = createActivationToken();
    await offer(a.id, hash);
    expect(await redeemActivationBonus({ userId: b.id, token, now: new Date() })).toBe('invalid');
    expect(await db.query.creditLedger.findFirst({ where: eq(schema.creditLedger.userId, b.id) })).toBeUndefined();
    expect(await redeemActivationBonus({ userId: a.id, token, now: new Date() })).toBe('redeemed');
    expect(await redeemActivationBonus({ userId: a.id, token, now: new Date() })).toBe('already_redeemed');
    const entries = await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, a.id));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ amount: 2, kind: 'bonus' });
  });

  it('dois POSTs concorrentes creditam exatamente 2 uma vez', async () => {
    const a = await user();
    const { token, hash } = createActivationToken();
    const record = await offer(a.id, hash);
    const outcomes = await Promise.all([
      redeemActivationBonus({ userId: a.id, token, now: new Date() }),
      redeemActivationBonus({ userId: a.id, token, now: new Date() }),
    ]);
    expect(outcomes.sort()).toEqual(['already_redeemed', 'redeemed']);
    const entries = await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.userId, a.id));
    expect(entries).toHaveLength(1);
    expect(entries[0].description).toBe(`activation:${record.id}`);
  });

  it('resgata mesmo depois de meses e ignora token inválido', async () => {
    const a = await user();
    const { token, hash } = createActivationToken();
    await offer(a.id, hash, new Date('2025-01-01T00:00:00Z'));
    expect(await redeemActivationBonus({ userId: a.id, token: 'bad', now: new Date('2026-09-25T00:00:00Z') })).toBe('invalid');
    expect(await redeemActivationBonus({ userId: a.id, token, now: new Date('2026-09-25T00:00:00Z') })).toBe('redeemed');
  });
});

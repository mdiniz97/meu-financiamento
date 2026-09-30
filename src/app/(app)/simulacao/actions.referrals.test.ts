import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
import { simulate } from '@/lib/finance/engine';

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/analytics/server', () => ({ captureAccountEvent: vi.fn().mockResolvedValue(undefined) }));
import { saveSimulation, saveToolSimulation } from './actions';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = target?.hostname === 'localhost' && target.pathname === '/financiamento_referrals_test';
const input = { system: 'PRICE' as const, principal: 100000, annualRate: 0.1, months: 12,
  trMonthly: 0, insuranceMonthly: 0, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Teste' };
const strategies = { extraLumpSum: [], reduceMode: 'term' as const };

describe.skipIf(!isolated)('real simulation saves and referrals (isolated PostgreSQL)', () => {
  const ids: string[] = [];
  afterAll(async () => {
    if (ids.length) await db.delete(schema.users).where(inArray(schema.users.id, ids));
    await pool.end();
  });
  beforeEach(() => mocks.auth.mockReset());

  async function newPair(initialCredits = 10) {
    const rows = await db.insert(schema.users).values([0, 1].map(n => ({
      name: `Pessoa ${n}`, email: `save-${crypto.randomUUID()}@example.test`, passwordHash: 'hash',
    }))).returning();
    ids.push(...rows.map(row => row.id));
    const [referral] = await db.insert(schema.referrals).values({ inviterId: rows[0].id, inviteeId: rows[1].id }).returning();
    if (initialCredits) await db.insert(schema.creditLedger).values({
      userId: rows[1].id, amount: initialCredits, kind: 'bonus', description: 'Bônus de boas-vindas',
    });
    mocks.auth.mockResolvedValue({ userId: rows[1].id });
    return { inviter: rows[0].id, invitee: rows[1].id, referral: referral.id };
  }

  async function balance(userId: string) {
    const [row] = await db.select({ total: sql<number>`coalesce(sum(${schema.creditLedger.amount}),0)::int` })
      .from(schema.creditLedger).where(eq(schema.creditLedger.userId, userId));
    return row.total;
  }

  it('charged tool save grants +5 each once, after deducting one credit', async () => {
    const { inviter, invitee, referral } = await newPair();
    const save = () => saveToolSimulation({ name: 'Cenário', system: 'SAC', payload: {}, result: {}, charge: true });
    expect(await save()).toHaveProperty('id');
    expect(await balance(invitee)).toBe(14);
    expect(await balance(inviter)).toBe(5);
    await Promise.all([save(), save()]);
    const bonuses = await db.select().from(schema.creditLedger).where(eq(schema.creditLedger.description, `referral:${referral}`));
    expect(bonuses).toHaveLength(2);
    expect(await balance(invitee)).toBe(12);
  });

  it('loan save grants reward; invalid input and insufficient credits do not', async () => {
    const pair = await newPair();
    const invalid = await saveSimulation({ ...input, principal: 0 }, strategies, {
      price: simulate(input, strategies), sac: simulate({ ...input, system: 'SAC' }, strategies),
    });
    expect(invalid).toHaveProperty('error');
    expect(await balance(pair.inviter)).toBe(0);
    const result = await saveSimulation(input, strategies, {
      price: simulate(input, strategies), sac: simulate({ ...input, system: 'SAC' }, strategies),
    });
    expect(result).toHaveProperty('id');
    expect(await balance(pair.inviter)).toBe(5);

    const second = await newPair(0);
    expect(await saveSimulation(input, strategies, {
      price: simulate(input, strategies), sac: simulate({ ...input, system: 'SAC' }, strategies),
    })).toEqual({ error: 'Créditos insuficientes' });
    const [state] = await db.select().from(schema.referrals).where(eq(schema.referrals.id, second.referral));
    expect(state.state).toBe('pending');
  });

  it('non-charged tool save also counts as first saved simulation', async () => {
    const { inviter } = await newPair();
    expect(await saveToolSimulation({ name: 'Grátis', system: 'SAC', payload: {}, result: {}, charge: false })).toHaveProperty('id');
    expect(await balance(inviter)).toBe(5);
  });

  it('rolls back simulation, spend and inviter bonus when paired credit cannot be written', async () => {
    const { inviter, invitee, referral } = await newPair();
    await db.insert(schema.creditLedger).values({
      userId: invitee, amount: 5, kind: 'referral', description: `referral:${referral}`,
    });
    await expect(saveToolSimulation({ name: 'Colisão', system: 'SAC', payload: {}, result: {}, charge: true })).rejects.toThrow();
    expect(await balance(invitee)).toBe(15);
    expect(await balance(inviter)).toBe(0);
    const simulations = await db.select().from(schema.simulations).where(eq(schema.simulations.userId, invitee));
    expect(simulations).toHaveLength(0);
    const [state] = await db.select().from(schema.referrals).where(eq(schema.referrals.id, referral));
    expect(state.state).toBe('pending');
  });
});

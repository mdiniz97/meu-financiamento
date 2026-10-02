import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import { requireUnlimited } from '@/lib/meu-financiamento/auth';
import { activateTrial } from '@/lib/trial/activate';

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/analytics/server', () => ({ captureAccountEvent: vi.fn().mockResolvedValue(undefined) }));

import { listSimulations, loadSimulation, saveToolSimulation } from './actions';
import { GET as pdfGET } from '@/app/api/pdf/route';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = target?.hostname === 'localhost' && target.pathname === '/financiamento_trial_test';

describe.skipIf(!isolated)('trial access across actions (isolated PostgreSQL)', () => {
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

  it('grants premium saves/PDF and long retention, then reverts without spending credits', async () => {
    const now = new Date();
    const [user] = await db.insert(schema.users).values({
      name: 'Trial', email: `trial-access-${crypto.randomUUID()}@example.test`,
      passwordHash: 'hash', trialOfferEligibleAt: now,
    }).returning();
    ids.push(user.id);
    mocks.auth.mockResolvedValue({ userId: user.id });
    expect((await activateTrial(user.id)).status).toBe('activated');
    expect(await getCreditBalance(user.id)).toMatchObject({ credits: 0, isUnlimited: true });
    await expect(requireUnlimited(user.id)).resolves.toBeUndefined();

    const saved = await saveToolSimulation({ name: 'Trial', system: 'SAC', payload: {}, result: {}, charge: true });
    expect(saved).toHaveProperty('id');
    const [balance] = await db.select({ total: sql<number>`coalesce(sum(${schema.creditLedger.amount}),0)::int` })
      .from(schema.creditLedger).where(eq(schema.creditLedger.userId, user.id));
    expect(balance.total).toBe(0);
    await db.update(schema.simulations).set({ createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000) })
      .where(eq(schema.simulations.userId, user.id));
    expect(await listSimulations()).toHaveLength(1);
    if ('id' in saved) expect(await loadSimulation(saved.id)).not.toBeNull();
    expect((await pdfGET(new Request('http://localhost/api/pdf'))).status).toBe(400);

    await db.update(schema.subscriptions).set({ currentPeriodEnd: new Date(Date.now() - 1000) })
      .where(eq(schema.subscriptions.userId, user.id));
    expect(await getCreditBalance(user.id)).toMatchObject({ credits: 0, isUnlimited: false });
    await expect(requireUnlimited(user.id)).rejects.toThrow('Recurso exclusivo do plano Ilimitado');
    expect(await saveToolSimulation({ name: 'Após trial', system: 'SAC', payload: {}, result: {}, charge: true }))
      .toEqual({ error: 'Créditos insuficientes' });
    expect(await listSimulations()).toHaveLength(0);
    if ('id' in saved) expect(await loadSimulation(saved.id)).toBeNull();
    expect((await pdfGET(new Request('http://localhost/api/pdf'))).status).toBe(403);
  });
});

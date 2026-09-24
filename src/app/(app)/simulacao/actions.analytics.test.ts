import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  captureAccountEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/db', () => ({
  db: { transaction: mocks.transaction },
  schema: {
    users: { id: 'id' },
    creditLedger: { amount: 'amount', userId: 'userId' },
    subscriptions: { userId: 'userId', status: 'status', currentPeriodEnd: 'currentPeriodEnd' },
    simulations: {},
  },
}));
vi.mock('drizzle-orm', () => ({
  sql: Object.assign(() => ({}), { raw: () => ({}) }),
  eq: () => ({}), and: () => ({}), gt: () => ({}), desc: () => ({}),
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/analytics/server', () => ({ captureAccountEvent: mocks.captureAccountEvent }));
vi.mock('@/lib/credits', () => ({ getCreditBalance: vi.fn() }));
vi.mock('@/lib/finance/engine', () => ({ validateLoanInput: vi.fn() }));

import { saveToolSimulation } from './actions';

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ userId: 'u1' });
  mocks.captureAccountEvent.mockReset().mockResolvedValue(undefined);
  mocks.revalidatePath.mockReset();
  mocks.transaction.mockReset().mockImplementation(async (fn) => fn({
    execute: vi.fn().mockResolvedValue(undefined),
    select: () => ({ from: () => ({ where: async () => [{ sum: 2 }] }) }),
    query: { subscriptions: { findFirst: vi.fn().mockResolvedValue(null) } },
    insert: () => ({ values: () => ({ returning: async () => [{ id: 'sim1' }] }) }),
  }));
});

describe('engagement after simulation save', () => {
  it('records completion only after a simulation was saved', async () => {
    const result = await saveToolSimulation({
      name: 'Cenário', system: 'SAC', payload: {}, result: {}, charge: false,
    });

    expect(result).toEqual({ id: 'sim1' });
    expect(mocks.captureAccountEvent).toHaveBeenCalledWith('u1', 'simulation_completed', 'sim1');
  });

  it('does not record completion when credits are insufficient', async () => {
    mocks.transaction.mockImplementation(async (fn) => fn({
      execute: vi.fn().mockResolvedValue(undefined),
      select: () => ({ from: () => ({ where: async () => [{ sum: 0 }] }) }),
      query: { subscriptions: { findFirst: vi.fn().mockResolvedValue(null) } },
    }));

    const result = await saveToolSimulation({
      name: 'Cenário', system: 'SAC', payload: {}, result: {}, charge: true,
    });

    expect(result).toEqual({ error: 'Créditos insuficientes' });
    expect(mocks.captureAccountEvent).not.toHaveBeenCalled();
  });
});

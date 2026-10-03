import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: { subscriptions: { findFirst: mocks.findFirst } },
    update: () => ({ set: mocks.updateSet }),
  },
  schema: { subscriptions: { id: 'id', userId: 'userId', provider: 'provider' } },
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
}));

import { absorbActiveTrial, firstPeriodEndWithTrial } from './trial-conversion';

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  mocks.findFirst.mockReset();
  mocks.updateSet.mockReset().mockReturnValue({ where: mocks.updateWhere });
  mocks.updateWhere.mockReset().mockResolvedValue([]);
});

describe('firstPeriodEndWithTrial', () => {
  it('soma os dias restantes do trial ao fim do período pago', () => {
    const now = new Date('2026-10-03T12:00:00Z');
    const baseEnd = new Date('2026-11-03T12:00:00Z');
    const trialEnd = new Date(now.getTime() + 5 * DAY);
    expect(firstPeriodEndWithTrial(baseEnd, trialEnd, now).toISOString()).toBe(new Date(baseEnd.getTime() + 5 * DAY).toISOString());
  });
  it('sem trial (null) mantém o fim base', () => {
    const baseEnd = new Date('2026-11-03T12:00:00Z');
    expect(firstPeriodEndWithTrial(baseEnd, null, new Date('2026-10-03T12:00:00Z'))).toBe(baseEnd);
  });
  it('trial já expirado mantém o fim base', () => {
    const now = new Date('2026-10-03T12:00:00Z');
    const baseEnd = new Date('2026-11-03T12:00:00Z');
    expect(firstPeriodEndWithTrial(baseEnd, new Date(now.getTime() - DAY), now)).toBe(baseEnd);
  });
});

describe('absorbActiveTrial', () => {
  it('encerra o trial ativo e soma os dias restantes ao período pago', async () => {
    const now = new Date('2026-10-03T12:00:00Z');
    const baseEnd = new Date('2026-11-03T12:00:00Z');
    mocks.findFirst.mockResolvedValue({
      id: 'trial-1',
      status: 'active',
      currentPeriodEnd: new Date(now.getTime() + 3 * DAY),
    });
    const end = await absorbActiveTrial('u1', baseEnd, now);
    expect(end.toISOString()).toBe(new Date(baseEnd.getTime() + 3 * DAY).toISOString());
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'canceled', canceledAt: now }));
  });
  it('sem trial ativo não altera o período nem faz update', async () => {
    mocks.findFirst.mockResolvedValue(null);
    const baseEnd = new Date('2026-11-03T12:00:00Z');
    expect(await absorbActiveTrial('u1', baseEnd, new Date('2026-10-03T12:00:00Z'))).toBe(baseEnd);
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });});

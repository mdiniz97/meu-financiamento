import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findManySubs: vi.fn(),
  findFirstPayment: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  cancelAtPeriodEnd: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      subscriptions: { findMany: mocks.findManySubs },
      payments: { findFirst: mocks.findFirstPayment },
    },
    update: mocks.update,
  },
  schema: { subscriptions: { id: 'id', status: 'status' }, payments: {} },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}));
vi.mock('@/lib/payments/asaas/subscription', () => ({
  cancelAtPeriodEnd: mocks.cancelAtPeriodEnd,
}));

import { runDunning } from './dunning';

const now = new Date('2026-09-13T12:00:00Z');
const PAST = new Date('2026-09-13T11:00:00Z');
const FUTURE = new Date('2026-09-14T12:00:00Z');

beforeEach(() => {
  mocks.findManySubs.mockReset();
  mocks.findFirstPayment.mockReset().mockResolvedValue(null);
  mocks.set.mockReset().mockReturnValue({ where: mocks.where });
  mocks.where.mockReset().mockResolvedValue([]);
  mocks.update.mockReset().mockReturnValue({ set: mocks.set });
  mocks.cancelAtPeriodEnd.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('runDunning', () => {
  it('suspende carência vencida, marca canceled e inativa no Asaas', async () => {
    mocks.findManySubs.mockResolvedValue([
      {
        id: 'sub-1',
        status: 'past_due',
        graceUntil: PAST,
        asaasSubscriptionId: 'asaas_1',
      },
    ]);

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 0, suspended: 1 });
    expect(mocks.set).toHaveBeenCalledWith({ status: 'canceled', canceledAt: now });
    expect(mocks.cancelAtPeriodEnd).toHaveBeenCalledWith('asaas_1');
  });

  it('suspende sem asaasSubscriptionId e não chama a API', async () => {
    mocks.findManySubs.mockResolvedValue([
      { id: 'sub-1', status: 'past_due', graceUntil: PAST, asaasSubscriptionId: null },
    ]);

    const out = await runDunning(now);

    expect(out.suspended).toBe(1);
    expect(mocks.cancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('erro da API não impede a suspensão local', async () => {
    mocks.findManySubs.mockResolvedValue([
      { id: 'sub-1', status: 'past_due', graceUntil: PAST, asaasSubscriptionId: 'asaas_1' },
    ]);
    mocks.cancelAtPeriodEnd.mockRejectedValue(new Error('Asaas API 500'));

    const out = await runDunning(now);

    expect(out.suspended).toBe(1);
    expect(mocks.set).toHaveBeenCalledWith({ status: 'canceled', canceledAt: now });
  });

  it('dentro da carência lembra com invoiceUrl e não atualiza', async () => {
    mocks.findManySubs.mockResolvedValue([
      { id: 'sub-1', status: 'past_due', graceUntil: FUTURE, asaasSubscriptionId: 'asaas_1' },
    ]);
    mocks.findFirstPayment.mockResolvedValue({ invoiceUrl: 'https://asaas.com/i/sub-1' });

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 1, suspended: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('https://asaas.com/i/sub-1')
    );
  });

  it('ignora past_due sem graceUntil', async () => {
    mocks.findManySubs.mockResolvedValue([
      { id: 'sub-1', status: 'past_due', graceUntil: null, asaasSubscriptionId: 'asaas_1' },
    ]);

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 0, suspended: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

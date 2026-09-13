import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findManySubs: vi.fn(),
  findManyPayments: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  getSubscription: vi.fn(),
  asaasFetch: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      subscriptions: { findMany: mocks.findManySubs },
      payments: { findMany: mocks.findManyPayments },
    },
    update: mocks.update,
  },
  schema: {
    subscriptions: { id: 'id', status: 'status', asaasSubscriptionId: 'asaasSubscriptionId' },
    payments: { id: 'id', status: 'status', dueDate: 'dueDate' },
  },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  isNotNull: vi.fn(),
  lt: vi.fn(),
}));
vi.mock('@/lib/payments/asaas/subscription', () => ({
  getSubscription: mocks.getSubscription,
}));
vi.mock('@/lib/payments/asaas/client', () => ({
  asaasFetch: mocks.asaasFetch,
}));
vi.mock('@/lib/payments/asaas/config', () => ({
  getAsaasConfig: () => ({ baseUrl: 'https://api-sandbox.asaas.com/v3', apiKey: 'k' }),
}));

import { reconcileSubscriptions } from './reconcile';

const now = new Date('2026-09-13T12:00:00Z');

beforeEach(() => {
  mocks.findManySubs.mockReset().mockResolvedValue([]);
  mocks.findManyPayments.mockReset().mockResolvedValue([]);
  mocks.set.mockReset().mockReturnValue({ where: mocks.where });
  mocks.where.mockReset().mockResolvedValue([]);
  mocks.update.mockReset().mockReturnValue({ set: mocks.set });
  mocks.getSubscription.mockReset();
  mocks.asaasFetch.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('reconcileSubscriptions', () => {
  it('sincroniza nextDueDate e asaasStatus divergentes', async () => {
    mocks.findManySubs.mockResolvedValue([
      {
        id: 's1',
        status: 'active',
        asaasStatus: 'INACTIVE',
        asaasSubscriptionId: 'a1',
        nextDueDate: new Date('2026-09-01T00:00:00Z'),
      },
    ]);
    mocks.getSubscription.mockResolvedValue({
      id: 'a1',
      status: 'ACTIVE',
      nextDueDate: '2027-01-01',
    });

    const out = await reconcileSubscriptions(now);

    expect(out).toEqual({ checked: 1, updated: 1 });
    expect(mocks.set).toHaveBeenCalledWith({
      asaasStatus: 'ACTIVE',
      nextDueDate: new Date('2027-01-01T00:00:00Z'),
    });
  });

  it('ativa assinatura incomplete quando o Asaas está ACTIVE', async () => {
    mocks.findManySubs.mockResolvedValue([
      { id: 's1', status: 'incomplete', asaasSubscriptionId: 'a1', nextDueDate: null },
    ]);
    mocks.getSubscription.mockResolvedValue({ id: 'a1', status: 'ACTIVE' });

    const out = await reconcileSubscriptions(now);

    expect(out.updated).toBe(1);
    expect(mocks.set).toHaveBeenCalledWith({
      status: 'active',
      asaasStatus: 'ACTIVE',
    });
  });

  it('marca canceled quando o Asaas devolve INACTIVE', async () => {
    mocks.findManySubs.mockResolvedValue([
      { id: 's1', status: 'past_due', asaasSubscriptionId: 'a1', nextDueDate: null },
    ]);
    mocks.getSubscription.mockResolvedValue({ id: 'a1', status: 'INACTIVE' });

    const out = await reconcileSubscriptions(now);

    expect(out.updated).toBe(1);
    expect(mocks.set).toHaveBeenCalledWith({
      status: 'canceled',
      canceledAt: now,
      asaasStatus: 'INACTIVE',
    });
  });

  it('não atualiza quando não há divergência', async () => {
    mocks.findManySubs.mockResolvedValue([
      {
        id: 's1',
        status: 'active',
        asaasStatus: 'ACTIVE',
        asaasSubscriptionId: 'a1',
        nextDueDate: null,
      },
    ]);
    mocks.getSubscription.mockResolvedValue({ id: 'a1', status: 'ACTIVE' });

    const out = await reconcileSubscriptions(now);

    expect(out).toEqual({ checked: 1, updated: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('erro ao consultar uma assinatura não aborta o job', async () => {
    mocks.findManySubs.mockResolvedValue([
      {
        id: 's1',
        status: 'active',
        asaasStatus: 'ACTIVE',
        asaasSubscriptionId: 'a1',
        nextDueDate: null,
      },
      {
        id: 's2',
        status: 'past_due',
        asaasStatus: 'ACTIVE',
        asaasSubscriptionId: 'a2',
        nextDueDate: null,
      },
    ]);
    mocks.getSubscription
      .mockRejectedValueOnce(new Error('Asaas API 500'))
      .mockResolvedValue({ id: 'a2', status: 'INACTIVE' });

    const out = await reconcileSubscriptions(now);

    expect(out.checked).toBe(2);
    expect(out.updated).toBe(1);
  });

  it('consulta status do pagamento vencido e atualiza divergência', async () => {
    mocks.findManyPayments.mockResolvedValue([
      {
        id: 'p1',
        asaasPaymentId: 'pay_1',
        status: 'PENDING',
        dueDate: new Date('2026-09-01T00:00:00Z'),
      },
    ]);
    mocks.asaasFetch.mockResolvedValue({ status: 'CONFIRMED' });

    const out = await reconcileSubscriptions(now);

    expect(out).toEqual({ checked: 1, updated: 1 });
    expect(String(mocks.asaasFetch.mock.calls[0][1])).toBe('/payments/pay_1/status');
    expect(mocks.set).toHaveBeenCalledWith({ status: 'CONFIRMED', updatedAt: now });
  });

  it('não atualiza pagamento quando o status confere', async () => {
    mocks.findManyPayments.mockResolvedValue([
      {
        id: 'p1',
        asaasPaymentId: 'pay_1',
        status: 'OVERDUE',
        dueDate: new Date('2026-09-01T00:00:00Z'),
      },
    ]);
    mocks.asaasFetch.mockResolvedValue({ status: 'OVERDUE' });

    const out = await reconcileSubscriptions(now);

    expect(out).toEqual({ checked: 1, updated: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findManySubs: vi.fn(),
  findManyPayments: vi.fn(),
  findManyWebhookEvents: vi.fn(),
  findManySubEvents: vi.fn(),
  processWebhookEvent: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  del: vi.fn(),
  delWhere: vi.fn(),
  getSubscription: vi.fn(),
  asaasFetch: vi.fn(),
  getAsaasConfig: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      subscriptions: { findMany: mocks.findManySubs },
      payments: { findMany: mocks.findManyPayments },
      webhookEvents: { findMany: mocks.findManyWebhookEvents },
      subscriptionEvents: { findMany: mocks.findManySubEvents },
    },
    update: mocks.update,
    delete: mocks.del,
  },
  schema: {
    subscriptions: { id: 'id', status: 'status', asaasSubscriptionId: 'asaasSubscriptionId' },
    payments: { id: 'id', status: 'status', dueDate: 'dueDate' },
    webhookEvents: { id: 'id', processedAt: 'processedAt', attempts: 'attempts' },
    subscriptionEvents: { id: 'id', createdAt: 'createdAt' },
  },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  isNotNull: vi.fn(),
  isNull: vi.fn(),
  lt: vi.fn(),
}));
vi.mock('@/lib/payments/asaas/subscription', () => ({
  getSubscription: mocks.getSubscription,
}));
vi.mock('@/lib/payments/asaas/client', () => ({
  asaasFetch: mocks.asaasFetch,
}));
vi.mock('@/lib/payments/asaas/config', () => ({
  getAsaasConfig: mocks.getAsaasConfig,
}));
vi.mock('@/lib/subscriptions/apply-event', () => ({
  processWebhookEvent: mocks.processWebhookEvent,
}));

import { reconcileSubscriptions } from './reconcile';

const now = new Date('2026-09-13T12:00:00Z');

beforeEach(() => {
  mocks.findManySubs.mockReset().mockResolvedValue([]);
  mocks.findManyPayments.mockReset().mockResolvedValue([]);
  mocks.findManyWebhookEvents.mockReset().mockResolvedValue([]);
  mocks.findManySubEvents.mockReset().mockResolvedValue([]);
  mocks.processWebhookEvent.mockReset().mockResolvedValue(undefined);
  mocks.set.mockReset().mockReturnValue({ where: mocks.where });
  mocks.where.mockReset().mockResolvedValue([]);
  mocks.update.mockReset().mockReturnValue({ set: mocks.set });
  mocks.delWhere.mockReset().mockResolvedValue([]);
  mocks.del.mockReset().mockReturnValue({ where: mocks.delWhere });
  mocks.getSubscription.mockReset();
  mocks.asaasFetch.mockReset();
  mocks.getAsaasConfig
    .mockReset()
    .mockReturnValue({ baseUrl: 'https://api-sandbox.asaas.com/v3', apiKey: 'k' });
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

  it('mantém active em cancel-at-period-end com período pago futuro e só espelha asaasStatus', async () => {
    mocks.findManySubs.mockResolvedValue([
      {
        id: 's1',
        status: 'active',
        asaasStatus: 'ACTIVE',
        asaasSubscriptionId: 'a1',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2027-01-01T00:00:00Z'),
        nextDueDate: null,
      },
    ]);
    mocks.getSubscription.mockResolvedValue({ id: 'a1', status: 'INACTIVE' });

    const out = await reconcileSubscriptions(now);

    expect(out.updated).toBe(1);
    expect(mocks.set).toHaveBeenCalledWith({ asaasStatus: 'INACTIVE' });
    const patch = mocks.set.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.status).toBeUndefined();
    expect(patch.canceledAt).toBeUndefined();
  });

  it('cancela cancel-at-period-end quando o período pago já venceu', async () => {
    mocks.findManySubs.mockResolvedValue([
      {
        id: 's1',
        status: 'active',
        asaasStatus: 'ACTIVE',
        asaasSubscriptionId: 'a1',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2026-09-01T00:00:00Z'),
        nextDueDate: null,
      },
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

  it('config Asaas indisponível pula o loop de pagamentos sem abortar', async () => {
    mocks.getAsaasConfig.mockImplementation(() => {
      throw new Error('ASAAS_API_KEY ausente');
    });
    mocks.findManyPayments.mockResolvedValue([
      {
        id: 'p1',
        asaasPaymentId: 'pay_1',
        status: 'PENDING',
        dueDate: new Date('2026-09-01T00:00:00Z'),
      },
    ]);

    const out = await reconcileSubscriptions(now);

    expect(out).toEqual({ checked: 0, updated: 0 });
    expect(mocks.asaasFetch).not.toHaveBeenCalled();
  });

  it('reprocessa webhooks pendentes (processedAt nulo, attempts < 3)', async () => {
    mocks.findManyWebhookEvents.mockResolvedValue([
      { id: 'evt-row-1', attempts: 0 },
      { id: 'evt-row-2', attempts: 2 },
    ]);

    const out = await reconcileSubscriptions(now);

    expect(mocks.processWebhookEvent).toHaveBeenNthCalledWith(1, 'evt-row-1');
    expect(mocks.processWebhookEvent).toHaveBeenNthCalledWith(2, 'evt-row-2');
    expect(out).toEqual({ checked: 0, updated: 0 });
  });

  it('erro ao reprocessar um webhook não aborta a reconciliação', async () => {
    mocks.findManyWebhookEvents.mockResolvedValue([
      { id: 'evt-row-1', attempts: 0 },
      { id: 'evt-row-2', attempts: 1 },
    ]);
    mocks.processWebhookEvent
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    const out = await reconcileSubscriptions(now);

    expect(mocks.processWebhookEvent).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ checked: 0, updated: 0 });
  });

  it('remove subscription_events antigos em lote limitado', async () => {
    mocks.findManySubEvents.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);

    await reconcileSubscriptions(now);

    const arg = mocks.findManySubEvents.mock.calls[0][0] as { limit?: number };
    expect(arg.limit).toBe(1000);
    expect(mocks.del).toHaveBeenCalledTimes(1);
    expect(mocks.delWhere).toHaveBeenCalledTimes(1);
  });

  it('não apaga nada quando não há subscription_events antigos', async () => {
    mocks.findManySubEvents.mockResolvedValue([]);

    await reconcileSubscriptions(now);

    expect(mocks.del).not.toHaveBeenCalled();
  });

  it('falha ao limpar subscription_events não aborta a reconciliação', async () => {
    mocks.findManySubEvents.mockRejectedValue(new Error('db down'));

    await expect(reconcileSubscriptions(now)).resolves.toEqual({ checked: 0, updated: 0 });
  });
});

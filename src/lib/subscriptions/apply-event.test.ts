import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findSub: vi.fn(),
  findEvent: vi.fn(),
  updateSub: vi.fn(),
  insertPayment: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      subscriptions: { findFirst: mocks.findSub },
      webhookEvents: { findFirst: mocks.findEvent },
    },
    update: mocks.updateSub,
    insert: mocks.insertPayment,
  },
  schema: {
    subscriptions: {
      id: 'id',
      userId: 'userId',
      providerId: 'providerId',
      asaasSubscriptionId: 'asaasSubscriptionId',
      asaasCheckoutId: 'asaasCheckoutId',
    },
    payments: { asaasPaymentId: 'asaasPaymentId' },
    webhookEvents: {
      id: 'id',
      processedAt: 'processedAt',
      attempts: 'attempts',
      lastError: 'lastError',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...args: unknown[]) => args,
  sql: (...args: unknown[]) => args,
}));

import { applyAsaasEvent, processWebhookEvent } from './apply-event';

const chain = () => {
  const returning = vi.fn().mockResolvedValue([{ id: 'sub-1' }]);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { set, where, returning };
};

type Row = Record<string, unknown>;
let byProvider: Row | null;
let byCheckout: Row | null;
let byId: Row | null;
let updateChains: ReturnType<typeof chain>[];

const routeFindSub = async ({ where }: { where: { col: unknown } }) => {
  if (where?.col === 'providerId') return byProvider;
  if (where?.col === 'asaasCheckoutId') return byCheckout;
  if (where?.col === 'id') return byId;
  return null;
};

const paymentEvent = (event: string, over: Record<string, unknown> = {}) => ({
  id: 'evt_1',
  event,
  payment: {
    id: 'pay_1',
    subscription: 'sub_1',
    status: event.replace('PAYMENT_', ''),
    billingType: 'CREDIT_CARD',
    dueDate: '2026-09-13',
    value: 119.9,
    ...over,
  },
});

const setPatch = (c: ReturnType<typeof chain>) =>
  c.set.mock.calls[0][0] as Record<string, unknown>;

beforeEach(() => {
  byProvider = null;
  byCheckout = null;
  byId = null;
  updateChains = [];
  mocks.findSub.mockReset();
  mocks.findSub.mockImplementation(routeFindSub);
  mocks.findEvent.mockReset();
  mocks.updateSub.mockReset();
  mocks.updateSub.mockImplementation(() => {
    const c = chain();
    updateChains.push(c);
    return c;
  });
  mocks.insertPayment.mockReset();
  mocks.insertPayment.mockReturnValue({
    values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue([]) }),
  });
});

describe('applyAsaasEvent — §7.2', () => {
  it('PAYMENT_CONFIRMED ativa e define current_period_end = dueDate + cycle', async () => {
    mocks.findSub.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      asaasSubscriptionId: 'sub_1',
      cycle: 'YEARLY',
      currentPeriodEnd: null,
    });
    const c = chain();
    mocks.updateSub.mockReturnValue({ set: c.set });

    await applyAsaasEvent(paymentEvent('PAYMENT_CONFIRMED'));

    const patch = setPatch(c);
    expect(patch.status).toBe('active');
    expect((patch.currentPeriodEnd as Date).toISOString()).toBe('2027-09-13T00:00:00.000Z');
  });

  it('PAYMENT_OVERDUE marca past_due com carência', async () => {
    mocks.findSub.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      asaasSubscriptionId: 'sub_1',
      cycle: 'YEARLY',
    });
    const c = chain();
    mocks.updateSub.mockReturnValue({ set: c.set });

    await applyAsaasEvent(paymentEvent('PAYMENT_OVERDUE'));

    const patch = setPatch(c);
    expect(patch.status).toBe('past_due');
    expect((patch.graceUntil as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('SUBSCRIPTION_CREATED grava o id e não libera acesso', async () => {
    mocks.findSub.mockResolvedValue({ id: 'sub-1', userId: 'user-1' });
    const c = chain();
    mocks.updateSub.mockReturnValue({ set: c.set });

    await applyAsaasEvent({
      id: 'evt_2',
      event: 'SUBSCRIPTION_CREATED',
      subscription: {
        id: 'sub_1',
        customer: 'cus_1',
        cycle: 'YEARLY',
        value: 119.9,
        nextDueDate: '2027-09-13',
        billingType: 'CREDIT_CARD',
        status: 'ACTIVE',
      },
    });

    const patch = setPatch(c);
    expect(patch.asaasSubscriptionId).toBe('sub_1');
    expect(patch.asaasCustomerId).toBe('cus_1');
    expect(patch.status).toBeUndefined();
  });

  it('PAYMENT_CREATED não libera acesso', async () => {
    byProvider = {
      id: 'sub-1',
      userId: 'user-1',
      status: 'incomplete',
      cycle: 'YEARLY',
      nextDueDate: null,
      currentPeriodEnd: null,
    };
    await applyAsaasEvent(paymentEvent('PAYMENT_CREATED'));
    expect(updateChains).toHaveLength(0);
  });

  it('RENOVAÇÃO não encolhe current_period_end já pago', async () => {
    const alreadyPaid = new Date('2028-01-01T00:00:00.000Z');
    mocks.findSub.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      cycle: 'YEARLY',
      currentPeriodEnd: alreadyPaid,
    });
    const c = chain();
    mocks.updateSub.mockReturnValue({ set: c.set });

    await applyAsaasEvent(paymentEvent('PAYMENT_CONFIRMED'));

    expect(setPatch(c).currentPeriodEnd).toEqual(alreadyPaid);
  });

  it('PAYMENT_REFUNDED revoga acesso; PAYMENT_PARTIALLY_REFUNDED não', async () => {
    byProvider = { id: 'sub-1', userId: 'user-1', status: 'active', cycle: 'YEARLY' };
    await applyAsaasEvent(paymentEvent('PAYMENT_REFUNDED'));
    expect(setPatch(updateChains[0]).status).toBe('canceled');

    updateChains = [];
    byProvider = { id: 'sub-1', userId: 'user-1', status: 'active', cycle: 'YEARLY' };
    await applyAsaasEvent(paymentEvent('PAYMENT_PARTIALLY_REFUNDED'));
    expect(updateChains).toHaveLength(0);
  });

  it('SUBSCRIPTION_DELETED cancela localmente', async () => {
    byProvider = { id: 'sub-1', userId: 'user-1' };
    await applyAsaasEvent({
      id: 'evt_3',
      event: 'SUBSCRIPTION_DELETED',
      subscription: { id: 'sub_1', status: 'DELETED' },
    });
    const patch = setPatch(updateChains[0]);
    expect(patch.asaasStatus).toBe('DELETED');
    expect(patch.status).toBe('canceled');
  });
});

describe('R1 — correlação', () => {
  it('SUBSCRIPTION_CREATED casa por checkoutSession e seta providerId', async () => {
    byCheckout = {
      id: 'sub-1',
      userId: 'user-1',
      status: 'incomplete',
      cycle: 'YEARLY',
      currentPeriodEnd: null,
    };

    await applyAsaasEvent({
      id: 'evt_chk',
      event: 'SUBSCRIPTION_CREATED',
      subscription: {
        id: 'sub_1',
        checkoutSession: 'chk_1',
        customer: 'cus_1',
        cycle: 'YEARLY',
        nextDueDate: '2027-09-13',
        billingType: 'CREDIT_CARD',
        status: 'ACTIVE',
      },
    });

    const cols = mocks.findSub.mock.calls.map(
      (call) => (call[0] as { where: { col: string } }).where.col
    );
    expect(cols[0]).toBe('providerId');
    expect(cols).toContain('asaasCheckoutId');

    const patch = setPatch(updateChains[0]);
    expect(patch.providerId).toBe('sub_1');
    expect(patch.asaasSubscriptionId).toBe('sub_1');
    expect(patch.status).toBeUndefined();
  });

  it('PAYMENT_CONFIRMED posterior casa por providerId', async () => {
    byProvider = {
      id: 'sub-1',
      userId: 'user-1',
      cycle: 'YEARLY',
      currentPeriodEnd: null,
      nextDueDate: null,
    };

    await applyAsaasEvent(paymentEvent('PAYMENT_CONFIRMED'));

    const first = (mocks.findSub.mock.calls[0][0] as { where: { col: string; val: unknown } })
      .where;
    expect(first.col).toBe('providerId');
    expect(first.val).toBe('sub_1');
    expect(setPatch(updateChains[0]).status).toBe('active');

    const paymentValues = (
      mocks.insertPayment.mock.results[0].value as {
        values: { mock: { calls: unknown[][] } };
      }
    ).values.mock.calls[0][0] as { userId: string; subscriptionId: string };
    expect(paymentValues.userId).toBe('user-1');
    expect(paymentValues.subscriptionId).toBe('sub-1');
  });

  it('CHECKOUT_PAID casa por externalReference (id local) e não libera acesso', async () => {
    byId = {
      id: 'sub-local',
      userId: 'user-1',
      status: 'incomplete',
      cycle: 'YEARLY',
      currentPeriodEnd: null,
    };

    await applyAsaasEvent({
      id: 'evt_chk_paid',
      event: 'CHECKOUT_PAID',
      checkout: { id: 'chk_1', externalReference: 'sub-local' },
    });

    const calls = mocks.findSub.mock.calls.map(
      (call) => (call[0] as { where: { col: string; val: unknown } }).where
    );
    expect(calls.some((c) => c.col === 'id' && c.val === 'sub-local')).toBe(true);
    expect(mocks.updateSub).not.toHaveBeenCalled();
  });

  it('CHECKOUT_PAID casa por checkout.id (asaasCheckoutId) e não libera acesso', async () => {
    byCheckout = {
      id: 'sub-1',
      userId: 'user-1',
      status: 'incomplete',
      cycle: 'YEARLY',
      currentPeriodEnd: null,
    };

    await applyAsaasEvent({
      id: 'evt_chk_paid_2',
      event: 'CHECKOUT_PAID',
      checkout: { id: 'chk_1' },
    });

    const calls = mocks.findSub.mock.calls.map(
      (call) => (call[0] as { where: { col: string; val: unknown } }).where
    );
    expect(calls.some((c) => c.col === 'asaasCheckoutId' && c.val === 'chk_1')).toBe(true);
    expect(mocks.updateSub).not.toHaveBeenCalled();
  });
});

describe('R2 — upsertPayment', () => {
  it('não insere payment quando a assinatura não é resolvida', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await applyAsaasEvent(paymentEvent('PAYMENT_CREATED'));
    expect(mocks.insertPayment).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('insere payment com userId da assinatura resolvida', async () => {
    byProvider = { id: 'sub-1', userId: 'user-42', cycle: 'YEARLY', currentPeriodEnd: null };
    await applyAsaasEvent(paymentEvent('PAYMENT_CREATED'));
    expect(mocks.insertPayment).toHaveBeenCalledTimes(1);
    const valuesArg = (
      mocks.insertPayment.mock.results[0].value as {
        values: { mock: { calls: unknown[][] } };
      }
    ).values.mock.calls[0][0] as { userId: string; asaasPaymentId: string };
    expect(valuesArg.userId).toBe('user-42');
    expect(valuesArg.asaasPaymentId).toBe('pay_1');
  });
});

describe('processWebhookEvent', () => {
  it('ignora linha já processada', async () => {
    mocks.findEvent.mockResolvedValue({
      id: 'evt-row-1',
      processedAt: new Date(),
      attempts: 0,
      payload: paymentEvent('PAYMENT_CONFIRMED'),
    });
    await processWebhookEvent('evt-row-1');
    expect(mocks.findSub).not.toHaveBeenCalled();
    expect(mocks.updateSub).not.toHaveBeenCalled();
  });

  it('aplica o evento e grava processedAt/lastError=null', async () => {
    mocks.findEvent.mockResolvedValue({
      id: 'evt-row-1',
      processedAt: null,
      attempts: 0,
      payload: paymentEvent('PAYMENT_CONFIRMED'),
    });
    mocks.findSub.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      cycle: 'YEARLY',
      currentPeriodEnd: null,
    });

    await processWebhookEvent('evt-row-1');

    const patch = updateChains
      .map((c) => c.set.mock.calls[0]?.[0] as Record<string, unknown> | undefined)
      .find((p) => p != null && 'processedAt' in p);
    expect(patch).toBeDefined();
    expect(patch?.lastError).toBeNull();
  });

  it('incrementa attempts, grava lastError e re-lança em erro', async () => {
    mocks.findEvent.mockResolvedValue({
      id: 'evt-row-1',
      processedAt: null,
      attempts: 2,
      payload: paymentEvent('PAYMENT_CONFIRMED'),
    });
    mocks.findSub.mockRejectedValue(new Error('db down'));

    await expect(processWebhookEvent('evt-row-1')).rejects.toThrow('db down');

    const patch = updateChains
      .map((c) => c.set.mock.calls[0]?.[0] as Record<string, unknown> | undefined)
      .find((p) => p != null && 'attempts' in p);
    expect(patch?.attempts).toBe(3);
    expect(String(patch?.lastError)).toContain('db down');
  });
});

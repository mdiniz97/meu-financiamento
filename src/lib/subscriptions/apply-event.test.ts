import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findSub: vi.fn(),
  findEvent: vi.fn(),
  findPurchase: vi.fn(),
  updateSub: vi.fn(),
  insertPayment: vi.fn(),
  addCredits: vi.fn(),
  getFiscalInfo: vi.fn(),
  configureInvoiceSettings: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      subscriptions: { findFirst: mocks.findSub },
      webhookEvents: { findFirst: mocks.findEvent },
      creditPurchases: { findFirst: mocks.findPurchase },
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
    payments: { asaasPaymentId: 'asaasPaymentId', confirmedAt: 'confirmedAt', receivedAt: 'receivedAt' },
    invoices: {
      asaasInvoiceId: 'asaasInvoiceId',
      subscriptionId: 'subscriptionId',
      userId: 'userId',
      status: 'status',
      updatedAt: 'updatedAt',
    },
    creditPurchases: {
      id: 'id',
      asaasCheckoutId: 'asaasCheckoutId',
      status: 'status',
      asaasPaymentId: 'asaasPaymentId',
      paidAt: 'paidAt',
    },
    webhookEvents: {
      id: 'id',
      processedAt: 'processedAt',
      attempts: 'attempts',
      lastError: 'lastError',
    },
  },
}));

vi.mock('@/lib/credits', () => ({ addCredits: mocks.addCredits }));

vi.mock('@/lib/payments/asaas/subscription', () => ({
  getFiscalInfo: mocks.getFiscalInfo,
  configureInvoiceSettings: mocks.configureInvoiceSettings,
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...args: unknown[]) => args,
  sql: (...args: unknown[]) => args,
}));

import { applyAsaasEvent, processWebhookEvent, sanitizeEventForStorage } from './apply-event';

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
const originalInvoiceFlag = process.env.ASAAS_INVOICE_ENABLED;

afterEach(() => {
  if (originalInvoiceFlag === undefined) delete process.env.ASAAS_INVOICE_ENABLED;
  else process.env.ASAAS_INVOICE_ENABLED = originalInvoiceFlag;
});

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
  delete process.env.ASAAS_INVOICE_ENABLED;
  byProvider = null;
  byCheckout = null;
  byId = null;
  updateChains = [];
  mocks.getFiscalInfo.mockReset();
  mocks.getFiscalInfo.mockResolvedValue({ ok: true });
  mocks.configureInvoiceSettings.mockReset();
  mocks.configureInvoiceSettings.mockResolvedValue(undefined);
  mocks.findSub.mockReset();
  mocks.findSub.mockImplementation(routeFindSub);
  mocks.findEvent.mockReset();
  mocks.findPurchase.mockReset();
  mocks.findPurchase.mockResolvedValue(null);
  mocks.addCredits.mockReset();
  mocks.addCredits.mockResolvedValue(undefined);
  mocks.updateSub.mockReset();
  mocks.updateSub.mockImplementation(() => {
    const c = chain();
    updateChains.push(c);
    return c;
  });
  mocks.insertPayment.mockReset();
  mocks.insertPayment.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue([]),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }),
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
    const localId = '26bf39ac-33c4-4f18-804d-a91405146e8d';
    byId = {
      id: localId,
      userId: 'user-1',
      status: 'incomplete',
      cycle: 'YEARLY',
      currentPeriodEnd: null,
    };

    await applyAsaasEvent({
      id: 'evt_chk_paid',
      event: 'CHECKOUT_PAID',
      checkout: { id: 'chk_1', externalReference: localId },
    });

    const calls = mocks.findSub.mock.calls.map(
      (call) => (call[0] as { where: { col: string; val: unknown } }).where
    );
    expect(calls.some((c) => c.col === 'id' && c.val === localId)).toBe(true);
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

  it('PAYMENT_* casa por payment.checkoutSession via asaasCheckoutId', async () => {
    byCheckout = {
      id: 'sub-1',
      userId: 'user-1',
      status: 'incomplete',
      cycle: 'YEARLY',
      currentPeriodEnd: null,
    };

    await applyAsaasEvent({
      id: 'evt_pay_chk',
      event: 'PAYMENT_CREATED',
      payment: { id: 'pay_1', checkoutSession: 'chk_1', status: 'PENDING' },
    });

    const calls = mocks.findSub.mock.calls.map(
      (call) => (call[0] as { where: { col: string; val: unknown } }).where
    );
    expect(calls.some((c) => c.col === 'asaasCheckoutId' && c.val === 'chk_1')).toBe(true);
    expect(mocks.insertPayment).toHaveBeenCalledTimes(1);
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

  it('PAYMENT_CREATED seguido de PAYMENT_CONFIRMED faz upsert e atualiza status', async () => {
    byProvider = { id: 'sub-1', userId: 'user-1', cycle: 'YEARLY', currentPeriodEnd: null };

    await applyAsaasEvent(paymentEvent('PAYMENT_CREATED'));
    await applyAsaasEvent(paymentEvent('PAYMENT_CONFIRMED'));

    const valuesFn = (
      mocks.insertPayment.mock.results[0].value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values;
    const conflict = valuesFn.mock.results[0].value as {
      onConflictDoUpdate: ReturnType<typeof vi.fn>;
      onConflictDoNothing: ReturnType<typeof vi.fn>;
    };

    // Um upsert por evento (CREATED e CONFIRMED), sempre via column-target.
    expect(conflict.onConflictDoUpdate).toHaveBeenCalledTimes(2);
    expect(conflict.onConflictDoNothing).not.toHaveBeenCalled();
    const arg = conflict.onConflictDoUpdate.mock.calls[1][0] as {
      target: unknown;
      set: Record<string, unknown>;
    };
    expect(arg.target).toBe('asaasPaymentId');
    expect(arg.set.status).toBe('CONFIRMED');
    expect(arg.set.updatedAt).toBeInstanceOf(Date);
    expect(arg.set).not.toHaveProperty('userId');
    expect(arg.set).not.toHaveProperty('subscriptionId');
  });

  it('PAYMENT_OVERDUE atualiza status para OVERDUE no upsert', async () => {
    byProvider = { id: 'sub-1', userId: 'user-1', cycle: 'YEARLY', currentPeriodEnd: null };

    await applyAsaasEvent(paymentEvent('PAYMENT_OVERDUE'));

    const valuesFn = (
      mocks.insertPayment.mock.results[0].value as {
        values: ReturnType<typeof vi.fn>;
      }
    ).values;
    const arg = (
      valuesFn.mock.results[0].value as { onConflictDoUpdate: ReturnType<typeof vi.fn> }
    ).onConflictDoUpdate.mock.calls[0][0] as { set: Record<string, unknown> };
    expect(arg.set.status).toBe('OVERDUE');
  });

  it('preserva confirmedAt/receivedAt via coalesce (não sobrescreve com plain value)', async () => {
    byProvider = { id: 'sub-1', userId: 'user-1', cycle: 'YEARLY', currentPeriodEnd: null };

    await applyAsaasEvent(paymentEvent('PAYMENT_CONFIRMED'));

    const valuesFn = (
      mocks.insertPayment.mock.results[0].value as { values: ReturnType<typeof vi.fn> }
    ).values;
    const arg = (
      valuesFn.mock.results[0].value as { onConflictDoUpdate: ReturnType<typeof vi.fn> }
    ).onConflictDoUpdate.mock.calls[0][0] as { set: Record<string, unknown> };

    // sql mockado devolve [strings, ...params]; o set precisa ser a expressão
    // coalesce(coluna, excluded.*) — nunca um Date puro que sobrescreveria.
    const confirmed = JSON.stringify(arg.set.confirmedAt);
    expect(arg.set.confirmedAt).not.toBeInstanceOf(Date);
    expect(confirmed).toContain('coalesce');
    expect(confirmed).toContain('excluded.confirmed_at');
    expect(confirmed).toContain('confirmedAt');

    const received = JSON.stringify(arg.set.receivedAt);
    expect(received).toContain('coalesce');
    expect(received).toContain('excluded.received_at');
    expect(received).toContain('receivedAt');
  });
});

describe('sanitizeEventForStorage', () => {
  it('mantém last4+brand e remove token e CVV', () => {
    const evt = {
      id: 'evt_sec',
      event: 'PAYMENT_CREATED',
      payment: {
        id: 'pay_1',
        creditCardToken: 'tok_top_secret',
        creditCard: {
          creditCardNumber: '1234567812345678',
          creditCardBrand: 'VISA',
          creditCardToken: 'tok_inner_secret',
          cvv: '123',
        },
      },
    };

    const safe = sanitizeEventForStorage(evt);

    expect(safe.payment.creditCard.creditCardNumber).toBe('****5678');
    expect(safe.payment.creditCard.creditCardBrand).toBe('VISA');
    expect(safe.payment.creditCard).not.toHaveProperty('creditCardToken');
    expect(safe.payment.creditCard).not.toHaveProperty('cvv');
    expect(safe.payment).not.toHaveProperty('creditCardToken');
    // deep copy: original intacto
    expect(evt.payment.creditCard.creditCardNumber).toBe('1234567812345678');
    expect(evt.payment.creditCardToken).toBe('tok_top_secret');
  });

  it('persiste rawLastEvent sanitizado no upsert', async () => {
    byProvider = { id: 'sub-1', userId: 'user-1', cycle: 'YEARLY', currentPeriodEnd: null };

    await applyAsaasEvent(
      paymentEvent('PAYMENT_CREATED', {
        creditCard: {
          creditCardNumber: '1234567812345678',
          creditCardBrand: 'VISA',
          creditCardToken: 'tok_inner_secret',
        },
      })
    );

    const valuesArg = (
      mocks.insertPayment.mock.results[0].value as {
        values: { mock: { calls: unknown[][] } };
      }
    ).values.mock.calls[0][0] as {
      rawLastEvent: { payment: { creditCard: Record<string, unknown> } };
    };
    const cc = valuesArg.rawLastEvent.payment.creditCard;
    expect(cc.creditCardNumber).toBe('****5678');
    expect(cc.creditCardBrand).toBe('VISA');
    expect(cc).not.toHaveProperty('creditCardToken');
  });
});

describe('créditos avulsos — compra DETACHED', () => {
  const creditPayment = (event: string, over: Record<string, unknown> = {}) => ({
    id: `evt_${event}`,
    event,
    payment: {
      id: 'pay_1',
      checkoutSession: 'chk_1',
      status: event.replace('PAYMENT_', ''),
      ...over,
    },
  });

  const purchase = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    userId: 'u1',
    credits: 5,
    status: 'pending',
    ...over,
  });

  it('PAYMENT_CONFIRMED libera créditos uma vez e marca paid', async () => {
    mocks.findPurchase.mockResolvedValue(purchase());

    await applyAsaasEvent(creditPayment('PAYMENT_CONFIRMED'));

    expect(mocks.addCredits).toHaveBeenCalledTimes(1);
    expect(mocks.addCredits).toHaveBeenCalledWith(
      'u1',
      5,
      'purchase',
      'Compra créditos (providerId pay_1)'
    );
    const patch = setPatch(updateChains[0]);
    expect(patch.status).toBe('paid');
    expect(patch.asaasPaymentId).toBe('pay_1');
    expect(patch.paidAt).toBeInstanceOf(Date);

    const cols = mocks.findPurchase.mock.calls.map(
      (call) => (call[0] as { where: { col: string } }).where.col
    );
    expect(cols).toContain('asaasCheckoutId');
  });

  it('segundo PAYMENT_CONFIRMED do mesmo pay_ não duplica (unique violation tratada)', async () => {
    mocks.findPurchase.mockResolvedValue(purchase());
    mocks.addCredits.mockRejectedValueOnce({ code: '23505' });

    await expect(applyAsaasEvent(creditPayment('PAYMENT_CONFIRMED'))).resolves.toBeUndefined();

    expect(mocks.addCredits).toHaveBeenCalledTimes(1);
    expect(setPatch(updateChains[0]).status).toBe('paid');
  });

  it('reentrega real do mesmo pay_ não duplica (status paid curto-circuita)', async () => {
    mocks.findPurchase
      .mockResolvedValueOnce(purchase())
      .mockResolvedValue(purchase({ status: 'paid' }));

    await applyAsaasEvent(creditPayment('PAYMENT_CONFIRMED'));
    await applyAsaasEvent(creditPayment('PAYMENT_CONFIRMED'));

    expect(mocks.addCredits).toHaveBeenCalledTimes(1);
    expect(updateChains).toHaveLength(1);
  });

  it('assinatura resolvida nunca concede créditos mesmo com compra correlacionada', async () => {
    byCheckout = {
      id: 'sub-1',
      userId: 'user-1',
      cycle: 'YEARLY',
      currentPeriodEnd: null,
    };
    mocks.findPurchase.mockResolvedValue(purchase());

    await applyAsaasEvent(creditPayment('PAYMENT_CONFIRMED'));

    expect(mocks.findPurchase).not.toHaveBeenCalled();
    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(setPatch(updateChains[0]).status).toBe('active');
  });

  it('PAYMENT_RECEIVED (Pix) também libera créditos', async () => {
    mocks.findPurchase.mockResolvedValue(purchase({ credits: 3 }));

    await applyAsaasEvent(creditPayment('PAYMENT_RECEIVED', { billingType: 'PIX' }));

    expect(mocks.addCredits).toHaveBeenCalledWith(
      'u1',
      3,
      'purchase',
      'Compra créditos (providerId pay_1)'
    );
    expect(setPatch(updateChains[0]).status).toBe('paid');
  });

  it('PAYMENT_CREATED registra a compra sem liberar créditos', async () => {
    mocks.findPurchase.mockResolvedValue(purchase());
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await applyAsaasEvent(
      creditPayment('PAYMENT_CREATED', { invoiceUrl: 'https://asaas.test/i/inv_1' })
    );

    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(updateChains).toHaveLength(0);
    log.mockRestore();
  });

  it('CHECKOUT_EXPIRED marca expired sem creditar', async () => {
    mocks.findPurchase.mockResolvedValue(purchase());

    await applyAsaasEvent({
      id: 'evt_exp',
      event: 'CHECKOUT_EXPIRED',
      checkout: { id: 'chk_1' },
    });

    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(setPatch(updateChains[0]).status).toBe('expired');
  });

  it('CHECKOUT_CANCELED marca canceled quando pending', async () => {
    mocks.findPurchase.mockResolvedValue(purchase());

    await applyAsaasEvent({
      id: 'evt_can',
      event: 'CHECKOUT_CANCELED',
      checkout: { id: 'chk_1' },
    });

    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(setPatch(updateChains[0]).status).toBe('canceled');
  });

  it('CHECKOUT_EXPIRED não altera compra já paga', async () => {
    mocks.findPurchase.mockResolvedValue(purchase({ status: 'paid' }));

    await applyAsaasEvent({
      id: 'evt_exp_paid',
      event: 'CHECKOUT_EXPIRED',
      checkout: { id: 'chk_1' },
    });

    expect(updateChains).toHaveLength(0);
  });

  it('sem compra correlacionada não lança nem credita', async () => {
    mocks.findPurchase.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      applyAsaasEvent({
        id: 'evt_none',
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_x', status: 'CONFIRMED' },
      })
    ).resolves.toBeUndefined();

    expect(mocks.addCredits).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('correlaciona compra por externalReference UUID (id local)', async () => {
    const localId = '26bf39ac-33c4-4f18-804d-a91405146e8d';
    mocks.findPurchase.mockResolvedValue(purchase({ id: localId, credits: 2 }));

    await applyAsaasEvent({
      id: 'evt_ref',
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_2', externalReference: localId, status: 'CONFIRMED' },
    });

    const cols = mocks.findPurchase.mock.calls.map(
      (call) => (call[0] as { where: { col: string; val: unknown } }).where
    );
    expect(cols.some((c) => c.col === 'id' && c.val === localId)).toBe(true);
    expect(mocks.addCredits).toHaveBeenCalledTimes(1);
  });

  it('PAYMENT_REFUNDED estorna créditos uma vez e marca refunded', async () => {
    mocks.findPurchase.mockResolvedValue(purchase({ status: 'paid' }));

    await applyAsaasEvent(creditPayment('PAYMENT_REFUNDED'));

    expect(mocks.addCredits).toHaveBeenCalledTimes(1);
    expect(mocks.addCredits).toHaveBeenCalledWith(
      'u1',
      -5,
      'refund',
      'Estorno créditos (providerId pay_1)'
    );
    expect(setPatch(updateChains[0]).status).toBe('refunded');
  });

  it('replay de PAYMENT_REFUNDED (já refunded) não estorna de novo', async () => {
    mocks.findPurchase.mockResolvedValue(purchase({ status: 'refunded' }));

    await applyAsaasEvent(creditPayment('PAYMENT_REFUNDED'));

    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(updateChains).toHaveLength(0);
  });

  it('PAYMENT_CHARGEBACK_REQUESTED estorna créditos e marca refunded', async () => {
    mocks.findPurchase.mockResolvedValue(purchase({ status: 'paid', credits: 3 }));

    await applyAsaasEvent(creditPayment('PAYMENT_CHARGEBACK_REQUESTED'));

    expect(mocks.addCredits).toHaveBeenCalledWith(
      'u1',
      -3,
      'refund',
      'Estorno créditos (providerId pay_1)'
    );
    expect(setPatch(updateChains[0]).status).toBe('refunded');
  });

  it('PAYMENT_PARTIALLY_REFUNDED revoga o grant integral (conservador)', async () => {
    mocks.findPurchase.mockResolvedValue(purchase({ status: 'paid' }));

    await applyAsaasEvent(creditPayment('PAYMENT_PARTIALLY_REFUNDED'));

    expect(mocks.addCredits).toHaveBeenCalledWith(
      'u1',
      -5,
      'refund',
      'Estorno créditos (providerId pay_1)'
    );
    expect(setPatch(updateChains[0]).status).toBe('refunded');
  });

  it('estorno com compra não paga não lança crédito negativo', async () => {
    mocks.findPurchase.mockResolvedValue(purchase({ status: 'pending' }));

    await applyAsaasEvent(creditPayment('PAYMENT_REFUNDED'));

    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(updateChains).toHaveLength(0);
  });

  it('retry de PAYMENT_REFUNDED (status ainda paid) não duplica o negativo', async () => {
    // 1ª entrega estorna; 2ª corre lendo `paid` de novo (update não commitou /
    // race). O índice único parcial barra o 2º negativo e o ramo segue.
    mocks.findPurchase.mockResolvedValue(purchase({ status: 'paid' }));
    mocks.addCredits.mockResolvedValueOnce(undefined).mockRejectedValueOnce({ code: '23505' });

    await applyAsaasEvent(creditPayment('PAYMENT_REFUNDED'));
    await expect(applyAsaasEvent(creditPayment('PAYMENT_REFUNDED'))).resolves.toBeUndefined();

    expect(mocks.addCredits).toHaveBeenCalledTimes(2);
    expect(mocks.addCredits).toHaveBeenNthCalledWith(
      2,
      'u1',
      -5,
      'refund',
      'Estorno créditos (providerId pay_1)'
    );
    expect(updateChains.map((c) => setPatch(c).status)).toEqual(['refunded', 'refunded']);
  });

  it('erro não-23505 no estorno é relançado', async () => {
    mocks.findPurchase.mockResolvedValue(purchase({ status: 'paid' }));
    mocks.addCredits.mockRejectedValueOnce(new Error('db down'));

    await expect(applyAsaasEvent(creditPayment('PAYMENT_REFUNDED'))).rejects.toThrow('db down');
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

  it('externalReference não-UUID não consulta o id (evita erro de uuid) nem lança', async () => {
    await expect(
      applyAsaasEvent({
        id: 'evt_dbg',
        event: 'CHECKOUT_PAID',
        checkout: { id: 'chk_dbg', externalReference: 'dbg3-1789328347591', status: 'PAID' },
      })
    ).resolves.toBeUndefined();

    const idCalls = mocks.findSub.mock.calls.filter(
      (call) => (call[0] as { where?: { col?: string } })?.where?.col === 'id'
    );
    expect(idCalls).toHaveLength(0);
  });
});

describe('NFS-e — gated por ASAAS_INVOICE_ENABLED', () => {
  const invoiceEvent = (event: string, over: Record<string, unknown> = {}) => ({
    id: `evt_${event}`,
    event,
    invoice: { id: 'inv_1', status: 'SYNCHRONIZED', ...over },
  });

  const createdEvent = () =>
    ({
      id: 'evt_nfse_created',
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
    }) as const;

  const invoiceInsert = () => {
    for (const r of mocks.insertPayment.mock.results) {
      const values = (r.value as { values: ReturnType<typeof vi.fn> }).values;
      const call = values.mock.calls.find(
        (c) => 'asaasInvoiceId' in (c[0] as Record<string, unknown>)
      );
      if (call) {
        const conflict = values.mock.results[0].value as {
          onConflictDoUpdate: ReturnType<typeof vi.fn>;
        };
        return { args: call[0] as Record<string, unknown>, conflict };
      }
    }
    return null;
  };

  it('flag off ignora INVOICE_* sem consultar assinatura/nota', async () => {
    byProvider = { id: 'sub-1', userId: 'user-1' };

    await applyAsaasEvent(invoiceEvent('INVOICE_CREATED', { subscription: 'sub_1' }));

    expect(mocks.insertPayment).not.toHaveBeenCalled();
    expect(mocks.findSub).not.toHaveBeenCalled();
    expect(mocks.getFiscalInfo).not.toHaveBeenCalled();
  });

  it('flag on upserta invoice correlacionando por invoice.subscription', async () => {
    process.env.ASAAS_INVOICE_ENABLED = 'true';
    byProvider = { id: 'sub-1', userId: 'user-1' };

    await applyAsaasEvent(
      invoiceEvent('INVOICE_SYNCHRONIZED', {
        subscription: 'sub_1',
        status: 'SYNCHRONIZED',
        number: '123',
        value: 119.9,
        pdfUrl: 'https://p/inv.pdf',
        xmlUrl: 'https://p/inv.xml',
        effectiveDate: '2026-10-01',
      })
    );

    const inserted = invoiceInsert();
    expect(inserted).not.toBeNull();
    expect(inserted!.args).toMatchObject({
      asaasInvoiceId: 'inv_1',
      subscriptionId: 'sub-1',
      userId: 'user-1',
      status: 'SYNCHRONIZED',
      number: '123',
      valueCents: 11990,
      pdfUrl: 'https://p/inv.pdf',
      xmlUrl: 'https://p/inv.xml',
    });
    expect((inserted!.args.effectiveDate as Date).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z'
    );

    const conflictArg = inserted!.conflict.onConflictDoUpdate.mock.calls[0][0] as {
      target: unknown;
      set: Record<string, unknown>;
    };
    expect(conflictArg.target).toBe('asaasInvoiceId');
    expect(conflictArg.set.status).toBe('SYNCHRONIZED');
    expect(conflictArg.set.updatedAt).toBeInstanceOf(Date);
  });

  it('flag on upserta invoice sem assinatura correlacionada (nullable)', async () => {
    process.env.ASAAS_INVOICE_ENABLED = 'true';

    await applyAsaasEvent(invoiceEvent('INVOICE_CREATED', { status: 'CREATED' }));

    const inserted = invoiceInsert();
    expect(inserted).not.toBeNull();
    expect(inserted!.args.subscriptionId).toBeNull();
    expect(inserted!.args.userId).toBeNull();
    expect(inserted!.args.status).toBe('CREATED');
  });

  it('flag off não chama fiscalInfo nem configureInvoiceSettings no SUBSCRIPTION_CREATED', async () => {
    byCheckout = { id: 'sub-1', userId: 'user-1', cycle: 'YEARLY', currentPeriodEnd: null };

    await applyAsaasEvent(createdEvent());

    expect(mocks.getFiscalInfo).not.toHaveBeenCalled();
    expect(mocks.configureInvoiceSettings).not.toHaveBeenCalled();
  });

  it('flag on + fiscal ok configura invoiceSettings e grava invoiceConfiguredAt', async () => {
    process.env.ASAAS_INVOICE_ENABLED = 'true';
    byCheckout = { id: 'sub-1', userId: 'user-1', cycle: 'YEARLY', currentPeriodEnd: null };

    await applyAsaasEvent(createdEvent());

    expect(mocks.getFiscalInfo).toHaveBeenCalledTimes(1);
    expect(mocks.configureInvoiceSettings).toHaveBeenCalledWith('sub_1');
    const patches = updateChains.map(setPatch);
    expect(patches.some((p) => p.invoiceConfiguredAt instanceof Date)).toBe(true);
  });

  it('flag on + fiscal 404 (ok:false) loga e segue sem configurar', async () => {
    process.env.ASAAS_INVOICE_ENABLED = 'true';
    byCheckout = { id: 'sub-1', userId: 'user-1', cycle: 'YEARLY', currentPeriodEnd: null };
    mocks.getFiscalInfo.mockResolvedValue({ ok: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(applyAsaasEvent(createdEvent())).resolves.toBeUndefined();

    expect(mocks.configureInvoiceSettings).not.toHaveBeenCalled();
    expect(updateChains.some((c) => 'providerId' in setPatch(c))).toBe(true);
    warn.mockRestore();
  });

  it('erro na config não derruba o SUBSCRIPTION_CREATED', async () => {
    process.env.ASAAS_INVOICE_ENABLED = 'true';
    byCheckout = { id: 'sub-1', userId: 'user-1', cycle: 'YEARLY', currentPeriodEnd: null };
    mocks.configureInvoiceSettings.mockRejectedValue(new Error('asaas down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(applyAsaasEvent(createdEvent())).resolves.toBeUndefined();

    expect(updateChains.some((c) => 'providerId' in setPatch(c))).toBe(true);
    warn.mockRestore();
  });

  it('getFiscalInfo com erro não-404 também não derruba o evento', async () => {
    process.env.ASAAS_INVOICE_ENABLED = 'true';
    byCheckout = { id: 'sub-1', userId: 'user-1', cycle: 'YEARLY', currentPeriodEnd: null };
    mocks.getFiscalInfo.mockRejectedValue(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(applyAsaasEvent(createdEvent())).resolves.toBeUndefined();

    expect(mocks.configureInvoiceSettings).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

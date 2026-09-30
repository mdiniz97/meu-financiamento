import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  redirect: vi.fn(),
  auth: vi.fn(),
  hasActiveAccess: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  cancelAtPeriodEnd: vi.fn(),
  packsFindFirst: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
  txFindMany: vi.fn(),
  txFindFirst: vi.fn(),
  txInsert: vi.fn(),
  txValues: vi.fn(),
  txOnConflict: vi.fn(),
  txReturning: vi.fn(),
  txUpdate: vi.fn(),
  txUpdateSet: vi.fn(),
  txUpdateWhere: vi.fn(),
  updateWhere: vi.fn(),
  updateSet: vi.fn(),
  update: vi.fn(),
  captureAccountEvent: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/subscriptions/access', () => ({ hasActiveAccess: m.hasActiveAccess }));
vi.mock('@/lib/payments/asaas/checkout', () => ({
  createSubscriptionCheckout: m.createSubscriptionCheckout,
}));
vi.mock('@/lib/payments/asaas/subscription', () => ({
  cancelAtPeriodEnd: m.cancelAtPeriodEnd,
}));
vi.mock('@/lib/analytics/server', () => ({ captureAccountEvent: m.captureAccountEvent }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  inArray: (...args: unknown[]) => args,
  sql: Object.assign((...args: unknown[]) => args, { raw: (...args: unknown[]) => args }),
}));
vi.mock('@/db', () => ({
  db: {
    query: { packs: { findFirst: m.packsFindFirst } },
    transaction: m.transaction,
    update: m.update,
  },
  schema: {
    packs: { id: 'packs.id' },
    users: { id: 'users.id' },
    subscriptions: {
      id: 'subscriptions.id',
      userId: 'subscriptions.user_id',
      packId: 'subscriptions.pack_id',
      provider: 'subscriptions.provider',
      status: 'subscriptions.status',
    },
  },
}));

import { startSubscription } from './actions';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PAYMENT_PROVIDER', 'asaas');

  m.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({
      execute: m.execute,
      query: { subscriptions: { findMany: m.txFindMany, findFirst: m.txFindFirst } },
      insert: m.txInsert,
      update: m.txUpdate,
    })
  );
  m.txInsert.mockReturnValue({ values: m.txValues });
  m.txValues.mockReturnValue({ onConflictDoNothing: m.txOnConflict });
  m.txOnConflict.mockReturnValue({ returning: m.txReturning });
  m.txUpdate.mockReturnValue({ set: m.txUpdateSet });
  m.txUpdateSet.mockReturnValue({ where: m.txUpdateWhere });
  m.update.mockReturnValue({ set: m.updateSet });
  m.updateSet.mockReturnValue({ where: m.updateWhere });

  m.execute.mockResolvedValue(undefined);
  m.txFindMany.mockResolvedValue([]);
  m.txFindFirst.mockResolvedValue(null);
  m.txReturning.mockResolvedValue([{ id: 'sub-new' }]);

  m.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  m.auth.mockResolvedValue({ userId: 'user-1' });
  m.hasActiveAccess.mockResolvedValue(false);
  m.packsFindFirst.mockResolvedValue({ id: 'unlimited', priceCents: 11990 });
  m.createSubscriptionCheckout.mockResolvedValue({
    id: 'chk_1',
    link: 'https://sandbox.asaas.com/checkoutSession/show/chk_1',
  });
  m.cancelAtPeriodEnd.mockReset().mockResolvedValue(undefined);
});

describe('startSubscription', () => {
  it('serializa trial x checkout: lock do usuário e re-checagem dentro da transação', async () => {
    // Pré-cheque passou (corrida): o acesso ativo só aparece dentro do lock.
    m.hasActiveAccess.mockResolvedValue(false);
    m.txFindMany.mockResolvedValue([
      { status: 'active', currentPeriodEnd: new Date(Date.now() + 60_000), graceUntil: null },
    ]);

    await expect(startSubscription()).rejects.toThrow('REDIRECT:/perfil');

    expect(m.execute).toHaveBeenCalledTimes(1);
    expect(m.txInsert).not.toHaveBeenCalled();
    expect(m.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('não inicia checkout pago enquanto acesso Ilimitado local está ativo', async () => {
    m.hasActiveAccess.mockResolvedValue(true);
    await expect(startSubscription()).rejects.toThrow('REDIRECT:/perfil');
    expect(m.createSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it('reusa a linha local em retry (não insere outra) e redireciona ao link', async () => {
    m.txFindFirst.mockResolvedValue({ id: 'sub-existing' });

    await expect(startSubscription()).rejects.toThrow(
      'REDIRECT:https://sandbox.asaas.com/checkoutSession/show/chk_1'
    );

    expect(m.txInsert).not.toHaveBeenCalled();
    expect(m.txUpdateSet).toHaveBeenCalledWith({
      status: 'incomplete',
      asaasCheckoutId: null,
      asaasSubscriptionId: null,
      providerId: null,
    });
    expect(m.txUpdateWhere).toHaveBeenCalledWith(['subscriptions.id', 'sub-existing']);
    expect(m.updateSet).toHaveBeenCalledWith({ asaasCheckoutId: 'chk_1' });
    expect(m.captureAccountEvent).toHaveBeenCalledWith('user-1', 'checkout_started', 'chk_1');
    expect(m.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: 'sub-existing',
        valueCents: 11990,
        cycle: 'YEARLY',
      })
    );
  });

  it('cancela a assinatura Asaas antiga antes de criar o novo checkout', async () => {
    m.txFindFirst.mockResolvedValue({
      id: 'sub-existing',
      asaasSubscriptionId: 'asaas_old',
      asaasStatus: 'ACTIVE',
    });

    await expect(startSubscription()).rejects.toThrow(
      'REDIRECT:https://sandbox.asaas.com/checkoutSession/show/chk_1'
    );

    expect(m.cancelAtPeriodEnd).toHaveBeenCalledWith('asaas_old');
    const cancelOrder = m.cancelAtPeriodEnd.mock.invocationCallOrder[0];
    const checkoutOrder = m.createSubscriptionCheckout.mock.invocationCallOrder[0];
    expect(cancelOrder).toBeLessThan(checkoutOrder);
  });

  it('não cancela quando o Asaas antigo já está INACTIVE', async () => {
    m.txFindFirst.mockResolvedValue({
      id: 'sub-existing',
      asaasSubscriptionId: 'asaas_old',
      asaasStatus: 'INACTIVE',
    });

    await expect(startSubscription()).rejects.toThrow(
      'REDIRECT:https://sandbox.asaas.com/checkoutSession/show/chk_1'
    );

    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('reusa a linha vencedora quando o insert não grava (conflito)', async () => {
    m.txFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub-winner' });
    m.txReturning.mockResolvedValueOnce([]);

    await expect(startSubscription()).rejects.toThrow(
      'REDIRECT:https://sandbox.asaas.com/checkoutSession/show/chk_1'
    );

    expect(m.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ externalReference: 'sub-winner' })
    );
  });

  it('insere linha nova quando não existe e atualiza o checkout id', async () => {
    m.txFindFirst.mockResolvedValue(null);

    await expect(startSubscription()).rejects.toThrow(
      'REDIRECT:https://sandbox.asaas.com/checkoutSession/show/chk_1'
    );

    expect(m.txInsert).toHaveBeenCalledTimes(1);
    expect(m.txValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        packId: 'unlimited',
        provider: 'asaas',
        status: 'incomplete',
        cycle: 'YEARLY',
        billingType: 'CREDIT_CARD',
      })
    );
    expect(m.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: 'sub-new',
        successUrl: expect.stringContaining('/assinar/sucesso'),
      })
    );
  });

  it('manda para o login com callbackUrl quando não autenticado', async () => {
    m.auth.mockResolvedValue(null);

    await expect(startSubscription()).rejects.toThrow(
      'REDIRECT:/login?callbackUrl=/assinar'
    );

    expect(m.createSubscriptionCheckout).not.toHaveBeenCalled();
  });
});

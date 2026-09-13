import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  redirect: vi.fn(),
  auth: vi.fn(),
  hasActiveAccess: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
  packsFindFirst: vi.fn(),
  subsFindFirst: vi.fn(),
  insertReturning: vi.fn(),
  insertValues: vi.fn(),
  insert: vi.fn(),
  updateWhere: vi.fn(),
  updateSet: vi.fn(),
  update: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/subscriptions/access', () => ({ hasActiveAccess: m.hasActiveAccess }));
vi.mock('@/lib/payments/asaas/checkout', () => ({
  createSubscriptionCheckout: m.createSubscriptionCheckout,
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
}));
vi.mock('@/db', () => ({
  db: {
    query: {
      packs: { findFirst: m.packsFindFirst },
      subscriptions: { findFirst: m.subsFindFirst },
    },
    insert: m.insert,
    update: m.update,
  },
  schema: {
    packs: { id: 'packs.id' },
    subscriptions: {
      id: 'subscriptions.id',
      userId: 'subscriptions.user_id',
      packId: 'subscriptions.pack_id',
      provider: 'subscriptions.provider',
    },
  },
}));

import { startSubscription } from './actions';

beforeEach(() => {
  vi.clearAllMocks();
  m.insert.mockImplementation(() => ({ values: m.insertValues }));
  m.insertValues.mockImplementation(() => ({ returning: m.insertReturning }));
  m.update.mockImplementation(() => ({ set: m.updateSet }));
  m.updateSet.mockImplementation(() => ({ where: m.updateWhere }));
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
  m.insertReturning.mockResolvedValue([{ id: 'sub-new' }]);
});

describe('startSubscription', () => {
  it('reusa a linha local em retry (não insere outra) e redireciona ao link', async () => {
    m.subsFindFirst.mockResolvedValue({ id: 'sub-existing' });

    await expect(startSubscription()).rejects.toThrow(
      'REDIRECT:https://sandbox.asaas.com/checkoutSession/show/chk_1'
    );

    expect(m.insert).not.toHaveBeenCalled();
    expect(m.updateSet).toHaveBeenCalledWith({ status: 'incomplete', asaasCheckoutId: null });
    expect(m.updateWhere).toHaveBeenCalledWith(['subscriptions.id', 'sub-existing']);
    expect(m.updateSet).toHaveBeenCalledWith({ asaasCheckoutId: 'chk_1' });
    expect(m.createSubscriptionCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: 'sub-existing',
        valueCents: 11990,
        cycle: 'YEARLY',
      })
    );
  });

  it('insere linha nova quando não existe e atualiza o checkout id', async () => {
    m.subsFindFirst.mockResolvedValue(null);

    await expect(startSubscription()).rejects.toThrow(
      'REDIRECT:https://sandbox.asaas.com/checkoutSession/show/chk_1'
    );

    expect(m.insert).toHaveBeenCalledTimes(1);
    expect(m.insertValues).toHaveBeenCalledWith(
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

  it('redireciona para /perfil se já há acesso ativo (sem novo checkout)', async () => {
    m.hasActiveAccess.mockResolvedValue(true);

    await expect(startSubscription()).rejects.toThrow('REDIRECT:/perfil');

    expect(m.createSubscriptionCheckout).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('manda para o login com callbackUrl quando não autenticado', async () => {
    m.auth.mockResolvedValue(null);

    await expect(startSubscription()).rejects.toThrow(
      'REDIRECT:/login?callbackUrl=/assinar'
    );

    expect(m.createSubscriptionCheckout).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  return {
    auth: vi.fn(),
    packFindFirst: vi.fn(),
    createCheckout: vi.fn(),
    createCreditsCheckout: vi.fn(),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: updateSet })),
    insertValues,
    insertReturning,
    updateSet,
    updateWhere,
    captureAccountEvent: vi.fn(),
  };
});

vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/db', () => ({
  db: {
    query: { packs: { findFirst: m.packFindFirst } },
    insert: m.insert,
    update: m.update,
  },
  schema: {
    packs: { id: 'packs.id' },
    creditPurchases: {
      id: 'credit_purchases.id',
      asaasCheckoutId: 'credit_purchases.asaas_checkout_id',
    },
  },
}));
vi.mock('@/lib/payments', () => ({
  getPaymentProvider: () => ({ createCheckout: m.createCheckout }),
}));
vi.mock('@/lib/payments/asaas/checkout', () => ({
  createCreditsCheckout: m.createCreditsCheckout,
}));
vi.mock('@/lib/analytics/server', () => ({ captureAccountEvent: m.captureAccountEvent }));
vi.mock('drizzle-orm', () => ({ eq: (...args: unknown[]) => args }));

import { POST } from './route';
import { AsaasApiError } from '@/lib/payments/asaas/client';

function req(body: unknown) {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PAYMENT_PROVIDER', 'asaas');
  vi.stubEnv('APP_URL', 'https://app.example/');
  m.auth.mockResolvedValue({ userId: 'user-1' });
  m.insertReturning.mockResolvedValue([{ id: 'purchase-1' }]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/checkout', () => {
  it('asaas + créditos insere purchase pendente e devolve o link', async () => {
    m.packFindFirst.mockResolvedValue({
      id: 'credits5',
      priceCents: 1000,
      isSubscription: false,
      credits: 5,
    });
    m.createCreditsCheckout.mockResolvedValue({
      id: 'chk_c',
      link: 'https://sandbox.asaas.com/checkoutSession/show/chk_c',
    });

    const res = await POST(req({ packId: 'credits5' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      checkoutUrl: 'https://sandbox.asaas.com/checkoutSession/show/chk_c',
    });
    expect(m.insert).toHaveBeenCalledTimes(1);
    expect(m.insertValues).toHaveBeenCalledWith({
      userId: 'user-1',
      packId: 'credits5',
      provider: 'asaas',
      status: 'pending',
      credits: 5,
    });
    expect(m.createCreditsCheckout).toHaveBeenCalledWith({
      externalReference: 'purchase-1',
      valueCents: 1000,
      successUrl: 'https://app.example/perfil',
      cancelUrl: 'https://app.example/perfil',
      expiredUrl: 'https://app.example/perfil',
    });
    expect(m.updateSet).toHaveBeenCalledWith({ asaasCheckoutId: 'chk_c' });
    expect(m.updateWhere).toHaveBeenCalledTimes(1);
    expect(m.updateWhere).toHaveBeenCalledWith(['credit_purchases.id', 'purchase-1']);
    expect(m.createCheckout).not.toHaveBeenCalled();
    expect(m.captureAccountEvent).toHaveBeenCalledWith('user-1', 'checkout_started', 'purchase-1');
  });

  it('asaas + pack avulso sem créditos responde 400 sem inserir', async () => {
    m.packFindFirst.mockResolvedValue({
      id: 'credits0',
      priceCents: 1000,
      isSubscription: false,
      credits: 0,
    });

    const res = await POST(req({ packId: 'credits0' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Pack de créditos inválido.' });
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.createCreditsCheckout).not.toHaveBeenCalled();
    expect(m.createCheckout).not.toHaveBeenCalled();
    expect(m.captureAccountEvent).not.toHaveBeenCalled();
  });

  it('asaas + pack avulso com credits null responde 400 sem inserir', async () => {
    m.packFindFirst.mockResolvedValue({
      id: 'creditsnull',
      priceCents: 1000,
      isSubscription: false,
      credits: null,
    });

    const res = await POST(req({ packId: 'creditsnull' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Pack de créditos inválido.' });
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.createCreditsCheckout).not.toHaveBeenCalled();
  });

  it('asaas + assinatura responde 400 (use /assinar) sem inserir', async () => {
    m.packFindFirst.mockResolvedValue({
      id: 'unlimited',
      priceCents: 11990,
      isSubscription: true,
      credits: null,
    });

    const res = await POST(req({ packId: 'unlimited' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Use /assinar para assinar o plano Ilimitado.',
    });
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.createCreditsCheckout).not.toHaveBeenCalled();
    expect(m.createCheckout).not.toHaveBeenCalled();
  });

  it('fake continua criando checkout normalmente', async () => {
    vi.stubEnv('PAYMENT_PROVIDER', 'fake');
    m.packFindFirst.mockResolvedValue({
      id: 'credits5',
      priceCents: 1000,
      isSubscription: false,
      credits: 5,
    });
    m.createCheckout.mockResolvedValue({
      checkoutUrl: '/api/webhooks/payments?fake=approve',
    });

    const res = await POST(req({ packId: 'credits5' }));

    expect(res.status).toBe(200);
    expect(m.createCheckout).toHaveBeenCalledTimes(1);
    expect(m.createCreditsCheckout).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('asaas + falha do Asaas ao criar checkout responde 502 (não 500)', async () => {
    m.packFindFirst.mockResolvedValue({
      id: 'credits5',
      priceCents: 1000,
      isSubscription: false,
      credits: 5,
    });
    m.createCreditsCheckout.mockRejectedValue(
      new AsaasApiError(400, { errors: [{ description: 'invalid' }] })
    );

    const res = await POST(req({ packId: 'credits5' }));

    expect(res.status).toBe(502);
    expect(m.insert).toHaveBeenCalledTimes(1);
    expect(m.updateSet).toHaveBeenCalledWith({ status: 'canceled' });
  });

  it.each([408, 429, 500, 503])('preserva compra pendente após HTTP %i', async (status) => {
    m.packFindFirst.mockResolvedValue({ id: 'credits5', priceCents: 1000, isSubscription: false, credits: 5 });
    m.createCreditsCheckout.mockRejectedValue(new AsaasApiError(status, { errors: [] }));
    const res = await POST(req({ packId: 'credits5' }));
    expect(res.status).toBe(502);
    expect(m.update).not.toHaveBeenCalled();
  });

  it('preserva compra pendente após timeout de rede', async () => {
    m.packFindFirst.mockResolvedValue({ id: 'credits5', priceCents: 1000, isSubscription: false, credits: 5 });
    m.createCreditsCheckout.mockRejectedValue(new DOMException('Timeout', 'AbortError'));
    const res = await POST(req({ packId: 'credits5' }));
    expect(res.status).toBe(502);
    expect(m.update).not.toHaveBeenCalled();
  });

  it('explica quando Pix está indisponível na conta Asaas', async () => {
    m.packFindFirst.mockResolvedValue({
      id: 'credits5',
      priceCents: 1000,
      isSubscription: false,
      credits: 5,
    });
    m.createCreditsCheckout.mockRejectedValue(
      new AsaasApiError(400, {
        errors: [{ description: 'Para gerar cobranças com Pix é necessário criar uma chave Pix no Asaas.' }],
      })
    );

    const res = await POST(req({ packId: 'credits5' }));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: 'Pix está indisponível no momento. Entre em contato com o suporte para concluir sua compra.',
    });
    expect(m.updateSet).toHaveBeenCalledWith({ status: 'canceled' });
  });
});

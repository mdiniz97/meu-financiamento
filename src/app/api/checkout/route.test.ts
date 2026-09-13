import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  packFindFirst: vi.fn(),
  createCheckout: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/db', () => ({
  db: { query: { packs: { findFirst: m.packFindFirst } } },
  schema: { packs: { id: 'packs.id' } },
}));
vi.mock('@/lib/payments', () => ({
  getPaymentProvider: () => ({ createCheckout: m.createCheckout }),
}));
vi.mock('drizzle-orm', () => ({ eq: (...args: unknown[]) => args }));

import { POST } from './route';

function req(body: unknown) {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PAYMENT_PROVIDER', 'asaas');
  m.auth.mockResolvedValue({ userId: 'user-1' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/checkout', () => {
  it('501 para pack de créditos no Asaas e não chama o provider', async () => {
    m.packFindFirst.mockResolvedValue({
      id: 'credits-10',
      priceCents: 1000,
      isSubscription: false,
    });

    const res = await POST(req({ packId: 'credits-10' }));

    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({
      error: 'Compra de créditos ainda não disponível no Asaas; use um pack de assinatura em /assinar.',
    });
    expect(m.createCheckout).not.toHaveBeenCalled();
  });

  it('400 para pack de assinatura no Asaas (use /assinar) e não chama o provider', async () => {
    m.packFindFirst.mockResolvedValue({
      id: 'unlimited',
      priceCents: 11990,
      isSubscription: true,
    });

    const res = await POST(req({ packId: 'unlimited' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Use /assinar para assinar o plano Ilimitado.',
    });
    expect(m.createCheckout).not.toHaveBeenCalled();
  });

  it('fake continua criando checkout normalmente', async () => {
    vi.stubEnv('PAYMENT_PROVIDER', 'fake');
    m.packFindFirst.mockResolvedValue({
      id: 'credits-10',
      priceCents: 1000,
      isSubscription: false,
    });
    m.createCheckout.mockResolvedValue({
      checkoutUrl: '/api/webhooks/payments?fake=approve',
    });

    const res = await POST(req({ packId: 'credits-10' }));

    expect(res.status).toBe(200);
    expect(m.createCheckout).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCreditsCheckout, createSubscriptionCheckout } from './checkout';

afterEach(() => vi.restoreAllMocks());
const env = () => {
  vi.stubEnv('ASAAS_ENV', 'sandbox');
  vi.stubEnv('ASAAS_BASE_URL', 'https://api-sandbox.asaas.com/v3');
  vi.stubEnv('ASAAS_API_KEY', '$aact_hmlg_x');
  vi.stubEnv('ASAAS_WEBHOOK_AUTH_TOKEN', 'x'.repeat(32));
};

describe('createSubscriptionCheckout', () => {
  it('envia RECURRENT com YEARLY e externalReference', async () => {
    env();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'chk_1', link: 'https://sandbox.asaas.com/checkoutSession/show/chk_1' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await createSubscriptionCheckout({
      externalReference: 'sub-local-1',
      valueCents: 11990,
      cycle: 'YEARLY',
      nextDueDate: '2026-09-13',
      successUrl: 'https://app/assinar/sucesso',
      cancelUrl: 'https://app/assinar',
      expiredUrl: 'https://app/assinar',
    });
    expect(out.link).toContain('chk_1');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.chargeTypes).toEqual(['RECURRENT']);
    expect(body.subscription).toMatchObject({ cycle: 'YEARLY', nextDueDate: '2026-09-13' });
    expect(body.externalReference).toBe('sub-local-1');
    expect(body.items[0].value).toBeCloseTo(119.9);
  });

  it('manda billingTypes CREDIT_CARD, callback e POST /checkouts', async () => {
    env();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'chk_2', link: 'https://sandbox.asaas.com/checkoutSession/show/chk_2' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await createSubscriptionCheckout({
      externalReference: 'sub-local-2',
      valueCents: 11990,
      cycle: 'YEARLY',
      nextDueDate: '2026-09-13',
      successUrl: 'https://app/assinar/sucesso',
      cancelUrl: 'https://app/assinar',
      expiredUrl: 'https://app/assinar',
    });
    expect(out.id).toBe('chk_2');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api-sandbox.asaas.com/v3/checkouts');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.billingTypes).toEqual(['CREDIT_CARD']);
    expect(body.callback).toEqual({
      successUrl: 'https://app/assinar/sucesso',
      cancelUrl: 'https://app/assinar',
      expiredUrl: 'https://app/assinar',
    });
    expect(body.items).toEqual([{ name: 'Assinatura Ilimitado', quantity: 1, value: 119.9 }]);
  });
});

describe('createCreditsCheckout', () => {
  it('envia DETACHED com cartão e Pix', async () => {
    env();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'chk_c', link: 'https://x/y' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await createCreditsCheckout({
      externalReference: 'p1',
      valueCents: 1000,
      successUrl: 'https://a/s',
      cancelUrl: 'https://a/c',
      expiredUrl: 'https://a/e',
    });
    expect(out).toEqual({ id: 'chk_c', link: 'https://x/y' });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.chargeTypes).toEqual(['DETACHED']);
    expect(body.billingTypes).toEqual(['CREDIT_CARD', 'PIX']);
    expect(body.externalReference).toBe('p1');
    expect(body.items[0].value).toBeCloseTo(10);
  });

  it('manda callback, items de créditos e POST /checkouts', async () => {
    env();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'chk_c2', link: 'https://x/y2' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await createCreditsCheckout({
      externalReference: 'p2',
      valueCents: 1000,
      successUrl: 'https://a/s',
      cancelUrl: 'https://a/c',
      expiredUrl: 'https://a/e',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api-sandbox.asaas.com/v3/checkouts');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.callback).toEqual({
      successUrl: 'https://a/s',
      cancelUrl: 'https://a/c',
      expiredUrl: 'https://a/e',
    });
    expect(body.items).toEqual([{ name: 'Créditos amortiza.me', quantity: 1, value: 10 }]);
  });

  it('cai para cartão quando o Asaas recusa por falta de chave Pix', async () => {
    env();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              {
                code: 'invalid_object',
                description: 'Para gerar cobranças com Pix é necessário criar uma chave Pix no Asaas.',
              },
            ],
          }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'chk_c3', link: 'https://x/y3' }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const out = await createCreditsCheckout({
      externalReference: 'p3',
      valueCents: 1000,
      successUrl: 'https://a/s',
      cancelUrl: 'https://a/c',
      expiredUrl: 'https://a/e',
    });

    expect(out).toEqual({ id: 'chk_c3', link: 'https://x/y3' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(second.billingTypes).toEqual(['CREDIT_CARD']);
  });
});

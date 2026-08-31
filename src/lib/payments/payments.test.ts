import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPaymentProvider } from './index';
import { FakeProvider } from './fake';

describe('payments', () => {
  afterEach(() => vi.restoreAllMocks());

  it('env PAYMENT_PROVIDER=fake usa FakeProvider', () => {
    process.env.PAYMENT_PROVIDER = 'fake';
    expect(getPaymentProvider()).toBeInstanceOf(FakeProvider);
  });
  it('fake provider devolve checkout url', async () => {
    const p = new FakeProvider();
    const r = await p.createCheckout({ userId: 'u1', packId: 'credits5', priceCents: 1000 });
    expect(r.checkoutUrl).toContain('/api/webhooks/payments');
  });
  it('gera providerId único por usuário/pacote mesmo no mesmo milissegundo', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const p = new FakeProvider();
    const a = await p.verifyWebhook(JSON.stringify({ userId: 'u1', packId: 'unlimited' }), null);
    const b = await p.verifyWebhook(JSON.stringify({ userId: 'u2', packId: 'unlimited' }), null);
    const c = await p.verifyWebhook(JSON.stringify({ userId: 'u1', packId: 'credits5' }), null);
    expect(a!.providerId).not.toBe(b!.providerId);
    expect(a!.providerId).not.toBe(c!.providerId);
  });
  it('providerId é determinístico para a mesma compra (idempotência)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const p = new FakeProvider();
    const a = await p.verifyWebhook(JSON.stringify({ userId: 'u1', packId: 'unlimited' }), null);
    const b = await p.verifyWebhook(JSON.stringify({ userId: 'u1', packId: 'unlimited' }), null);
    expect(a!.providerId).toBe(b!.providerId);
  });
});

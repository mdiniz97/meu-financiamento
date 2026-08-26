import { describe, expect, it } from 'vitest';
import { getPaymentProvider } from './index';
import { FakeProvider } from './fake';

describe('payments', () => {
  it('env PAYMENT_PROVIDER=fake usa FakeProvider', () => {
    process.env.PAYMENT_PROVIDER = 'fake';
    expect(getPaymentProvider()).toBeInstanceOf(FakeProvider);
  });
  it('fake provider devolve checkout url', async () => {
    const p = new FakeProvider();
    const r = await p.createCheckout({ userId: 'u1', packId: 'credits10', priceCents: 1000 });
    expect(r.checkoutUrl).toContain('/api/webhooks/payments');
  });
});

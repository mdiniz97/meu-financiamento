import { FakeProvider } from './fake';
import { StripeProvider } from './stripe';
import { AsaasProvider } from './asaas';
import type { PaymentProvider } from './types';

export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? 'fake';
  if (name === 'fake') return new FakeProvider();
  if (name === 'stripe') return new StripeProvider();
  if (name === 'asaas') return new AsaasProvider();
  throw new Error(`PAYMENT_PROVIDER inválido: ${name}`);
}

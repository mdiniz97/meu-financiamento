import type { PaymentProvider } from './types';

export class StripeProvider implements PaymentProvider {
  async createCheckout(): Promise<{ checkoutUrl: string }> {
    throw new Error('PAYMENT_PROVIDER=stripe ainda não configurado');
  }

  async verifyWebhook(): Promise<{
    userId: string;
    packId: string;
    providerId: string;
  } | null> {
    throw new Error('PAYMENT_PROVIDER=stripe ainda não configurado');
  }
}

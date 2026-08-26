import type { PaymentProvider } from './types';

export class AsaasProvider implements PaymentProvider {
  async createCheckout(): Promise<{ checkoutUrl: string }> {
    throw new Error('PAYMENT_PROVIDER=asaas ainda não configurado');
  }

  async verifyWebhook(): Promise<{
    userId: string;
    packId: string;
    providerId: string;
  } | null> {
    throw new Error('PAYMENT_PROVIDER=asaas ainda não configurado');
  }
}

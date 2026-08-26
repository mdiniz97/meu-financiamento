export interface PaymentProvider {
  createCheckout(params: {
    userId: string;
    packId: string;
    priceCents: number;
  }): Promise<{ checkoutUrl: string }>;
  verifyWebhook(
    payload: string,
    signature: string | null
  ): Promise<{ userId: string; packId: string; providerId: string } | null>;
}

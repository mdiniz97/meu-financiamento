import type { PaymentProvider } from './types';

export class FakeProvider implements PaymentProvider {
  async createCheckout(params: {
    userId: string;
    packId: string;
    priceCents: number;
  }): Promise<{ checkoutUrl: string }> {
    void params;
    return { checkoutUrl: '/api/webhooks/payments?fake=approve' };
  }

  async verifyWebhook(
    payload: string,
    signature: string | null
  ): Promise<{ userId: string; packId: string; providerId: string } | null> {
    void signature;
    let parsed: { userId?: string; packId?: string };
    try {
      parsed = JSON.parse(payload) as { userId?: string; packId?: string };
    } catch {
      return null;
    }
    if (!parsed.userId || !parsed.packId) return null;
    // providerId determinístico por compra (usuário + pacote): garante
    // idempotência e evita colisão entre compras paralelas no mesmo
    // milissegundo (Date.now() não é único entre usuários)
    return {
      userId: parsed.userId,
      packId: parsed.packId,
      providerId: `fake_${parsed.userId}_${parsed.packId}`,
    };
  }
}

import { asaasFetch } from './client';
import { getAsaasConfig } from './config';

export interface CreateCheckoutInput {
  externalReference: string;
  valueCents: number;
  cycle: 'YEARLY' | 'MONTHLY';
  nextDueDate: string;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}

export interface SubscriptionCheckout {
  id: string;
  link: string;
}

/** Cancela um checkout hospedado que nunca foi pago (troca de ciclo). */
export async function cancelCheckout(checkoutId: string): Promise<void> {
  const cfg = getAsaasConfig();
  await asaasFetch(cfg, `/checkouts/${checkoutId}/cancel`, { method: 'POST' });
}

export async function createSubscriptionCheckout(
  input: CreateCheckoutInput
): Promise<SubscriptionCheckout> {
  const cfg = getAsaasConfig();
  return asaasFetch<SubscriptionCheckout>(cfg, '/checkouts', {
    method: 'POST',
    body: {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      items: [{ name: 'Assinatura Ilimitado', quantity: 1, value: input.valueCents / 100 }],
      subscription: { cycle: input.cycle, nextDueDate: input.nextDueDate },
      externalReference: input.externalReference,
      callback: {
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        expiredUrl: input.expiredUrl,
      },
    },
  });
}

export interface CreateCreditsCheckoutInput {
  externalReference: string;
  valueCents: number;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}

export async function createCreditsCheckout(
  input: CreateCreditsCheckoutInput
): Promise<SubscriptionCheckout> {
  const cfg = getAsaasConfig();
  const base = {
    chargeTypes: ['DETACHED'],
    items: [{ name: 'Créditos amortiza.me', quantity: 1, value: input.valueCents / 100 }],
    externalReference: input.externalReference,
    callback: {
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      expiredUrl: input.expiredUrl,
    },
  };

  return asaasFetch<SubscriptionCheckout>(cfg, '/checkouts', {
    method: 'POST',
    body: { billingTypes: ['CREDIT_CARD', 'PIX'], ...base },
  });
}

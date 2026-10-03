export type BillingCycle = 'MONTHLY' | 'YEARLY';

export function requireBillingCycle(value: unknown = 'YEARLY'): BillingCycle {
  if (value !== 'MONTHLY' && value !== 'YEARLY') throw new Error('Ciclo de assinatura inválido');
  return value;
}

export function subscriptionPrice(pack: { priceCents: number; monthlyPriceCents?: number | null }, cycle: BillingCycle): number {
  const price = cycle === 'MONTHLY' ? pack.monthlyPriceCents : pack.priceCents;
  if (!price || !Number.isSafeInteger(price) || price <= 0) throw new Error('Preço da assinatura indisponível');
  return price;
}

export const cycleLabel = (cycle: BillingCycle) => cycle === 'MONTHLY' ? 'mês' : 'ano';

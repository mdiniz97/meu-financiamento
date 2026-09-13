import { asaasFetch } from './client';
import { getAsaasConfig } from './config';

export interface AsaasSubscription {
  id: string;
  status: string;
  nextDueDate?: string;
  value?: number;
  cycle?: string;
  billingType?: string;
}

export async function cancelAtPeriodEnd(asaasSubscriptionId: string): Promise<void> {
  const cfg = getAsaasConfig();
  await asaasFetch(cfg, `/subscriptions/${asaasSubscriptionId}`, {
    method: 'PUT',
    body: { status: 'INACTIVE' },
  });
}

export async function getSubscription(id: string): Promise<AsaasSubscription> {
  const cfg = getAsaasConfig();
  const raw = await asaasFetch<AsaasSubscription>(cfg, `/subscriptions/${id}`);
  return {
    id: raw.id,
    status: raw.status,
    nextDueDate: raw.nextDueDate,
    value: raw.value,
    cycle: raw.cycle,
    billingType: raw.billingType,
  };
}

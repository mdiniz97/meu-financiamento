import { AsaasApiError, asaasFetch } from './client';
import { getAsaasConfig } from './config';
import { invoiceSettingsBody } from './invoice-config';

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

/** GET /fiscalInfo/ — 200 → ok; 404 → conta sem config fiscal; outro erro propaga. */
export async function getFiscalInfo(): Promise<{ ok: boolean }> {
  try {
    await asaasFetch(getAsaasConfig(), '/fiscalInfo/');
    return { ok: true };
  } catch (e) {
    if (e instanceof AsaasApiError && e.status === 404) return { ok: false };
    throw e;
  }
}

export async function configureInvoiceSettings(asaasSubscriptionId: string): Promise<void> {
  const cfg = getAsaasConfig();
  await asaasFetch(cfg, `/subscriptions/${asaasSubscriptionId}/invoiceSettings`, {
    method: 'POST',
    body: invoiceSettingsBody(),
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

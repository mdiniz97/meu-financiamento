import { and, inArray, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAsaasConfig } from '@/lib/payments/asaas/config';
import { isInvoiceEnabled } from '@/lib/payments/asaas/invoice-config';
import { updateInvoiceSettings } from '@/lib/payments/asaas/subscription';

/** Só assinaturas que ainda geram cobranças NFS-e. */
const REFRESH_STATUSES = ['active', 'trialing'] as const;

export interface InvoiceRefreshResult {
  checked: number;
  updated: number;
  failed: number;
  skipped: boolean;
}

/**
 * Job mensal: o ISS varia com o faturamento, e o `invoiceSettings` de uma
 * assinatura é aplicado uma única vez — a Asaas reusa aquela alíquota nas
 * cobranças seguintes. Reenviamos a alíquota vigente para todas as assinaturas
 * ativas. Uma falha isolada não interrompe o lote (nem derruba o cron).
 */
export async function refreshSubscriptionInvoiceSettings(): Promise<InvoiceRefreshResult> {
  const skipped: InvoiceRefreshResult = { checked: 0, updated: 0, failed: 0, skipped: true };
  if (!isInvoiceEnabled()) return skipped;
  // NFS-e exige certificado/dados fiscais reais: só roda em produção.
  if (getAsaasConfig().env !== 'production') return skipped;

  const subs = await db.query.subscriptions.findMany({
    columns: { id: true, providerId: true },
    where: and(
      isNotNull(schema.subscriptions.providerId),
      isNotNull(schema.subscriptions.invoiceConfiguredAt),
      inArray(schema.subscriptions.status, [...REFRESH_STATUSES])
    ),
  });

  let updated = 0;
  let failed = 0;
  for (const sub of subs) {
    if (!sub.providerId) continue;
    try {
      await updateInvoiceSettings(sub.providerId);
      updated += 1;
    } catch (e) {
      failed += 1;
      console.warn(`[invoice-refresh] falha ao atualizar NFS-e de ${sub.providerId}:`, e);
    }
  }

  return { checked: subs.length, updated, failed, skipped: false };
}

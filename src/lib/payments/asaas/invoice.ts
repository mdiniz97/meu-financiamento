import { asaasFetch } from './client';
import { getAsaasConfig } from './config';
import { invoiceServiceFields, invoiceTaxes } from './invoice-config';

export interface InvoiceSummary {
  id: string;
  status?: string;
}

export interface ScheduleInvoiceInput {
  paymentId: string;
  /** Valor bruto em BRL (o mesmo `payment.value` do webhook). */
  value: number;
  /** Data prevista de emissão, `YYYY-MM-DD`. */
  effectiveDate: string;
  serviceDescription?: string;
  observations?: string;
}

function listFrom(payload: unknown): InvoiceSummary[] {
  if (Array.isArray(payload)) return payload as InvoiceSummary[];
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as InvoiceSummary[];
  }
  return [];
}

/** Notas já existentes para um pagamento. GET — seguro para repetir. */
export async function listInvoicesForPayment(paymentId: string): Promise<InvoiceSummary[]> {
  const cfg = getAsaasConfig();
  const payload = await asaasFetch<unknown>(
    cfg,
    `/invoices?payment=${encodeURIComponent(paymentId)}&limit=1`
  );
  return listFrom(payload);
}

/**
 * Agenda a NFS-e de uma cobrança avulsa. A API do Asaas não tem
 * `Idempotency-Key` (skill §8), então consulta antes de repetir o POST: se já
 * existir nota para o pagamento, devolve `null` sem criar outra.
 */
export async function scheduleInvoiceOnce(
  input: ScheduleInvoiceInput
): Promise<InvoiceSummary | null> {
  const existing = await listInvoicesForPayment(input.paymentId);
  if (existing.length > 0) return null;

  const cfg = getAsaasConfig();
  return asaasFetch<InvoiceSummary>(cfg, '/invoices', {
    method: 'POST',
    body: {
      payment: input.paymentId,
      value: input.value,
      effectiveDate: input.effectiveDate,
      ...(input.serviceDescription ? { serviceDescription: input.serviceDescription } : {}),
      ...(input.observations ? { observations: input.observations } : {}),
      ...invoiceServiceFields(),
      taxes: invoiceTaxes(),
    },
  });
}

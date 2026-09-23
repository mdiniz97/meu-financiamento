import { asaasFetch } from './client';
import { getAsaasConfig } from './config';
import { invoicePaymentTaxes, invoiceServiceFields } from './invoice-config';

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
  /** Deduções (não alteram o valor total, mudam a base do ISS). Default 0. */
  deductions?: number;
}

const DEFAULT_OBSERVATIONS = 'NFS-e emitida automaticamente pelo sistema.';

/** Status que NÃO representam documento válido — permitem reemissão. */
const REISSUABLE_STATUSES = new Set(['ERROR', 'CANCELED', 'CANCELLATION_DENIED']);

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
  // Só bloqueia se já houver nota "viva". ERROR / CANCELED / CANCELLATION_DENIED
  // não são documentos válidos: permitem reemitir depois de corrigir a causa.
  // Status desconhecido é tratado como vivo, por segurança.
  if (existing.some((invoice) => !REISSUABLE_STATUSES.has(invoice.status ?? ''))) return null;

  const cfg = getAsaasConfig();
  return asaasFetch<InvoiceSummary>(cfg, '/invoices', {
    method: 'POST',
    // `serviceDescription`, `observations`, `value`, `deductions`,
    // `effectiveDate`, `municipalServiceName` e `taxes` são todos obrigatórios
    // no `InvoiceSaveRequestDTO` — omitir qualquer um devolve 400.
    body: {
      payment: input.paymentId,
      serviceDescription: input.serviceDescription ?? 'Créditos pré-pagos',
      observations: input.observations ?? DEFAULT_OBSERVATIONS,
      value: input.value,
      deductions: input.deductions ?? 0,
      effectiveDate: input.effectiveDate,
      ...invoiceServiceFields(),
      taxes: invoicePaymentTaxes(),
    },
  });
}

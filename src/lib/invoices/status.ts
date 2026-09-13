const INVOICE_STATUS_LABELS: Record<string, string> = {
  AUTHORIZED: 'Autorizada',
  SCHEDULED: 'Agendada',
  PROCESSING_CANCELLATION: 'Cancelando',
  CANCELED: 'Cancelada',
  CANCELLATION_DENIED: 'Cancelamento negado',
  ERROR: 'Erro',
};

export function invoiceStatusLabel(status: string): string {
  return INVOICE_STATUS_LABELS[status] ?? status;
}

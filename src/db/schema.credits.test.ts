import { describe, expect, it } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
import * as schema from './schema';

describe('schema créditos/NFS-e', () => {
  it('credit_purchases', () => {
    expect(getTableName(schema.creditPurchases)).toBe('credit_purchases');
    const c = getTableColumns(schema.creditPurchases);
    expect(c.asaasCheckoutId.name).toBe('asaas_checkout_id');
    expect(c.status.name).toBe('status');
  });
  it('invoices', () => {
    expect(getTableColumns(schema.invoices).asaasInvoiceId.name).toBe('asaas_invoice_id');
  });
  it('subscriptions.invoice_configured_at', () => {
    expect(getTableColumns(schema.subscriptions).invoiceConfiguredAt.name).toBe('invoice_configured_at');
  });
});

import { describe, expect, it } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
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
  it('subscription_events', () => {
    expect(getTableName(schema.subscriptionEvents)).toBe('subscription_events');
    const c = getTableColumns(schema.subscriptionEvents);
    expect(c.userId.name).toBe('user_id');
    expect(c.subscriptionId.name).toBe('subscription_id');
    expect(c.action.name).toBe('action');
    expect(c.result.name).toBe('result');
    expect(c.createdAt.name).toBe('created_at');
  });
  it('subscription_events tem índice em created_at (retenção do reconcile)', () => {
    const cfg = getTableConfig(schema.subscriptionEvents);
    const idx = cfg.indexes.find((i) => i.config.name === 'subscription_events_created_at_idx');
    expect(idx).toBeDefined();
    expect(idx!.config.columns.map((c) => (c as { name: string }).name)).toEqual(['created_at']);
  });
});

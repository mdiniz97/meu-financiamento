import { describe, expect, it } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from './schema';

describe('schema Asaas', () => {
  it('payments tem asaas_payment_id único e user_id', () => {
    expect(getTableName(schema.payments)).toBe('payments');
    const cols = getTableColumns(schema.payments);
    expect(cols.asaasPaymentId.name).toBe('asaas_payment_id');
    expect(cols.userId.name).toBe('user_id');
  });

  it('webhook_events tem asaas_event_id e processed_at', () => {
    const cols = getTableColumns(schema.webhookEvents);
    expect(cols.asaasEventId.name).toBe('asaas_event_id');
    expect(cols.processedAt.name).toBe('processed_at');
  });

  it('subscriptions ganhou asaas_subscription_id e grace_until', () => {
    const cols = getTableColumns(schema.subscriptions);
    expect(cols.asaasSubscriptionId.name).toBe('asaas_subscription_id');
    expect(cols.graceUntil.name).toBe('grace_until');
    expect(cols.cancelAtPeriodEnd.name).toBe('cancel_at_period_end');
  });

  it('invoices tem índice em user_id', () => {
    const cfg = getTableConfig(schema.invoices);
    const idx = cfg.indexes.find((i) => i.config.name === 'invoices_user_id_idx');
    expect(idx).toBeDefined();
    expect(idx!.config.columns.map((c) => (c as { name: string }).name)).toEqual(['user_id']);
  });
});

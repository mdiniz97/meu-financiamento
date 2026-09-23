import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateInvoiceSettings: vi.fn(),
  getAsaasConfig: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: { query: { subscriptions: { findMany: mocks.findMany } } },
  schema: { subscriptions: { providerId: 'providerId', invoiceConfiguredAt: 'invoiceConfiguredAt', status: 'status' } },
}));

vi.mock('@/lib/payments/asaas/subscription', () => ({
  updateInvoiceSettings: mocks.updateInvoiceSettings,
}));

vi.mock('@/lib/payments/asaas/config', () => ({
  getAsaasConfig: mocks.getAsaasConfig,
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (col: unknown, val: unknown) => ({ col, val }),
  isNotNull: (col: unknown) => ({ isNotNull: col }),
  inArray: (col: unknown, vals: unknown) => ({ col, vals }),
}));

import { refreshSubscriptionInvoiceSettings } from './invoice-refresh';

const original = {
  enabled: process.env.ASAAS_INVOICE_ENABLED,
  env: process.env.ASAAS_ENV,
};

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.findMany.mockReset();
  mocks.findMany.mockResolvedValue([]);
  mocks.updateInvoiceSettings.mockReset();
  mocks.updateInvoiceSettings.mockResolvedValue(undefined);
  mocks.getAsaasConfig.mockReset();
  mocks.getAsaasConfig.mockImplementation(() => ({ env: process.env.ASAAS_ENV ?? 'sandbox' }));
  process.env.ASAAS_INVOICE_ENABLED = 'true';
  process.env.ASAAS_ENV = 'production';
});

afterEach(() => {
  if (original.enabled === undefined) delete process.env.ASAAS_INVOICE_ENABLED;
  else process.env.ASAAS_INVOICE_ENABLED = original.enabled;
  if (original.env === undefined) delete process.env.ASAAS_ENV;
  else process.env.ASAAS_ENV = original.env;
});

describe('refreshSubscriptionInvoiceSettings', () => {
  it('flag off: pula sem consultar nada', async () => {
    process.env.ASAAS_INVOICE_ENABLED = 'false';

    await expect(refreshSubscriptionInvoiceSettings()).resolves.toMatchObject({ skipped: true });

    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.updateInvoiceSettings).not.toHaveBeenCalled();
  });

  it('sandbox: pula (evita emitir documento fiscal real fora de produção)', async () => {
    process.env.ASAAS_ENV = 'sandbox';

    await expect(refreshSubscriptionInvoiceSettings()).resolves.toMatchObject({ skipped: true });

    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('reenvia o invoiceSettings de cada assinatura ativa', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 's1', providerId: 'sub_1' },
      { id: 's2', providerId: 'sub_2' },
    ]);

    await expect(refreshSubscriptionInvoiceSettings()).resolves.toMatchObject({
      checked: 2,
      updated: 2,
      failed: 0,
      skipped: false,
    });

    expect(mocks.updateInvoiceSettings).toHaveBeenCalledTimes(2);
    expect(mocks.updateInvoiceSettings).toHaveBeenNthCalledWith(1, 'sub_1');
    expect(mocks.updateInvoiceSettings).toHaveBeenNthCalledWith(2, 'sub_2');
  });

  it('uma falha não interrompe as demais', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 's1', providerId: 'sub_1' },
      { id: 's2', providerId: 'sub_2' },
    ]);
    mocks.updateInvoiceSettings
      .mockRejectedValueOnce(new Error('asaas oscilou'))
      .mockResolvedValueOnce(undefined);

    await expect(refreshSubscriptionInvoiceSettings()).resolves.toMatchObject({
      checked: 2,
      updated: 1,
      failed: 1,
    });

    expect(mocks.updateInvoiceSettings).toHaveBeenCalledTimes(2);
  });
});

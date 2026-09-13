import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ asaasFetch: vi.fn() }));

vi.mock('./client', () => ({ asaasFetch: mocks.asaasFetch }));

import type { AsaasConfig } from './config';
import { ASAAS_WEBHOOK_EVENTS, registerAsaasWebhook } from './webhook-registration';

const cfg: AsaasConfig = {
  baseUrl: 'https://api.asaas.com/v3',
  apiKey: 'api-key',
  webhookToken: 'x'.repeat(32),
  env: 'production',
};

const input = { appUrl: 'https://amortiza.me', adminEmail: 'a@b.c' };

beforeEach(() => mocks.asaasFetch.mockReset());

describe('registerAsaasWebhook — F2 idempotente', () => {
  it('cria via POST quando não existe webhook com a URL', async () => {
    mocks.asaasFetch
      .mockResolvedValueOnce({ totalCount: 0, hasMore: false, data: [] })
      .mockResolvedValueOnce({ id: 'wh_new' });

    const res = await registerAsaasWebhook(cfg, input);

    expect(res).toEqual({ id: 'wh_new', action: 'created' });
    expect(mocks.asaasFetch).toHaveBeenCalledTimes(2);
    const [first, second] = mocks.asaasFetch.mock.calls;
    expect(first[1]).toBe('/webhooks');
    expect(first[2]).toBeUndefined();
    expect(second[1]).toBe('/webhooks');
    expect(second[2].method).toBe('POST');
    expect(second[2].body.events).toEqual(ASAAS_WEBHOOK_EVENTS);
  });

  it('atualiza via PUT o webhook existente de mesma URL (não duplica)', async () => {
    mocks.asaasFetch
      .mockResolvedValueOnce({
        data: [
          { id: 'wh_other', url: 'https://outro.example/api/asaas/webhook' },
          { id: 'wh_exist', url: 'https://amortiza.me/api/asaas/webhook' },
        ],
      })
      .mockResolvedValueOnce({ id: 'wh_exist' });

    const res = await registerAsaasWebhook(cfg, input);

    expect(res).toEqual({ id: 'wh_exist', action: 'updated' });
    expect(mocks.asaasFetch).toHaveBeenCalledTimes(2);
    const second = mocks.asaasFetch.mock.calls[1];
    expect(second[1]).toBe('/webhooks/wh_exist');
    expect(second[2].method).toBe('PUT');
    expect(second[2].body.url).toBe('https://amortiza.me/api/asaas/webhook');
    expect(second[2].body.authToken).toBe(cfg.webhookToken);
  });

  it('aceita a listagem como array puro', async () => {
    mocks.asaasFetch
      .mockResolvedValueOnce([{ id: 'wh_exist', url: 'https://amortiza.me/api/asaas/webhook' }])
      .mockResolvedValueOnce({ id: 'wh_exist' });

    const res = await registerAsaasWebhook(cfg, input);

    expect(res.action).toBe('updated');
  });

  it('mantém os 8 eventos INVOICE_* na assinatura', () => {
    const invoice = ASAAS_WEBHOOK_EVENTS.filter((e) => e.startsWith('INVOICE_'));
    expect(invoice).toEqual([
      'INVOICE_CREATED',
      'INVOICE_UPDATED',
      'INVOICE_SYNCHRONIZED',
      'INVOICE_AUTHORIZED',
      'INVOICE_PROCESSING_CANCELLATION',
      'INVOICE_CANCELED',
      'INVOICE_CANCELLATION_DENIED',
      'INVOICE_ERROR',
    ]);
  });
});

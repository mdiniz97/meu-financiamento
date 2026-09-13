import { afterEach, describe, expect, it, vi } from 'vitest';
import { asaasFetch, AsaasApiError } from './client';

const cfg = {
  baseUrl: 'https://api-sandbox.asaas.com/v3',
  apiKey: '$aact_hmlg_abc',
  webhookToken: 'x'.repeat(32),
  env: 'sandbox' as const,
};

afterEach(() => vi.restoreAllMocks());

describe('asaasFetch', () => {
  it('envia access_token, User-Agent e body JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'sub_1' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await asaasFetch<{ id: string }>(cfg, '/subscriptions', {
      method: 'POST',
      body: { value: 119.9 },
    });
    expect(out.id).toBe('sub_1');
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.access_token).toBe('$aact_hmlg_abc');
    expect(headers['User-Agent']).toBe('amortiza/1.0');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('lança AsaasApiError com status e body em erro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ description: 'nope' }] }), { status: 400 })
      )
    );
    await expect(asaasFetch(cfg, '/subscriptions')).rejects.toBeInstanceOf(AsaasApiError);
  });
});

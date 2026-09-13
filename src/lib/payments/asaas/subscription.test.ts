import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelAtPeriodEnd, getSubscription } from './subscription';

afterEach(() => vi.restoreAllMocks());

function stubEnv() {
  vi.stubEnv('ASAAS_ENV', 'sandbox');
  vi.stubEnv('ASAAS_BASE_URL', 'https://api-sandbox.asaas.com/v3');
  vi.stubEnv('ASAAS_API_KEY', '$aact_hmlg_x');
  vi.stubEnv('ASAAS_WEBHOOK_AUTH_TOKEN', 'x'.repeat(32));
}

describe('cancelAtPeriodEnd', () => {
  it('envia PUT status INACTIVE', async () => {
    stubEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'sub_1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await cancelAtPeriodEnd('sub_1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api-sandbox.asaas.com/v3/subscriptions/sub_1');
    expect((init as RequestInit).method).toBe('PUT');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ status: 'INACTIVE' });
  });
});

describe('getSubscription', () => {
  it('busca por id via GET e devolve apenas os campos declarados', async () => {
    stubEnv();
    const payload = {
      id: 'sub_1',
      status: 'ACTIVE',
      nextDueDate: '2027-09-13',
      value: 119.9,
      cycle: 'YEARLY',
      billingType: 'CREDIT_CARD',
      extra: 'ignore',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const out = await getSubscription('sub_1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api-sandbox.asaas.com/v3/subscriptions/sub_1');
    expect((init as RequestInit).method).toBe('GET');
    expect((init as RequestInit).body).toBeUndefined();
    expect(out).toEqual({
      id: 'sub_1',
      status: 'ACTIVE',
      nextDueDate: '2027-09-13',
      value: 119.9,
      cycle: 'YEARLY',
      billingType: 'CREDIT_CARD',
    });
    expect(out).not.toHaveProperty('extra');
  });
});

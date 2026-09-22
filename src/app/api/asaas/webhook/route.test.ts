import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), values: vi.fn(), process: vi.fn(), after: vi.fn() }));
vi.mock('@/db', () => ({
  db: { insert: mocks.insert },
  schema: { webhookEvents: { asaasEventId: 'asaasEventId', id: 'id' } },
}));
vi.mock('next/server', () => ({
  after: mocks.after,
  NextResponse: {
    json: (b: unknown, i?: { status?: number }) =>
      new Response(JSON.stringify(b), { status: i?.status ?? 200 }),
  },
}));
vi.mock('@/lib/subscriptions/apply-event', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/subscriptions/apply-event')>();
  return { ...actual, processWebhookEvent: mocks.process };
});

import { GET, POST } from './route';

const req = (token: string | null, body: object) =>
  new Request('http://localhost/api/asaas/webhook', {
    method: 'POST',
    headers: token ? { 'asaas-access-token': token } : {},
    body: JSON.stringify(body),
  });

const reqWithHeaders = (headers: Record<string, string>, body: object) =>
  new Request('http://localhost/api/asaas/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

const insertedRow = (rows: { id: string }[]) =>
  mocks.insert.mockReturnValue({
    values: mocks.values.mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('ASAAS_ENV', 'sandbox');
  vi.stubEnv('ASAAS_BASE_URL', 'https://api-sandbox.asaas.com/v3');
  vi.stubEnv('ASAAS_API_KEY', '$aact_hmlg_x');
  vi.stubEnv('ASAAS_WEBHOOK_AUTH_TOKEN', 'x'.repeat(32));
  mocks.insert.mockReset();
  mocks.values.mockReset();
  mocks.process.mockReset();
  mocks.after.mockReset();
});

describe('POST /api/asaas/webhook', () => {
  it('401 sem token válido', async () => {
    const res = await POST(req('errado', { id: 'e1', event: 'X' }));
    expect(res.status).toBe(401);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('400 em payload sem id/event', async () => {
    const res = await POST(req('x'.repeat(32), { foo: 1 }));
    expect(res.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('200, sanitiza o payload (R8) e agenda processamento', async () => {
    insertedRow([{ id: 'row-1' }]);
    const res = await POST(
      req('x'.repeat(32), {
        id: 'e1',
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: 'pay-1',
          creditCard: { creditCardNumber: '1234567812345678', creditCardBrand: 'VISA' },
        },
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.process).not.toHaveBeenCalled();

    const payload = mocks.values.mock.calls[0]?.[0] as {
      asaasEventId: string;
      event: string;
      payload: { payment?: { creditCard?: { creditCardNumber?: string } } };
    };
    expect(payload.asaasEventId).toBe('e1');
    expect(payload.event).toBe('PAYMENT_CONFIRMED');
    expect(payload.payload.payment?.creditCard?.creditCardNumber).toBe('****5678');
    expect(payload.payload.payment?.creditCard?.creditCardNumber).not.toContain('123456781234');
  });

  it('entrega duplicada (insert vazio): 200 e NÃO reagenda', async () => {
    insertedRow([]);
    const res = await POST(req('x'.repeat(32), { id: 'e1', event: 'PAYMENT_CONFIRMED' }));
    expect(res.status).toBe(200);
    expect(mocks.after).not.toHaveBeenCalled();
  });
});

describe('POST /api/asaas/webhook — allowlist de IP (RS2b)', () => {
  const valid = 'x'.repeat(32);

  it('sem ASAAS_WEBHOOK_IP_ALLOWLIST segue o fluxo (opt-in: vazio não bloqueia)', async () => {
    insertedRow([{ id: 'row-1' }]);
    const res = await POST(
      reqWithHeaders(
        { 'asaas-access-token': valid, 'x-forwarded-for': '9.9.9.9' },
        { id: 'e1', event: 'PAYMENT_CONFIRMED' }
      )
    );
    expect(res.status).toBe(200);
  });

  it('lista definida + IP fora → 403 mesmo com token válido', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_IP_ALLOWLIST', '1.2.3.4');
    const res = await POST(
      reqWithHeaders(
        { 'asaas-access-token': valid, 'x-forwarded-for': '9.9.9.9' },
        { id: 'e1', event: 'PAYMENT_CONFIRMED' }
      )
    );
    expect(res.status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('lista definida + IP dentro → segue (200)', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_IP_ALLOWLIST', '1.2.3.4');
    insertedRow([{ id: 'row-1' }]);
    const res = await POST(
      reqWithHeaders(
        { 'asaas-access-token': valid, 'x-forwarded-for': '1.2.3.4' },
        { id: 'e1', event: 'PAYMENT_CONFIRMED' }
      )
    );
    expect(res.status).toBe(200);
  });

  it('usa o primeiro IP de x-forwarded-for (CSV), ignorando os demais', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_IP_ALLOWLIST', '1.2.3.4, 9.9.9.9');
    const res = await POST(
      reqWithHeaders(
        { 'asaas-access-token': valid, 'x-forwarded-for': '5.6.7.8, 1.2.3.4' },
        { id: 'e1', event: 'PAYMENT_CONFIRMED' }
      )
    );
    expect(res.status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('atrás da Cloudflare usa cf-connecting-ip (IP real do Asaas), não o IP do proxy', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_IP_ALLOWLIST', '52.67.12.206');
    insertedRow([{ id: 'row-1' }]);
    const res = await POST(
      reqWithHeaders(
        {
          'asaas-access-token': valid,
          'cf-connecting-ip': '52.67.12.206',
          'x-forwarded-for': '172.70.1.1',
          'x-real-ip': '172.70.1.1',
        },
        { id: 'e1', event: 'PAYMENT_RECEIVED' }
      )
    );
    expect(res.status).toBe(200);
  });

  it('cf-connecting-ip fora da lista → 403 mesmo se x-forwarded-for estiver na lista', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_IP_ALLOWLIST', '52.67.12.206');
    const res = await POST(
      reqWithHeaders(
        { 'asaas-access-token': valid, 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '52.67.12.206' },
        { id: 'e1', event: 'PAYMENT_RECEIVED' }
      )
    );
    expect(res.status).toBe(403);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('aceita x-real-ip quando x-forwarded-for está ausente', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_IP_ALLOWLIST', '1.2.3.4');
    insertedRow([{ id: 'row-1' }]);
    const res = await POST(
      reqWithHeaders(
        { 'asaas-access-token': valid, 'x-real-ip': '1.2.3.4' },
        { id: 'e1', event: 'PAYMENT_CONFIRMED' }
      )
    );
    expect(res.status).toBe(200);
  });

  it('trata x-forwarded-for vazio/branco como ausente e usa x-real-ip', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_IP_ALLOWLIST', '1.2.3.4');
    insertedRow([{ id: 'row-1' }]);
    const res = await POST(
      reqWithHeaders(
        { 'asaas-access-token': valid, 'x-forwarded-for': '  , 9.9.9.9', 'x-real-ip': '1.2.3.4' },
        { id: 'e1', event: 'PAYMENT_CONFIRMED' }
      )
    );
    expect(res.status).toBe(200);
  });
});

describe('GET /api/asaas/webhook', () => {
  it('405 method not allowed', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});

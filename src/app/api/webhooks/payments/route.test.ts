import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  verifyWebhook: vi.fn(),
  findPack: vi.fn(),
  findSub: vi.fn(),
  insertSub: vi.fn(),
  updateSub: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn(), isNull: vi.fn() }));
vi.mock('@/db', () => ({
  db: {
    query: {
      packs: { findFirst: mocks.findPack },
      subscriptions: { findFirst: mocks.findSub },
      creditLedger: { findFirst: vi.fn() },
    },
    insert: mocks.insertSub,
    update: mocks.updateSub,
  },
  schema: {
    packs: { id: 'id' },
    subscriptions: { id: 'id', userId: 'userId', packId: 'packId', provider: 'provider', providerId: 'providerId', status: 'status', currentPeriodEnd: 'currentPeriodEnd' },
    creditLedger: { userId: 'userId' },
  },
}));
vi.mock('@/lib/payments', () => ({
  getPaymentProvider: () => ({ verifyWebhook: mocks.verifyWebhook }),
}));
vi.mock('@/lib/credits', () => ({ addCredits: vi.fn() }));

import { GET, POST } from './route';
import { __resetFakeIdempotencyForTests } from '@/lib/payments/fake-idempotency';

const request = (userId = 'user-1', idempotencyToken?: string) => {
  const params = new URLSearchParams({ userId, packId: 'unlimited' });
  if (idempotencyToken) params.set('idempotencyToken', idempotencyToken);
  return new Request(`http://localhost/api/webhooks/payments?${params.toString()}`);
};

// update → set → where → returning: rowsByCall define o resultado de cada
// chamada de update (0 linhas = corrida perdida; 1 linha = sucesso no CAS)
const updateChain = (rowsByCall: Array<Array<{ id: string }>>) => {
  let i = 0;
  mocks.updateSub.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(async () => {
          const rows = rowsByCall[Math.min(i, rowsByCall.length - 1)] ?? [];
          i++;
          return rows;
        }),
      }),
    }),
  });
};

const stubDbChain = () => {
  mocks.insertSub.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  updateChain([[{ id: 'sub-1' }]]);
};

describe('GET fake payment webhook security', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PAYMENT_PROVIDER', 'fake');
    __resetFakeIdempotencyForTests();
    mocks.auth.mockReset();
    mocks.verifyWebhook.mockReset();
    mocks.findPack.mockReset();
    mocks.findSub.mockReset();
    mocks.insertSub.mockReset();
    mocks.updateSub.mockReset();
    stubDbChain();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('is unavailable in production even when fake provider is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mocks.auth.mockResolvedValue({ userId: 'user-1' });

    const response = await GET(request());

    expect(response.status).toBe(405);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.verifyWebhook).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.verifyWebhook).not.toHaveBeenCalled();
  });

  it('rejects a signed-in user targeting a different user ID', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user-1' });

    const response = await GET(request('user-2'));

    expect(response.status).toBe(403);
    expect(mocks.verifyWebhook).not.toHaveBeenCalled();
  });

  it('allows a signed-in user to approve only their own fake payment', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user-1' });
    mocks.verifyWebhook.mockResolvedValue({ userId: 'user-1', packId: 'unlimited', providerId: 'fake-1' });
    mocks.findPack.mockResolvedValue({ id: 'unlimited', isSubscription: false, credits: 0 });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe('renovação de assinatura no webhook fake (GET)', () => {
  const subscriptionPack = { id: 'unlimited', isSubscription: true, credits: null };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PAYMENT_PROVIDER', 'fake');
    __resetFakeIdempotencyForTests();
    mocks.auth.mockReset().mockResolvedValue({ userId: 'user-1' });
    mocks.verifyWebhook.mockReset().mockResolvedValue({
      userId: 'user-1', packId: 'unlimited', providerId: 'fake_user-1_unlimited',
    });
    mocks.findPack.mockReset().mockResolvedValue(subscriptionPack);
    mocks.findSub.mockReset();
    mocks.insertSub.mockReset();
    mocks.updateSub.mockReset();
    stubDbChain();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('primeira compra cria assinatura com currentPeriodEnd = agora + 30 dias', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.findSub.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const values = mocks.insertSub.mock.results[0].value.values.mock.calls[0][0];
    expect(values.providerId).toBe('fake_user-1_unlimited');
    expect(values.currentPeriodEnd.getTime()).toBe(Date.parse('2026-03-03T00:00:00Z'));
    expect(mocks.updateSub).not.toHaveBeenCalled();
  });

  it('recompra do mesmo pacote estende o fim a partir do maior entre agora e o fim atual', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.findSub.mockResolvedValueOnce({
      id: 'sub-1',
      currentPeriodEnd: new Date('2026-01-15T00:00:00Z'),
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, extended: true });
    const set = mocks.updateSub.mock.results[0].value.set.mock.calls[0][0];
    expect(set.status).toBe('active');
    expect(set.currentPeriodEnd.getTime()).toBe(Date.parse('2026-03-03T00:00:00Z'));
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });

  it('fim atual no futuro vale mais que agora: estende a partir do fim atual', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.findSub.mockResolvedValueOnce({
      id: 'sub-1',
      currentPeriodEnd: new Date('2026-04-01T00:00:00Z'),
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, extended: true });
    const set = mocks.updateSub.mock.results[0].value.set.mock.calls[0][0];
    expect(set.currentPeriodEnd.getTime()).toBe(Date.parse('2026-05-01T00:00:00Z'));
  });

  it('corrida paralela de compras duplicadas: violação única re-lê o vencedor e vira idempotente (mesmo providerId)', async () => {
    mocks.findSub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'sub-1',
        providerId: 'fake_user-1_unlimited',
        currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
      });
    mocks.insertSub.mockReturnValue({
      values: vi.fn().mockRejectedValue({ cause: { cause: { code: '23505' } } }),
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, idempotent: true });
    expect(mocks.updateSub).not.toHaveBeenCalled();
    expect(mocks.insertSub).toHaveBeenCalledTimes(1);
  });

  it('corrida de renovação com fim nulo (legado): CAS IS NULL perdeu, re-lê o fim fresco e retenta', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.findSub
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: null })
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-02-14T00:00:00Z') });
    updateChain([[], [{ id: 'sub-1' }]]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, extended: true });
    const setCalls = mocks.updateSub.mock.results[0].value.set.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(setCalls).toHaveLength(2);
    expect(setCalls[1].currentPeriodEnd.getTime()).toBe(Date.parse('2026-03-16T00:00:00Z'));
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });

  it('fim nulo (legado) sem corrida: CAS IS NULL aplica na primeira tentativa', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.findSub.mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: null });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, extended: true });
    const setCalls = mocks.updateSub.mock.results[0].value.set.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].currentPeriodEnd.getTime()).toBe(Date.parse('2026-03-03T00:00:00Z'));
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });

  it('fim nulo (legado) com corrida dupla: CAS IS NULL perde duas vezes → 409', async () => {
    mocks.findSub
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: null })
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: null });
    updateChain([[], []]);

    const response = await GET(request());

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/tente novamente|conflito/i);
    expect(mocks.updateSub).toHaveBeenCalledTimes(2);
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });

  it('corrida de renovação: CAS perdeu, re-lê o fim fresco e retenta sem perder 30 dias', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.findSub
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-01-15T00:00:00Z') })
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-02-14T00:00:00Z') });
    updateChain([[], [{ id: 'sub-1' }]]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, extended: true });
    const setCalls = mocks.updateSub.mock.results[0].value.set.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(setCalls).toHaveLength(2);
    expect(setCalls[1].currentPeriodEnd.getTime()).toBe(Date.parse('2026-03-16T00:00:00Z'));
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });

  it('corrida de renovação: retentativa também perde → 409 com semântica de conflito/retry', async () => {
    mocks.findSub
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-01-15T00:00:00Z') })
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-02-14T00:00:00Z') });
    updateChain([[], []]);

    const response = await GET(request());

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/tente novamente|conflito/i);
    expect(mocks.updateSub).toHaveBeenCalledTimes(2);
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });

  it('idempotency token: repetir o GET com o mesmo token não estende de novo', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.findSub.mockResolvedValue({ id: 'sub-1', currentPeriodEnd: new Date('2026-01-15T00:00:00Z') });

    const first = await GET(request('user-1', 'tok-abc'));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, extended: true });
    expect(mocks.updateSub).toHaveBeenCalledTimes(1);

    const second = await GET(request('user-1', 'tok-abc'));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, idempotent: true });
    expect(mocks.updateSub).toHaveBeenCalledTimes(1);
  });
});

describe('POST real payment webhook', () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.verifyWebhook.mockReset();
    mocks.findPack.mockReset();
    mocks.findSub.mockReset();
    mocks.insertSub.mockReset();
    mocks.updateSub.mockReset();
    stubDbChain();
  });

  afterEach(() => vi.restoreAllMocks());

  const postRequest = () =>
    new Request('http://localhost/api/webhooks/payments', {
      method: 'POST',
      headers: { 'x-signature': 'valid-sig' },
      body: '{"userId":"user-1","packId":"unlimited"}',
    });

  it('continua processando compras reais com assinatura válida', async () => {
    mocks.verifyWebhook.mockResolvedValue({ userId: 'user-1', packId: 'unlimited', providerId: 'stripe-1' });
    mocks.findPack.mockResolvedValue({ id: 'unlimited', isSubscription: false, credits: 10 });

    const response = await POST(
      new Request('http://localhost/api/webhooks/payments', {
        method: 'POST',
        headers: { 'x-signature': 'valid-sig' },
        body: '{"userId":"user-1","packId":"unlimited"}',
      })
    );

    expect(mocks.verifyWebhook).toHaveBeenCalledWith('{"userId":"user-1","packId":"unlimited"}', 'valid-sig');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('rejeita assinatura inválida sem tocar no banco', async () => {
    mocks.verifyWebhook.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/webhooks/payments', {
        method: 'POST',
        headers: { 'x-signature': 'bad-sig' },
        body: '{"userId":"user-1","packId":"unlimited"}',
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.findPack).not.toHaveBeenCalled();
  });

  it('mesmo providerId real já processado segue idempotente (não estende)', async () => {
    mocks.verifyWebhook.mockResolvedValue({ userId: 'user-1', packId: 'unlimited', providerId: 'stripe-1' });
    mocks.findPack.mockResolvedValue({ id: 'unlimited', isSubscription: true, credits: null });
    mocks.findSub.mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-01-15T00:00:00Z') });

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, idempotent: true });
    expect(mocks.updateSub).not.toHaveBeenCalled();
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });

  it('novo providerId real renova sem encolher o período atual (max(agora, fim atual) + 30d)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.verifyWebhook.mockResolvedValue({ userId: 'user-1', packId: 'unlimited', providerId: 'stripe-2' });
    mocks.findPack.mockResolvedValue({ id: 'unlimited', isSubscription: true, credits: null });
    mocks.findSub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-04-01T00:00:00Z') });

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const set = mocks.updateSub.mock.results[0].value.set.mock.calls[0][0];
    expect(set.currentPeriodEnd.getTime()).toBe(Date.parse('2026-05-01T00:00:00Z'));
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });

  it('renovação real com corrida: CAS perdeu e re-leitura já tem o providerId → idempotente', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.verifyWebhook.mockResolvedValue({ userId: 'user-1', packId: 'unlimited', providerId: 'stripe-2' });
    mocks.findPack.mockResolvedValue({ id: 'unlimited', isSubscription: true, credits: null });
    mocks.findSub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-01-15T00:00:00Z') })
      .mockResolvedValueOnce({ id: 'sub-1', providerId: 'stripe-2', currentPeriodEnd: new Date('2026-02-14T00:00:00Z') });
    updateChain([[]]);

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, idempotent: true });
    expect(mocks.updateSub).toHaveBeenCalledTimes(1);
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });

  it('renovação real com corrida: retentativa também perde → 409', async () => {
    mocks.verifyWebhook.mockResolvedValue({ userId: 'user-1', packId: 'unlimited', providerId: 'stripe-2' });
    mocks.findPack.mockResolvedValue({ id: 'unlimited', isSubscription: true, credits: null });
    mocks.findSub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-01-15T00:00:00Z') })
      .mockResolvedValueOnce({ id: 'sub-1', providerId: 'stripe-3', currentPeriodEnd: new Date('2026-02-14T00:00:00Z') });
    updateChain([[], []]);

    const response = await POST(postRequest());

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/tente novamente|conflito/i);
    expect(mocks.updateSub).toHaveBeenCalledTimes(2);
  });

  it('primeira compra com corrida e providerIds DISTINTOS: 23505 re-lê o vencedor e ESTENDE a linha (não vira idempotente cego)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.verifyWebhook.mockResolvedValue({ userId: 'user-1', packId: 'unlimited', providerId: 'stripe-2' });
    mocks.findPack.mockResolvedValue({ id: 'unlimited', isSubscription: true, credits: null });
    mocks.findSub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'sub-1',
        providerId: 'stripe-1',
        currentPeriodEnd: new Date('2026-02-14T00:00:00Z'),
      });
    mocks.insertSub.mockReturnValue({
      values: vi.fn().mockRejectedValue({ cause: { cause: { code: '23505' } } }),
    });
    updateChain([[{ id: 'sub-1' }]]);

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const set = mocks.updateSub.mock.results[0].value.set.mock.calls[0][0];
    expect(set.providerId).toBe('stripe-2');
    expect(set.currentPeriodEnd.getTime()).toBe(Date.parse('2026-03-16T00:00:00Z'));
    expect(mocks.insertSub).toHaveBeenCalledTimes(1);
  });

  it('primeira compra com corrida e MESMO providerId (entrega duplicada): 23505 re-lê e devolve idempotente, sem estender', async () => {
    mocks.verifyWebhook.mockResolvedValue({ userId: 'user-1', packId: 'unlimited', providerId: 'stripe-1' });
    mocks.findPack.mockResolvedValue({ id: 'unlimited', isSubscription: true, credits: null });
    mocks.findSub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'sub-1',
        providerId: 'stripe-1',
        currentPeriodEnd: new Date('2026-02-14T00:00:00Z'),
      });
    mocks.insertSub.mockReturnValue({
      values: vi.fn().mockRejectedValue({ cause: { cause: { code: '23505' } } }),
    });
    updateChain([[{ id: 'sub-1' }]]);

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, idempotent: true });
    expect(mocks.updateSub).not.toHaveBeenCalled();
    expect(mocks.insertSub).toHaveBeenCalledTimes(1);
  });

  it('recompra real subsequente renova a MESMA linha do primeiro registro (estende a linha certa)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-02-01T00:00:00Z'));
    mocks.verifyWebhook.mockResolvedValue({ userId: 'user-1', packId: 'unlimited', providerId: 'stripe-2' });
    mocks.findPack.mockResolvedValue({ id: 'unlimited', isSubscription: true, credits: null });
    mocks.findSub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub-1', currentPeriodEnd: new Date('2026-01-15T00:00:00Z') });
    updateChain([[{ id: 'sub-1' }]]);

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const set = mocks.updateSub.mock.results[0].value.set.mock.calls[0][0];
    expect(set.providerId).toBe('stripe-2');
    expect(set.currentPeriodEnd.getTime()).toBe(Date.parse('2026-03-03T00:00:00Z'));
    expect(mocks.insertSub).not.toHaveBeenCalled();
  });
});
